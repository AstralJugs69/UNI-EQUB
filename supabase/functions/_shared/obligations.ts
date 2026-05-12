import { supabaseAdmin } from './supabaseAdmin.ts';
import type { ContributionObligationRecord, ContributionObligationStatus, GroupRecord, MembershipRecord, RoundRecord } from './types.ts';

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
