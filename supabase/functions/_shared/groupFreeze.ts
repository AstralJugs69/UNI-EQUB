import { writeAuditEvent } from './audit.ts';
import { ledgerMemo, recordLedgerEntry } from './ledger.ts';
import { createNotification } from './notifications.ts';
import { supabaseAdmin } from './supabaseAdmin.ts';
import type {
  ContributionObligationRecord,
  GroupFreezeEventRecord,
  GroupFreezeResolutionAction,
  GroupRecord,
  MembershipRecord,
  PayoutRequestRecord,
  UserRecord,
} from './types.ts';

async function getGroup(groupId: string) {
  const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Group_ID', groupId).single();
  if (error) {
    throw error;
  }
  return data as GroupRecord;
}

async function listActiveMemberships(groupId: string) {
  const { data, error } = await supabaseAdmin.from('GroupMembers').select('*').eq('Group_ID', groupId).eq('Status', 'Active');
  if (error) {
    throw error;
  }
  return (data ?? []) as MembershipRecord[];
}

async function findOpenFreezeEvent(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_freeze_events')
    .select('*')
    .eq('group_id', groupId)
    .in('status', ['Open', 'UnderReview'])
    .order('frozen_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as GroupFreezeEventRecord | null;
}

async function notifyActiveMembers(groupId: string, input: {
  type: string;
  severity: 'Info' | 'Success' | 'Warning' | 'Error';
  title: string;
  message: string;
  freezeEventId?: string;
  metadata?: Record<string, unknown>;
}) {
  const memberships = await listActiveMemberships(groupId);
  await Promise.all(memberships.map(membership => createNotification({
    userId: membership.User_ID,
    type: input.type,
    severity: input.severity,
    title: input.title,
    message: input.message,
    actionRoute: 'member/group',
    relatedEntityType: 'group',
    relatedEntityId: groupId,
    metadata: { ...(input.metadata ?? {}), freeze_event_id: input.freezeEventId ?? null },
  })));
}

async function freezeDefaultingUserReserve(input: {
  groupId: string;
  userId: string;
  triggerObligationId?: string;
}) {
  const { data: payoutRequests, error } = await supabaseAdmin
    .from('payout_requests')
    .select('*')
    .eq('group_id', input.groupId)
    .eq('winner_user_id', input.userId)
    .in('status', ['Pending', 'PartiallyReleased']);
  if (error) {
    throw error;
  }

  const requests = (payoutRequests ?? []) as PayoutRequestRecord[];
  const availableReserveAmount = requests.reduce((sum, request) => sum + Number(request.reserved_amount ?? 0), 0);
  const payoutRequestIds = requests.map(request => request.id);

  if (payoutRequestIds.length) {
    const { error: requestError } = await supabaseAdmin
      .from('payout_requests')
      .update({ status: 'Frozen', failed_reason: 'Frozen after contribution default pending admin recovery review.' })
      .in('id', payoutRequestIds);
    if (requestError) {
      throw requestError;
    }

    const { error: scheduleError } = await supabaseAdmin
      .from('payout_release_schedules')
      .update({ status: 'Frozen' })
      .in('payout_request_id', payoutRequestIds)
      .eq('status', 'Pending');
    if (scheduleError) {
      throw scheduleError;
    }

    await Promise.all(requests.map(request => recordLedgerEntry(ledgerMemo({
      userId: input.userId,
      groupId: input.groupId,
      roundId: request.round_id,
      payoutRequestId: request.id,
      entryType: 'ReserveFrozen',
      amount: Number(request.reserved_amount ?? 0),
      description: 'Reserved payout frozen after contribution default.',
      referenceType: 'contribution_obligations',
      referenceId: input.triggerObligationId,
      metadata: {
        trigger_obligation_id: input.triggerObligationId,
        payout_request_status: request.status,
      },
    }))));
  }

  return {
    availableReserveAmount,
    payoutRequestIds,
  };
}

export async function createGroupFreezeEvent(input: {
  groupId: string;
  triggerUserId?: string | null;
  triggerRoundId?: string | null;
  triggerObligationId?: string | null;
  reason: string;
  actor?: UserRecord | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await findOpenFreezeEvent(input.groupId);
  if (existing) {
    return { freezeEvent: existing, created: false };
  }

  const frozenAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('group_freeze_events')
    .insert({
      group_id: input.groupId,
      trigger_user_id: input.triggerUserId ?? null,
      trigger_round_id: input.triggerRoundId ?? null,
      trigger_obligation_id: input.triggerObligationId ?? null,
      reason: input.reason,
      status: 'Open',
      frozen_at: frozenAt,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }

  const freezeEvent = data as GroupFreezeEventRecord;
  await writeAuditEvent({
    actor: input.actor ?? null,
    actorRole: input.actor ? undefined : 'System',
    eventType: 'group_freeze_event_created',
    entityType: 'group_freeze_event',
    entityId: freezeEvent.id,
    metadata: {
      group_id: input.groupId,
      trigger_user_id: input.triggerUserId,
      trigger_round_id: input.triggerRoundId,
      trigger_obligation_id: input.triggerObligationId,
      reason: input.reason,
      ...input.metadata,
    },
  });
  await notifyActiveMembers(input.groupId, {
    type: 'group_frozen',
    severity: 'Warning',
    title: 'Group frozen for review',
    message: 'A contribution default needs admin recovery review before the group continues.',
    freezeEventId: freezeEvent.id,
    metadata: { reason: input.reason },
  });

  return { freezeEvent, created: true };
}

export async function freezeGroupForAdminReview(input: {
  groupId: string;
  triggerUserId?: string | null;
  triggerRoundId?: string | null;
  triggerObligationId?: string | null;
  reason: string;
  actor?: UserRecord | null;
  metadata?: Record<string, unknown>;
}) {
  const group = await getGroup(input.groupId);
  const { data: updatedGroup, error } = await supabaseAdmin
    .from('EqubGroup')
    .update({ Status: 'Frozen' })
    .eq('Group_ID', input.groupId)
    .select('*')
    .single();
  if (error) {
    throw error;
  }

  const eventResult = await createGroupFreezeEvent({
    ...input,
    metadata: {
      previous_group_status: group.Status,
      ...input.metadata,
    },
  });

  return {
    group: updatedGroup as GroupRecord,
    freezeEvent: eventResult.freezeEvent,
    created: eventResult.created,
  };
}

export async function freezeGroupIfDefaultReserveInsufficient(obligation: ContributionObligationRecord) {
  const reserve = await freezeDefaultingUserReserve({
    groupId: obligation.group_id,
    userId: obligation.user_id,
    triggerObligationId: obligation.id,
  });
  const defaultAmount = Number(obligation.amount_due ?? 0);
  const reserveInsufficient = reserve.availableReserveAmount < defaultAmount;

  if (!reserveInsufficient) {
    await recordLedgerEntry(ledgerMemo({
      userId: obligation.user_id,
      groupId: obligation.group_id,
      roundId: obligation.round_id,
      entryType: 'DefaultOffset',
      amount: defaultAmount,
      description: 'Default exposure covered by frozen reserved payout.',
      referenceType: 'contribution_obligations',
      referenceId: obligation.id,
      metadata: {
        available_reserve_amount: reserve.availableReserveAmount,
        default_amount: defaultAmount,
        payout_request_ids: reserve.payoutRequestIds,
      },
    }));
    return {
      groupFrozen: false,
      freezeEvent: null as GroupFreezeEventRecord | null,
      reserve,
      defaultAmount,
      reserveInsufficient,
    };
  }

  const freeze = await freezeGroupForAdminReview({
    groupId: obligation.group_id,
    triggerUserId: obligation.user_id,
    triggerRoundId: obligation.round_id,
    triggerObligationId: obligation.id,
    reason: 'InsufficientReserveAfterDefault',
    metadata: {
      default_amount: defaultAmount,
      available_reserve_amount: reserve.availableReserveAmount,
      payout_request_ids: reserve.payoutRequestIds,
    },
  });

  return {
    groupFrozen: true,
    freezeEvent: freeze.freezeEvent,
    reserve,
    defaultAmount,
    reserveInsufficient,
  };
}

export async function resolveOpenGroupFreeze(input: {
  groupId: string;
  admin: UserRecord;
  resolutionAction: GroupFreezeResolutionAction;
  resolutionNote?: string;
}) {
  const event = await findOpenFreezeEvent(input.groupId);
  if (!event) {
    throw new Error('No open freeze event was found for this group.');
  }

  const resolvedAt = new Date().toISOString();
  const status = input.resolutionAction === 'ContinueWithReserveFrozen'
    ? 'ResolvedContinue'
    : 'ResolvedKeepFrozen';
  const nextGroupStatus = input.resolutionAction === 'ContinueWithReserveFrozen'
    ? 'Active'
    : 'Frozen';

  const [{ data: updatedEvent, error: eventError }, { data: updatedGroup, error: groupError }] = await Promise.all([
    supabaseAdmin
      .from('group_freeze_events')
      .update({
        status,
        resolved_at: resolvedAt,
        resolved_by: input.admin.User_ID,
        resolution_action: input.resolutionAction,
        resolution_note: input.resolutionNote ?? null,
      })
      .eq('id', event.id)
      .select('*')
      .single(),
    supabaseAdmin
      .from('EqubGroup')
      .update({ Status: nextGroupStatus })
      .eq('Group_ID', input.groupId)
      .select('*')
      .single(),
  ]);
  if (eventError) {
    throw eventError;
  }
  if (groupError) {
    throw groupError;
  }

  await writeAuditEvent({
    actor: input.admin,
    eventType: 'group_freeze_event_resolved',
    entityType: 'group_freeze_event',
    entityId: event.id,
    metadata: {
      group_id: input.groupId,
      resolution_action: input.resolutionAction,
      next_group_status: nextGroupStatus,
      resolution_note: input.resolutionNote,
    },
  });
  const resolvedTitle = input.resolutionAction === 'ContinueWithReserveFrozen'
    ? 'Group resumed'
    : input.resolutionAction === 'CreateRefundTickets'
      ? 'Refund tickets created'
      : 'Group remains frozen';
  const resolvedMessage = input.resolutionAction === 'ContinueWithReserveFrozen'
    ? 'Admin reviewed the default case and resumed the group.'
    : input.resolutionAction === 'CreateRefundTickets'
      ? 'The frozen group case was closed with simulated refund tickets.'
      : 'Admin reviewed the default case and kept the group frozen for follow-up.';

  await notifyActiveMembers(input.groupId, {
    type: 'group_freeze_resolved',
    severity: nextGroupStatus === 'Active' ? 'Success' : 'Warning',
    title: resolvedTitle,
    message: resolvedMessage,
    freezeEventId: event.id,
    metadata: {
      resolution_action: input.resolutionAction,
      next_group_status: nextGroupStatus,
    },
  });

  return {
    freezeEvent: updatedEvent as GroupFreezeEventRecord,
    group: updatedGroup as GroupRecord,
  };
}
