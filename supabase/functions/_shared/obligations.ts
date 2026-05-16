import { supabaseAdmin } from './supabaseAdmin.ts';
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

export async function ensureContributionObligationsForRound(group: GroupRecord, round: RoundRecord, timing?: { dueAt?: string; graceEndsAt?: string }) {
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
    due_at: timing?.dueAt ?? null,
    grace_ends_at: timing?.graceEndsAt ?? null,
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
