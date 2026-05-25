import { supabaseAdmin } from './supabaseAdmin.ts';
import { ensureContributionObligationsForRound } from './obligations.ts';
import { continueExpiredWinnerExitWindow, getOpenWinnerExitWindow } from './winnerExit.ts';
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

async function listActiveMemberIds(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('GroupMembers')
    .select('User_ID')
    .eq('Group_ID', groupId)
    .eq('Status', 'Active');
  if (error) {
    throw error;
  }
  return (data ?? []).map(item => (item as { User_ID: string }).User_ID);
}

async function listWinnerIdsSince(groupId: string, minRoundNumber: number) {
  const { data, error } = await supabaseAdmin
    .from('Round')
    .select('Winner_ID')
    .eq('Group_ID', groupId)
    .gte('Round_Number', minRoundNumber)
    .not('Winner_ID', 'is', null);
  if (error) {
    throw error;
  }
  return new Set((data ?? []).map(item => (item as { Winner_ID: string }).Winner_ID));
}

async function getCurrentPassStartRoundNumber(groupId: string) {
  const { data: events, error: eventError } = await supabaseAdmin
    .from('group_freeze_events')
    .select('trigger_round_id, resolved_at')
    .eq('group_id', groupId)
    .eq('reason', 'CycleCompletionVote')
    .eq('status', 'ResolvedContinue')
    .order('resolved_at', { ascending: false, nullsFirst: false })
    .limit(1);
  if (eventError) {
    throw eventError;
  }
  const triggerRoundId = (events?.[0] as { trigger_round_id?: string | null } | undefined)?.trigger_round_id;
  if (!triggerRoundId) {
    return 1;
  }
  const { data: round, error: roundError } = await supabaseAdmin
    .from('Round')
    .select('Round_Number')
    .eq('Round_ID', triggerRoundId)
    .maybeSingle();
  if (roundError) {
    throw roundError;
  }
  return Number((round as { Round_Number?: number } | null)?.Round_Number ?? 0) + 1;
}

async function hasContinuationApproval(groupId: string, roundId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_freeze_events')
    .select('id')
    .eq('group_id', groupId)
    .eq('trigger_round_id', roundId)
    .eq('reason', 'CycleCompletionVote')
    .eq('status', 'ResolvedContinue')
    .limit(1);
  if (error) {
    throw error;
  }
  return !!data?.length;
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
  if (latestRound && latestRound.Status === 'Completed') {
    const exitWindow = await getOpenWinnerExitWindow(group.Group_ID);
    if (exitWindow) {
      const continued = await continueExpiredWinnerExitWindow(group);
      if (!continued) {
        return null;
      }
    }
    const activeMemberIds = await listActiveMemberIds(group.Group_ID);
    const currentPassStartRound = await getCurrentPassStartRoundNumber(group.Group_ID);
    const winnerIds = await listWinnerIdsSince(group.Group_ID, currentPassStartRound);
    if (
      activeMemberIds.length > 0
      && activeMemberIds.every(userId => winnerIds.has(userId))
      && !await hasContinuationApproval(group.Group_ID, latestRound.Round_ID)
    ) {
      await completeGroup(group.Group_ID);
      return null;
    }
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
