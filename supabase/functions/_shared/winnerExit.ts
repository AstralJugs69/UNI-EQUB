import { writeAuditEvent } from './audit.ts';
import { loadConfigValue } from './config.ts';
import { freezeGroupForAdminReview } from './groupFreeze.ts';
import { createNotification } from './notifications.ts';
import { supabaseAdmin } from './supabaseAdmin.ts';
import type {
  GroupRecord,
  MembershipRecord,
  PayoutRequestRecord,
  RoundRecord,
  UserRecord,
  WinnerExitDecision,
  WinnerExitWindowRecord,
} from './types.ts';

export interface WinnerExitWindowSummary {
  window: WinnerExitWindowRecord;
  isCurrentWinner: boolean;
  payout: {
    totalPayoutAmount: number;
    immediateReleaseAmount: number;
    reservedAmount: number;
  };
}

async function listActiveMemberships(groupId: string) {
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

async function getWindowById(groupId: string, windowId: string) {
  const { data, error } = await supabaseAdmin
    .from('winner_exit_windows')
    .select('*')
    .eq('id', windowId)
    .eq('group_id', groupId)
    .single();
  if (error) {
    throw error;
  }
  return data as WinnerExitWindowRecord;
}

export async function getOpenWinnerExitWindow(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('winner_exit_windows')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'Open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as WinnerExitWindowRecord | null;
}

async function notifyGroup(group: GroupRecord, userIds: string[], input: {
  type: string;
  severity: 'Info' | 'Success' | 'Warning' | 'Error';
  title: string;
  message: string;
  windowId: string;
  roundId: string;
}) {
  await Promise.all([...new Set(userIds)].map(userId => createNotification({
    userId,
    type: input.type,
    severity: input.severity,
    title: input.title,
    message: input.message,
    actionRoute: 'member/group-cycle',
    relatedEntityType: 'EqubGroup',
    relatedEntityId: group.Group_ID,
    metadata: {
      winner_exit_window_id: input.windowId,
      round_id: input.roundId,
    },
  })));
}

function isExpired(window: WinnerExitWindowRecord) {
  return new Date(window.closes_at).getTime() <= Date.now();
}

async function updateWindowStatus(window: WinnerExitWindowRecord, status: WinnerExitWindowRecord['status'], metadata: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from('winner_exit_windows')
    .update({
      status,
      decision_at: new Date().toISOString(),
      metadata: {
        ...(window.metadata ?? {}),
        ...metadata,
      },
    })
    .eq('id', window.id)
    .eq('status', 'Open')
    .select('*')
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as WinnerExitWindowRecord | null;
}

export async function openWinnerExitWindow(input: {
  group: GroupRecord;
  round: RoundRecord;
  winnerId: string;
  payoutRequest: PayoutRequestRecord;
}) {
  const existing = await getOpenWinnerExitWindow(input.group.Group_ID);
  if (existing) {
    return existing;
  }

  const hours = await loadConfigValue<number>('winner_exit_window_hours', 24);
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + Math.max(1, Number(hours)) * 60 * 60 * 1000);
  const { data, error } = await supabaseAdmin
    .from('winner_exit_windows')
    .insert({
      group_id: input.group.Group_ID,
      round_id: input.round.Round_ID,
      winner_user_id: input.winnerId,
      status: 'Open',
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      metadata: {
        source: 'roundLifecycle.nonFinalDraw',
        payout_request_id: input.payoutRequest.id,
        round_number: input.round.Round_Number,
        total_payout_amount: Number(input.payoutRequest.total_payout_amount ?? 0),
        immediate_release_amount: Number(input.payoutRequest.immediate_release_amount ?? 0),
        reserved_amount: Number(input.payoutRequest.reserved_amount ?? 0),
      },
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }

  const window = data as WinnerExitWindowRecord;
  const activeMemberships = await listActiveMemberships(input.group.Group_ID);
  await writeAuditEvent({
    actor: null,
    actorRole: 'System',
    eventType: 'winner_exit_window_opened',
    entityType: 'winner_exit_windows',
    entityId: window.id,
    metadata: {
      group_id: input.group.Group_ID,
      round_id: input.round.Round_ID,
      winner_user_id: input.winnerId,
      closes_at: window.closes_at,
    },
  });
  await notifyGroup(input.group, activeMemberships.map(item => item.User_ID), {
    type: 'winner_exit_window_opened',
    severity: 'Info',
    title: 'Winner decision opened',
    message: 'The round winner can continue or exit before the next round opens.',
    windowId: window.id,
    roundId: input.round.Round_ID,
  });

  return window;
}

export async function continueExpiredWinnerExitWindow(group: GroupRecord) {
  const window = await getOpenWinnerExitWindow(group.Group_ID);
  if (!window || !isExpired(window)) {
    return null;
  }
  const updated = await updateWindowStatus(window, 'Continued', {
    decision: 'Continue',
    decision_source: 'expiry_default_continue',
  });
  if (!updated) {
    return null;
  }
  const activeMemberships = await listActiveMemberships(group.Group_ID);
  await writeAuditEvent({
    actor: null,
    actorRole: 'System',
    eventType: 'winner_exit_window_expired_continued',
    entityType: 'winner_exit_windows',
    entityId: updated.id,
    metadata: {
      group_id: group.Group_ID,
      round_id: updated.round_id,
      winner_user_id: updated.winner_user_id,
    },
  });
  await notifyGroup(group, activeMemberships.map(item => item.User_ID), {
    type: 'winner_continued_group',
    severity: 'Success',
    title: 'Next round opening',
    message: 'The winner decision window closed, so this Equb is continuing.',
    windowId: updated.id,
    roundId: updated.round_id,
  });
  return updated;
}

export async function getWinnerExitWindowSummary(groupId: string, currentUserId?: string): Promise<WinnerExitWindowSummary | null> {
  const window = await getOpenWinnerExitWindow(groupId);
  if (!window) {
    return null;
  }
  return {
    window,
    isCurrentWinner: window.winner_user_id === currentUserId,
    payout: {
      totalPayoutAmount: Number(window.metadata?.total_payout_amount ?? 0),
      immediateReleaseAmount: Number(window.metadata?.immediate_release_amount ?? 0),
      reservedAmount: Number(window.metadata?.reserved_amount ?? 0),
    },
  };
}

export async function decideWinnerExitWindow(input: {
  group: GroupRecord;
  windowId: string;
  decision: WinnerExitDecision;
  actor: UserRecord;
}) {
  const window = await getWindowById(input.group.Group_ID, input.windowId);
  if (window.status !== 'Open') {
    throw new Error('This winner decision window is already closed.');
  }
  if (isExpired(window)) {
    const continued = await continueExpiredWinnerExitWindow(input.group);
    return {
      window: continued ?? window,
      decision: 'Continue' as WinnerExitDecision,
      shouldOpenNextRound: true,
      groupFrozen: false,
    };
  }
  if (input.actor.Role !== 'Admin' && input.actor.User_ID !== window.winner_user_id) {
    throw new Error('Only the round winner can choose whether to exit.');
  }

  const activeMemberships = await listActiveMemberships(input.group.Group_ID);
  if (!activeMemberships.some(item => item.User_ID === window.winner_user_id)) {
    throw new Error('The round winner is no longer an active member of this group.');
  }

  if (input.decision === 'Continue') {
    const updated = await updateWindowStatus(window, 'Continued', {
      decision: 'Continue',
      decision_source: input.actor.Role === 'Admin' ? 'admin_or_controller' : 'winner',
      decided_by: input.actor.User_ID,
    });
    if (!updated) {
      throw new Error('This winner decision window is already closed.');
    }
    await writeAuditEvent({
      actor: input.actor,
      eventType: 'winner_exit_window_continued',
      entityType: 'winner_exit_windows',
      entityId: updated.id,
      metadata: {
        group_id: input.group.Group_ID,
        round_id: updated.round_id,
        winner_user_id: updated.winner_user_id,
      },
    });
    await notifyGroup(input.group, activeMemberships.map(item => item.User_ID), {
      type: 'winner_continued_group',
      severity: 'Success',
      title: 'Winner continued',
      message: 'The winner chose to continue, so the next round is opening.',
      windowId: updated.id,
      roundId: updated.round_id,
    });
    return { window: updated, decision: input.decision, shouldOpenNextRound: true, groupFrozen: false };
  }

  const remainingActiveUserIds = activeMemberships
    .map(item => item.User_ID)
    .filter(userId => userId !== window.winner_user_id);
  const { error: membershipError } = await supabaseAdmin
    .from('GroupMembers')
    .update({ Status: 'Left' })
    .eq('Group_ID', input.group.Group_ID)
    .eq('User_ID', window.winner_user_id)
    .eq('Status', 'Active');
  if (membershipError) {
    throw membershipError;
  }

  const updated = await updateWindowStatus(window, 'Exited', {
    decision: 'Exit',
    decision_source: input.actor.Role === 'Admin' ? 'admin_or_controller' : 'winner',
    decided_by: input.actor.User_ID,
    remaining_active_user_ids: remainingActiveUserIds,
  });
  if (!updated) {
    throw new Error('This winner decision window is already closed.');
  }

  await writeAuditEvent({
    actor: input.actor,
    eventType: 'winner_exited_after_draw',
    entityType: 'winner_exit_windows',
    entityId: updated.id,
    metadata: {
      group_id: input.group.Group_ID,
      round_id: updated.round_id,
      winner_user_id: updated.winner_user_id,
      remaining_member_count: remainingActiveUserIds.length,
    },
  });
  await notifyGroup(input.group, [...remainingActiveUserIds, window.winner_user_id], {
    type: 'winner_exited_group',
    severity: remainingActiveUserIds.length >= 2 ? 'Info' : 'Warning',
    title: remainingActiveUserIds.length >= 2 ? 'Winner exited' : 'Group needs review',
    message: remainingActiveUserIds.length >= 2
      ? 'The winner exited after receiving their draw. The next round will continue with remaining members.'
      : 'The winner exited and too few members remain, so the group is paused for admin review.',
    windowId: updated.id,
    roundId: updated.round_id,
  });

  if (remainingActiveUserIds.length < 2) {
    await freezeGroupForAdminReview({
      groupId: input.group.Group_ID,
      triggerUserId: window.winner_user_id,
      triggerRoundId: window.round_id,
      reason: 'WinnerExitTooFewMembers',
      actor: input.actor,
      metadata: {
        source: 'winner_exit_window',
        winner_exit_window_id: window.id,
        remaining_active_user_ids: remainingActiveUserIds,
      },
    });
    return { window: updated, decision: input.decision, shouldOpenNextRound: false, groupFrozen: true };
  }

  return { window: updated, decision: input.decision, shouldOpenNextRound: true, groupFrozen: false };
}
