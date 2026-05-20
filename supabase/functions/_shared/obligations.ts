import { supabaseAdmin } from './supabaseAdmin.ts';
import { freezeGroupIfDefaultReserveInsufficient } from './groupFreeze.ts';
import { ensureActiveRestriction, recordDefaultReliability, recordLatePaymentReliability } from './reliability.ts';
import type { ContributionObligationRecord, ContributionObligationStatus, GroupRecord, MembershipRecord, RoundRecord, TransactionRecord } from './types.ts';

const settledObligationStatuses: ContributionObligationStatus[] = ['Paid', 'Waived', 'RefundPending'];

export function isContributionObligationSettled(status: ContributionObligationStatus) {
  return settledObligationStatuses.includes(status);
}

export async function listRoundObligations(roundId: string) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .select('*')
    .eq('round_id', roundId);

  if (error) {
    throw error;
  }
  return (data ?? []) as ContributionObligationRecord[];
}

export async function getContributionObligationForUserRound(roundId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .select('*')
    .eq('round_id', roundId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as ContributionObligationRecord | null;
}

async function getContributionObligationById(obligationId: string) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .select('*')
    .eq('id', obligationId)
    .single();

  if (error) {
    throw error;
  }
  return data as ContributionObligationRecord;
}

export async function markContributionObligationPendingPayment(obligationId: string) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .update({
      status: 'PendingPayment',
    })
    .eq('id', obligationId)
    .in('status', ['Unpaid', 'Late', 'PendingPayment'])
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as ContributionObligationRecord;
}

export async function markContributionObligationUnpaid(obligationId: string) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .update({
      status: 'Unpaid',
    })
    .eq('id', obligationId)
    .in('status', ['PendingPayment', 'Late', 'Unpaid'])
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as ContributionObligationRecord;
}

export async function markContributionObligationPaid(obligationId: string, transactionId: string, paidAt = new Date().toISOString()) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .update({
      status: 'Paid',
      paid_transaction_id: transactionId,
      paid_at: paidAt,
    })
    .eq('id', obligationId)
    .in('status', ['Unpaid', 'PendingPayment', 'Late', 'Paid'])
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as ContributionObligationRecord;
}

export async function markContributionObligationLate(obligationId: string, lateAt = new Date().toISOString()) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .update({
      status: 'Late',
      late_at: lateAt,
    })
    .eq('id', obligationId)
    .in('status', ['Unpaid', 'PendingPayment'])
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return getContributionObligationById(obligationId);
  }

  const obligation = data as ContributionObligationRecord;
  await recordLatePaymentReliability(obligation.user_id);
  return obligation;
}

export async function markContributionObligationDefaulted(obligationId: string, defaultedAt = new Date().toISOString()) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .update({
      status: 'Defaulted',
      defaulted_at: defaultedAt,
    })
    .eq('id', obligationId)
    .in('status', ['Unpaid', 'PendingPayment', 'Late'])
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return getContributionObligationById(obligationId);
  }

  const obligation = data as ContributionObligationRecord;
  await recordDefaultReliability(obligation.user_id);
  await ensureActiveRestriction({
    userId: obligation.user_id,
    restrictionType: 'DefaultedContribution',
    reason: `Contribution obligation ${obligation.id} defaulted after the configured grace period.`,
  });
  await removeDefaultedMemberAndCreateRefundTicket(obligation);
  await freezeGroupIfDefaultReserveInsufficient(obligation);
  return obligation;
}

async function sumSuccessfulTransactions(input: { groupId: string; userId: string; type: 'Contribution' | 'Payout' }) {
  const { data: rounds, error: roundsError } = await supabaseAdmin
    .from('Round')
    .select('Round_ID')
    .eq('Group_ID', input.groupId);

  if (roundsError) {
    throw roundsError;
  }

  const roundIds = (rounds ?? []).map(round => (round as { Round_ID: string }).Round_ID);
  if (!roundIds.length) {
    return 0;
  }

  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .select('Amount')
    .eq('User_ID', input.userId)
    .eq('Type', input.type)
    .eq('Status', 'Successful')
    .in('Round_ID', roundIds);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((sum, row) => sum + Number((row as { Amount: number }).Amount), 0);
}

async function removeDefaultedMemberAndCreateRefundTicket(obligation: ContributionObligationRecord) {
  const { error: membershipError } = await supabaseAdmin
    .from('GroupMembers')
    .update({ Status: 'Removed' })
    .eq('Group_ID', obligation.group_id)
    .eq('User_ID', obligation.user_id)
    .eq('Status', 'Active');
  if (membershipError) {
    throw membershipError;
  }

  const [contributed, paidOut] = await Promise.all([
    sumSuccessfulTransactions({ groupId: obligation.group_id, userId: obligation.user_id, type: 'Contribution' }),
    sumSuccessfulTransactions({ groupId: obligation.group_id, userId: obligation.user_id, type: 'Payout' }),
  ]);
  const refundableAmount = Math.max(Math.round((contributed - paidOut) * 100) / 100, 0);
  if (refundableAmount <= 0) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('refund_tickets')
    .insert({
      group_id: obligation.group_id,
      round_id: obligation.round_id,
      user_id: obligation.user_id,
      amount: refundableAmount,
      currency: obligation.currency,
      reason: 'Member defaulted after grace period; prior net contributions require refund review.',
      status: 'Created',
      calculation_snapshot: {
        contribution_total: contributed,
        payout_total: paidOut,
        defaulted_obligation_id: obligation.id,
      },
      offset_applied_amount: paidOut,
      created_by_event_id: null,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data;
}

function isPast(value: string | null | undefined, now: Date) {
  return !!value && new Date(value).getTime() <= now.getTime();
}

function contributionWindowMs(frequency: GroupRecord['Frequency']) {
  switch (frequency) {
    case 'Daily':
      return 24 * 60 * 60 * 1000;
    case 'Weekly':
      return 7 * 24 * 60 * 60 * 1000;
    case 'Bi-weekly':
      return 14 * 24 * 60 * 60 * 1000;
    case 'Monthly':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

function defaultContributionTiming(group: GroupRecord) {
  const dueAt = new Date(Date.now() + contributionWindowMs(group.Frequency));
  const graceEndsAt = new Date(dueAt.getTime() + 6 * 60 * 60 * 1000);
  return {
    dueAt: dueAt.toISOString(),
    graceEndsAt: graceEndsAt.toISOString(),
  };
}

export async function listDueContributionObligations(limit = 100) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .select('*')
    .in('status', ['Unpaid', 'PendingPayment', 'Late'])
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw error;
  }
  return (data ?? []) as ContributionObligationRecord[];
}

export async function processDueContributionObligations(input?: { now?: Date; limit?: number; dryRun?: boolean }) {
  const now = input?.now ?? new Date();
  const candidates = await listDueContributionObligations(input?.limit);
  const dueCandidates = candidates.filter(obligation => (
    isPast(obligation.due_at, now) || isPast(obligation.grace_ends_at, now)
  ));
  const late: ContributionObligationRecord[] = [];
  const defaulted: ContributionObligationRecord[] = [];

  for (const candidate of dueCandidates) {
    let current = candidate;
    if ((current.status === 'Unpaid' || current.status === 'PendingPayment') && isPast(current.due_at, now)) {
      if (input?.dryRun) {
        late.push(current);
      } else {
        current = await markContributionObligationLate(current.id, now.toISOString());
        late.push(current);
      }
    }

    if (current.status === 'Late' && isPast(current.grace_ends_at, now)) {
      if (input?.dryRun) {
        defaulted.push(current);
      } else {
        current = await markContributionObligationDefaulted(current.id, now.toISOString());
        defaulted.push(current);
      }
    }
  }

  return {
    checked: candidates.length,
    due: dueCandidates.length,
    late,
    defaulted,
    dryRun: input?.dryRun ?? false,
    evaluatedAt: now.toISOString(),
  };
}

export async function ensureContributionObligationsForRound(group: GroupRecord, round: RoundRecord, timing?: { dueAt?: string; graceEndsAt?: string }) {
  const contributionTiming = timing ?? defaultContributionTiming(group);
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from('GroupMembers')
    .select('*')
    .eq('Group_ID', group.Group_ID)
    .eq('Status', 'Active');

  if (membershipsError) {
    throw membershipsError;
  }

  const rows = ((memberships ?? []) as MembershipRecord[]).map(membership => ({
    round_id: round.Round_ID,
    group_id: group.Group_ID,
    user_id: membership.User_ID,
    amount_due: Number(group.Amount),
    currency: 'ETB',
    due_at: contributionTiming.dueAt,
    grace_ends_at: contributionTiming.graceEndsAt,
    status: 'Unpaid',
  }));

  if (!rows.length) {
    return [] as ContributionObligationRecord[];
  }

  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .upsert(rows, { onConflict: 'round_id,user_id', ignoreDuplicates: true })
    .select('*');

  if (error) {
    throw error;
  }

  const { error: deadlineError } = await supabaseAdmin
    .from('contribution_obligations')
    .update({
      due_at: contributionTiming.dueAt,
      grace_ends_at: contributionTiming.graceEndsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('round_id', round.Round_ID)
    .is('due_at', null);

  if (deadlineError) {
    throw deadlineError;
  }

  return (data ?? []) as ContributionObligationRecord[];
}

export async function getRoundObligationReadiness(roundId: string) {
  const obligations = await listRoundObligations(roundId);
  const total = obligations.length;
  const settled = obligations.filter(obligation => isContributionObligationSettled(obligation.status)).length;
  return {
    total,
    settled,
    pending: total - settled,
    readyForDraw: total > 0 && settled === total,
    obligations,
  };
}

export interface RoundObligationProgress {
  totalMembers: number;
  paidCount: number;
  unpaidCount: number;
  paidUserIds: Set<string>;
  obligations: ContributionObligationRecord[];
}

export function deriveRoundObligationProgress(
  obligations: ContributionObligationRecord[],
  activeMemberships: MembershipRecord[],
  successfulContributionTransactions: TransactionRecord[] = [],
): RoundObligationProgress {
  const activeMemberIds = new Set(activeMemberships.map(membership => membership.User_ID));
  const paidUserIds = new Set<string>();

  obligations
    .filter(obligation => activeMemberIds.has(obligation.user_id))
    .filter(obligation => isContributionObligationSettled(obligation.status))
    .forEach(obligation => paidUserIds.add(obligation.user_id));

  // Transitional guardrail: until the provider-attempt flow marks obligations Paid,
  // preserve existing MVP contribution behavior by overlaying successful transactions.
  successfulContributionTransactions
    .filter(transaction => activeMemberIds.has(transaction.User_ID))
    .forEach(transaction => paidUserIds.add(transaction.User_ID));

  const totalMembers = obligations.length > 0 ? obligations.filter(obligation => activeMemberIds.has(obligation.user_id)).length : activeMemberships.length;
  const paidCount = Math.min(paidUserIds.size, totalMembers);
  return {
    totalMembers,
    paidCount,
    unpaidCount: Math.max(totalMembers - paidCount, 0),
    paidUserIds,
    obligations,
  };
}

export async function getRoundObligationProgress(
  roundId: string,
  activeMemberships: MembershipRecord[],
  successfulContributionTransactions: TransactionRecord[] = [],
) {
  const obligations = await listRoundObligations(roundId);
  return deriveRoundObligationProgress(obligations, activeMemberships, successfulContributionTransactions);
}
