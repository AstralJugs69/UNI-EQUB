import { writeAuditEvent } from './audit.ts';
import { createNotification } from './notifications.ts';
import { ensureContributionObligationsForRound } from './obligations.ts';
import { ensureOpenRoundForGroup } from './rounds.ts';
import { supabaseAdmin } from './supabaseAdmin.ts';
import type { GroupRecord, GroupRequestRecord, MembershipRecord, RoundRecord, UserRecord } from './types.ts';

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

function readGraceHours(request: GroupRequestRecord | null | undefined) {
  const explicit = Number(request?.grace_period_hours);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  const match = request?.terms_version?.match(/(?:^|\|)grace=(\d+)/);
  const embedded = match ? Number(match[1]) : 6;
  return Number.isFinite(embedded) && embedded > 0 ? embedded : 6;
}

function contributionTimingForRequest(group: GroupRecord, request: GroupRequestRecord | null | undefined) {
  const dueAt = new Date(Date.now() + contributionWindowMs(group.Frequency));
  const graceEndsAt = new Date(dueAt.getTime() + readGraceHours(request) * 60 * 60 * 1000);
  return {
    dueAt: dueAt.toISOString(),
    graceEndsAt: graceEndsAt.toISOString(),
  };
}

export async function getApprovedRequestForGroup(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('approved_group_id', groupId)
    .eq('status', 'Approved')
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as GroupRequestRecord | null;
}

export async function listActiveMemberships(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('GroupMembers')
    .select('*')
    .eq('Group_ID', groupId)
    .eq('Status', 'Active');

  if (error) {
    throw error;
  }
  return (data ?? []) as MembershipRecord[];
}

async function notifyMembersOfActivation(group: GroupRecord, memberships: MembershipRecord[]) {
  const notifications = [];
  for (const membership of memberships) {
    notifications.push(await createNotification({
      userId: membership.User_ID,
      type: 'GroupCycleActivated',
      severity: 'Success',
      title: 'Contribution cycle started',
      message: `${group.Group_Name} is now active. Your first contribution window is open.`,
      actionRoute: 'member/group',
      relatedEntityType: 'EqubGroup',
      relatedEntityId: group.Group_ID,
      metadata: {
        group_id: group.Group_ID,
      },
    }));
  }
  return notifications;
}

export async function activateApprovedGroup(input: {
  group: GroupRecord;
  request?: GroupRequestRecord | null;
  actor?: UserRecord | null;
  reason: 'MaxMembersReached' | 'JoinWindowElapsed' | 'Manual';
}) {
  if (input.group.Status === 'Active') {
    return {
      activated: false,
      group: input.group,
      round: await ensureOpenRoundForGroup(input.group) as RoundRecord,
      obligations: [],
      reason: 'AlreadyActive',
    };
  }
  if (input.group.Status !== 'Pending') {
    return {
      activated: false,
      group: input.group,
      round: null,
      obligations: [],
      reason: 'NotPending',
    };
  }

  const { data: updatedGroup, error: groupError } = await supabaseAdmin
    .from('EqubGroup')
    .update({
      Status: 'Active',
      Start_Date: new Date().toISOString().slice(0, 10),
    })
    .eq('Group_ID', input.group.Group_ID)
    .eq('Status', 'Pending')
    .select('*')
    .single();

  if (groupError) {
    throw groupError;
  }

  const activeGroup = updatedGroup as GroupRecord;
  const request = input.request ?? await getApprovedRequestForGroup(activeGroup.Group_ID);
  const round = await ensureOpenRoundForGroup(activeGroup) as RoundRecord;
  const obligations = await ensureContributionObligationsForRound(activeGroup, round, contributionTimingForRequest(activeGroup, request));
  const memberships = await listActiveMemberships(activeGroup.Group_ID);
  const now = new Date().toISOString();

  if (request) {
    const { error: requestError } = await supabaseAdmin
      .from('group_requests')
      .update({ activated_at: now })
      .eq('id', request.id)
      .is('activated_at', null);
    if (requestError) {
      throw requestError;
    }
  }

  const notifications = await notifyMembersOfActivation(activeGroup, memberships);
  await writeAuditEvent({
    actor: input.actor ?? null,
    eventType: 'group_cycle_activated',
    entityType: 'EqubGroup',
    entityId: activeGroup.Group_ID,
    metadata: {
      reason: input.reason,
      round_id: round.Round_ID,
      obligation_count: obligations.length,
      notification_count: notifications.length,
      group_request_id: request?.id ?? null,
    },
  });

  return {
    activated: true,
    group: activeGroup,
    round,
    obligations,
    reason: input.reason,
  };
}

export async function activateApprovedGroupIfReady(input: {
  group: GroupRecord;
  request?: GroupRequestRecord | null;
  actor?: UserRecord | null;
  now?: Date;
}) {
  if (input.group.Status !== 'Pending') {
    return {
      activated: false,
      group: input.group,
      round: null,
      obligations: [],
      reason: 'NotPending',
    };
  }

  const request = input.request ?? await getApprovedRequestForGroup(input.group.Group_ID);
  const memberships = await listActiveMemberships(input.group.Group_ID);
  const maxReached = memberships.length >= input.group.Max_Members;
  const windowEndsAt = request?.join_window_ends_at ? new Date(request.join_window_ends_at).getTime() : null;
  const windowElapsed = windowEndsAt !== null && windowEndsAt <= (input.now ?? new Date()).getTime();

  if (!maxReached && !windowElapsed) {
    return {
      activated: false,
      group: input.group,
      round: null,
      obligations: [],
      reason: 'WaitingForMembers',
    };
  }

  return activateApprovedGroup({
    group: input.group,
    request,
    actor: input.actor,
    reason: maxReached ? 'MaxMembersReached' : 'JoinWindowElapsed',
  });
}

export async function activateDueApprovedGroups(now = new Date()) {
  const { data, error } = await supabaseAdmin
    .from('EqubGroup')
    .select('*')
    .eq('Status', 'Pending');

  if (error) {
    throw error;
  }

  const results = [];
  for (const group of (data ?? []) as GroupRecord[]) {
    const request = await getApprovedRequestForGroup(group.Group_ID);
    if (!request) {
      continue;
    }
    results.push(await activateApprovedGroupIfReady({ group, request, now }));
  }
  return results;
}
