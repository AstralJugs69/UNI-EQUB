import { loadConfigValue } from './config.ts';
import { supabaseAdmin } from './supabaseAdmin.ts';
import type { ContributionObligationRecord, ReliabilityPublicStatus, UserReliabilityProfileRecord, UserRestrictionRecord } from './types.ts';

const IMPERFECT_OBLIGATION_STATUSES = new Set(['Late', 'Defaulted']);

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

export function deriveReliabilityPublicStatus(input: {
  existingStatus?: ReliabilityPublicStatus;
  completedGroupsCount: number;
  perfectCompletedGroupsCount: number;
  currentMaturityCompletedCount: number;
  defaultCount: number;
  restrictionCount: number;
  hasActiveRestriction: boolean;
  trustedThreshold: number;
}): ReliabilityPublicStatus {
  if (input.existingStatus === 'Banned') {
    return 'Banned';
  }

  if (input.hasActiveRestriction) {
    return 'Restricted';
  }

  if (input.currentMaturityCompletedCount >= input.trustedThreshold) {
    return 'Trusted';
  }

  if (input.completedGroupsCount > 0) {
    return 'BuildingTrust';
  }

  return 'New';
}

async function updateReliabilityProfile(
  userId: string,
  changes: Partial<Omit<UserReliabilityProfileRecord, 'user_id'>>,
) {
  const { data, error } = await supabaseAdmin
    .from('user_reliability_profiles')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as UserReliabilityProfileRecord;
}

async function getTrustedThreshold() {
  return loadConfigValue<number>('required_perfect_groups_for_trusted_status', 3);
}

async function deriveStatusForProfile(profile: UserReliabilityProfileRecord, hasActiveRestriction?: boolean) {
  const restrictions = hasActiveRestriction === undefined ? await listActiveRestrictions(profile.user_id) : [];
  const trustedThreshold = await getTrustedThreshold();

  return deriveReliabilityPublicStatus({
    existingStatus: profile.public_status,
    completedGroupsCount: Number(profile.completed_groups_count),
    perfectCompletedGroupsCount: Number(profile.perfect_completed_groups_count),
    currentMaturityCompletedCount: Number(profile.current_maturity_completed_count),
    defaultCount: Number(profile.default_count),
    restrictionCount: Number(profile.restriction_count),
    hasActiveRestriction: hasActiveRestriction ?? restrictions.length > 0,
    trustedThreshold,
  });
}

async function listUserGroupObligations(groupId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
  return (data ?? []) as ContributionObligationRecord[];
}

async function updateRestrictionRecoveryProgress(userId: string) {
  const activeRestrictions = await listActiveRestrictions(userId);
  const updatedRestrictions: UserRestrictionRecord[] = [];

  for (const restriction of activeRestrictions) {
    const completedRecoveryGroups = Number(restriction.completed_recovery_groups) + 1;
    const changes: Partial<UserRestrictionRecord> = {
      completed_recovery_groups: completedRecoveryGroups,
    };

    if (restriction.required_recovery_groups > 0 && completedRecoveryGroups >= restriction.required_recovery_groups) {
      changes.status = 'ClearedByRecovery';
      changes.cleared_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('user_restrictions')
      .update(changes)
      .eq('id', restriction.id)
      .eq('status', 'Active')
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (data) {
      updatedRestrictions.push(data as UserRestrictionRecord);
    }
  }

  return updatedRestrictions;
}

export async function recordCompletedGroupReliability(groupId: string, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
  const updatedProfiles: UserReliabilityProfileRecord[] = [];

  for (const userId of uniqueUserIds) {
    const profile = await ensureReliabilityProfile(userId);
    const obligations = await listUserGroupObligations(groupId, userId);
    const hadLateOrDefault = obligations.some(obligation => IMPERFECT_OBLIGATION_STATUSES.has(obligation.status));
    const completedGroupsCount = Number(profile.completed_groups_count) + 1;
    const perfectCompletedGroupsCount = Number(profile.perfect_completed_groups_count) + (hadLateOrDefault ? 0 : 1);
    const currentMaturityCompletedCount = hadLateOrDefault ? 0 : Number(profile.current_maturity_completed_count) + 1;

    if (!hadLateOrDefault) {
      await updateRestrictionRecoveryProgress(userId);
    }

    const activeRestrictions = await listActiveRestrictions(userId);
    const trustedThreshold = await getTrustedThreshold();
    const publicStatus = deriveReliabilityPublicStatus({
      existingStatus: profile.public_status,
      completedGroupsCount,
      perfectCompletedGroupsCount,
      currentMaturityCompletedCount,
      defaultCount: Number(profile.default_count),
      restrictionCount: Number(profile.restriction_count),
      hasActiveRestriction: activeRestrictions.length > 0,
      trustedThreshold,
    });

    const updated = await updateReliabilityProfile(userId, {
      completed_groups_count: completedGroupsCount,
      perfect_completed_groups_count: perfectCompletedGroupsCount,
      current_maturity_completed_count: currentMaturityCompletedCount,
      public_status: publicStatus,
    });
    updatedProfiles.push(updated);
  }

  return updatedProfiles;
}

export async function recordLatePaymentReliability(userId: string) {
  const profile = await ensureReliabilityProfile(userId);
  const latePaymentCount = Number(profile.late_payment_count) + 1;
  const changedProfile = {
    ...profile,
    late_payment_count: latePaymentCount,
    current_maturity_completed_count: 0,
  };

  return updateReliabilityProfile(userId, {
    late_payment_count: latePaymentCount,
    current_maturity_completed_count: 0,
    public_status: await deriveStatusForProfile(changedProfile),
  });
}

export async function recordDefaultReliability(userId: string) {
  const profile = await ensureReliabilityProfile(userId);
  const defaultCount = Number(profile.default_count) + 1;
  const changedProfile = {
    ...profile,
    default_count: defaultCount,
    current_maturity_completed_count: 0,
  };

  return updateReliabilityProfile(userId, {
    default_count: defaultCount,
    current_maturity_completed_count: 0,
    public_status: await deriveStatusForProfile(changedProfile, true),
  });
}

export async function recordRestrictionReliability(userId: string) {
  const profile = await ensureReliabilityProfile(userId);
  const restrictionCount = Number(profile.restriction_count) + 1;
  const changedProfile = {
    ...profile,
    restriction_count: restrictionCount,
    current_maturity_completed_count: 0,
  };

  return updateReliabilityProfile(userId, {
    restriction_count: restrictionCount,
    current_maturity_completed_count: 0,
    public_status: await deriveStatusForProfile(changedProfile, true),
  });
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

export async function ensureActiveRestriction(input: {
  userId: string;
  restrictionType: string;
  reason: string;
  createdBy?: string | null;
  requiredRecoveryGroups?: number;
}) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('user_restrictions')
    .select('*')
    .eq('user_id', input.userId)
    .eq('restriction_type', input.restrictionType)
    .eq('status', 'Active')
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }
  if (existing) {
    return { restriction: existing as UserRestrictionRecord, created: false };
  }

  const requiredRecoveryGroups = input.requiredRecoveryGroups
    ?? await loadConfigValue<number>('required_perfect_groups_for_trusted_status', 3);
  const { data, error } = await supabaseAdmin
    .from('user_restrictions')
    .insert({
      user_id: input.userId,
      restriction_type: input.restrictionType,
      reason: input.reason,
      created_by: input.createdBy ?? null,
      required_recovery_groups: requiredRecoveryGroups,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await recordRestrictionReliability(input.userId);
  return { restriction: data as UserRestrictionRecord, created: true };
}

export async function getReliabilityRestrictionGate(userId: string) {
  const [profile, restrictions] = await Promise.all([
    ensureReliabilityProfile(userId),
    listActiveRestrictions(userId),
  ]);
  const blocked = restrictions.length > 0 || profile.public_status === 'Restricted' || profile.public_status === 'Banned';

  return {
    profile,
    restrictions,
    canUseNormalFlows: !blocked,
    blockedReason: blocked
      ? 'User has an active reliability restriction.'
      : null,
  };
}

export async function assertReliabilityAllowsNormalFlow(userId: string) {
  const gate = await getReliabilityRestrictionGate(userId);
  if (!gate.canUseNormalFlows) {
    throw new Error(gate.blockedReason ?? 'User is not eligible for normal flows.');
  }
  return gate;
}

export async function countActiveGroupsForUser(userId: string) {
  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('GroupMembers')
    .select('Group_ID')
    .eq('User_ID', userId)
    .eq('Status', 'Active');

  if (membershipError) {
    throw membershipError;
  }

  const groupIds = [...new Set((memberships ?? []).map(item => (item as { Group_ID: string }).Group_ID))];
  if (!groupIds.length) {
    return 0;
  }

  const { count, error: groupError } = await supabaseAdmin
    .from('EqubGroup')
    .select('Group_ID', { count: 'exact', head: true })
    .in('Group_ID', groupIds)
    .eq('Status', 'Active');

  if (groupError) {
    throw groupError;
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
