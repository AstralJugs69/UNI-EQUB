import { supabaseAdmin } from './supabaseAdmin.ts';
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

export async function ensureOpenRoundForGroup(group: GroupRecord) {
  const existingOpenRound = await getOpenRound(group.Group_ID);
  if (existingOpenRound) {
    return existingOpenRound;
  }

  if (group.Status !== 'Active') {
    return null;
  }

  const latestRound = await getLatestRound(group.Group_ID);
  const nextRoundNumber = latestRound ? Number(latestRound.Round_Number) + 1 : 1;

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
  return data as RoundRecord;
}
