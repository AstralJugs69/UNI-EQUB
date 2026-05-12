import { loadConfigValue } from './config.ts';
import { supabaseAdmin } from './supabaseAdmin.ts';
import type { UserReliabilityProfileRecord, UserRestrictionRecord } from './types.ts';

export async function getReliabilityProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_reliability_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as UserReliabilityProfileRecord | null;
}

export async function ensureReliabilityProfile(userId: string) {
  const existing = await getReliabilityProfile(userId);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from('user_reliability_profiles')
    .upsert({ user_id: userId, public_status: 'New' }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as UserReliabilityProfileRecord;
}

export async function listActiveRestrictions(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_restrictions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'Active');

  if (error) {
    throw error;
  }
  return (data ?? []) as UserRestrictionRecord[];
}

export async function countActiveGroupsForUser(userId: string) {
  const { count, error } = await supabaseAdmin
    .from('GroupMembers')
    .select('Membership_ID', { count: 'exact', head: true })
    .eq('User_ID', userId)
    .eq('Status', 'Active');

  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function getReliabilityJoinGate(userId: string) {
  const [profile, restrictions, activeGroupCount, activeGroupLimit] = await Promise.all([
    ensureReliabilityProfile(userId),
    listActiveRestrictions(userId),
    countActiveGroupsForUser(userId),
    loadConfigValue<number>('new_user_active_group_limit', 1),
  ]);

  const blockedByRestriction = restrictions.length > 0 || profile.public_status === 'Restricted' || profile.public_status === 'Banned';
  const limitedByMaturity = ['New', 'BuildingTrust'].includes(profile.public_status) && activeGroupCount >= activeGroupLimit;

  return {
    profile,
    restrictions,
    activeGroupCount,
    activeGroupLimit,
    canJoinNormalGroup: !blockedByRestriction && !limitedByMaturity,
    blockedReason: blockedByRestriction
      ? 'User has an active reliability restriction.'
      : limitedByMaturity
        ? 'New or building-trust users can join only one active group.'
        : null,
  };
}
