import { supabaseAdmin } from './supabaseAdmin.ts';
import { ensureContributionObligationsForRound } from './obligations.ts';
import type { GroupRecord, RoundRecord } from './types.ts';

export async function getOpenRound(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('Round')
    .select('*')
    .eq('Group_ID', groupId)
    .eq('Status', 'Open')
    .order('Round_Number', { ascending: false })
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as RoundRecord | null;
}

async function getLatestRound(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('Round')
    .select('*')
    .eq('Group_ID', groupId)
    .order('Round_Number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as RoundRecord | null;
}

async function listActiveMemberCount(groupId: string) {
  const { count, error } = await supabaseAdmin
    .from('GroupMembers')
    .select('Membership_ID', { count: 'exact', head: true })
    .eq('Group_ID', groupId)
    .eq('Status', 'Active');
  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function loadGroupTotalCycles(groupId: string, fallback: number) {
  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('approved_group_id', groupId)
    .eq('status', 'Approved')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return fallback;
  }

  const request = data?.[0] as { total_cycles?: number | null; terms_version?: string | null } | undefined;
  const metadataCycles = request?.terms_version?.match(/(?:^|\|)cycles=(\d+)/)?.[1];
  const totalCycles = Number(request?.total_cycles ?? metadataCycles ?? fallback);
  return Number.isFinite(totalCycles) && totalCycles > 0 ? totalCycles : fallback;
}

async function completeGroup(groupId: string) {
  const { error } = await supabaseAdmin
    .from('EqubGroup')
    .update({ Status: 'Completed' })
    .eq('Group_ID', groupId)
    .eq('Status', 'Active');
  if (error) {
    throw error;
  }
}

export async function ensureOpenRoundForGroup(group: GroupRecord) {
  const existingOpenRound = await getOpenRound(group.Group_ID);
  if (existingOpenRound) {
    await ensureContributionObligationsForRound(group, existingOpenRound);
    return existingOpenRound;
  }

  if (group.Status !== 'Active') {
    return null;
  }

  const latestRound = await getLatestRound(group.Group_ID);
  const nextRoundNumber = latestRound ? Number(latestRound.Round_Number) + 1 : 1;
  const totalCycles = await loadGroupTotalCycles(group.Group_ID, Math.max(await listActiveMemberCount(group.Group_ID), 1));
  if (latestRound && latestRound.Status === 'Completed' && Number(latestRound.Round_Number) >= totalCycles) {
    await completeGroup(group.Group_ID);
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('Round')
    .insert({
      Group_ID: group.Group_ID,
      Round_Number: nextRoundNumber,
      Status: 'Open',
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  const round = data as RoundRecord;
  await ensureContributionObligationsForRound(group, round);
  return round;
}
