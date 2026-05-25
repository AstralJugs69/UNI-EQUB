import { fail, failFromError, json } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { createNotification } from '../_shared/notifications.ts';
import {
  ensureContributionObligationsForRound,
  getContributionObligationForUserRound,
  listRoundObligations,
  markContributionObligationLate,
  markContributionObligationPaid,
  processDueContributionObligations,
} from '../_shared/obligations.ts';
import { activateApprovedGroup } from '../_shared/groupActivation.ts';
import { freezeGroupForAdminReview, resolveOpenGroupFreeze } from '../_shared/groupFreeze.ts';
import { closeResolutionPollIfReady, createFrozenGroupResolutionPoll } from '../_shared/groupResolution.ts';
import { finalizeRoundIfReady } from '../_shared/roundLifecycle.ts';
import { ensureOpenRoundForGroup } from '../_shared/rounds.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { continueExpiredWinnerExitWindow, decideWinnerExitWindow } from '../_shared/winnerExit.ts';
import type { ContributionObligationRecord, GroupRecord, MembershipRecord, RefundTicketRecord, RoundRecord, TransactionRecord, UserRecord, WinnerExitWindowRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-uniequb-controller-secret',
};

interface SimulationCommand {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  issuedAt: string;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

async function requireAdmin(token: string) {
  const payload = await verifySession(token);
  const userId = payload.sub;
  if (!userId) {
    throw new Error('Invalid session token.');
  }
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw error;
  }
  const user = data as UserRecord;
  if (user.Role !== 'Admin') {
    throw new Error('Admin access is required for simulation control.');
  }
  return user;
}

function assertControllerSecret(request: Request, body: Record<string, unknown>) {
  const expected = Deno.env.get('UNIEQUB_CONTROLLER_SECRET');
  if (!expected) {
    throw new Error('Controller secret is not configured.');
  }
  const provided = request.headers.get('x-uniequb-controller-secret') ?? (typeof body.controllerSecret === 'string' ? body.controllerSecret : '');
  if (provided !== expected) {
    throw new Error('Controller secret is invalid.');
  }
}

async function snapshot() {
  const [
    { data: groups, error: groupsError },
    { data: rounds, error: roundsError },
    { data: memberships, error: membershipsError },
    { data: transactions, error: transactionsError },
    { data: events, error: eventsError },
    { data: groupRequests, error: groupRequestsError },
    { data: joinRequests, error: joinRequestsError },
    { data: freezeEvents, error: freezeEventsError },
    { data: resolutionPolls, error: resolutionPollsError },
    { data: winnerExitWindows, error: winnerExitWindowsError },
  ] = await Promise.all([
    supabaseAdmin.from('EqubGroup').select('*').order('Start_Date', { ascending: false, nullsFirst: false }),
    supabaseAdmin.from('Round').select('*').order('Round_Number', { ascending: true }),
    supabaseAdmin.from('GroupMembers').select('*').order('Joined_At', { ascending: false }),
    supabaseAdmin.from('Transaction').select('*').order('Date', { ascending: false }).limit(100),
    supabaseAdmin.from('simulation_events').select('*').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('group_requests').select('*').order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('group_join_requests').select('*').order('requested_at', { ascending: false }).limit(200),
    supabaseAdmin.from('group_freeze_events').select('*').order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('group_resolution_polls').select('*').order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('winner_exit_windows').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  for (const error of [groupsError, roundsError, membershipsError, transactionsError, eventsError, groupRequestsError, joinRequestsError, freezeEventsError, resolutionPollsError, winnerExitWindowsError]) {
    if (error) {
      throw error;
    }
  }

  const allGroups = (groups ?? []) as GroupRecord[];
  const groupIds = allGroups.map(group => group.Group_ID);
  const visibleRounds = ((rounds ?? []) as RoundRecord[]).filter(round => groupIds.includes(round.Group_ID));
  const visibleRoundIds = visibleRounds.map(round => round.Round_ID);
  const visibleMemberships = ((memberships ?? []) as MembershipRecord[]).filter(membership => groupIds.includes(membership.Group_ID));

  const [{ data: users, error: usersError }, { data: obligations, error: obligationsError }] = await Promise.all([
    supabaseAdmin.from('User').select('User_ID, Full_Name, Phone_Number, KYC_Status, Role, Created_At').order('Created_At', { ascending: false }).limit(200),
    groupIds.length
      ? supabaseAdmin.from('contribution_obligations').select('*').in('group_id', groupIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const error of [usersError, obligationsError]) {
    if (error) {
      throw error;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    groups: allGroups,
    rounds: visibleRounds,
    memberships: visibleMemberships,
    users: users ?? [],
    obligations: (obligations ?? []) as ContributionObligationRecord[],
    transactions: ((transactions ?? []) as TransactionRecord[]).filter(transaction => visibleRoundIds.includes(transaction.Round_ID)),
    groupRequests: groupRequests ?? [],
    joinRequests: joinRequests ?? [],
    freezeEvents: freezeEvents ?? [],
    resolutionPolls: resolutionPolls ?? [],
    winnerExitWindows: ((winnerExitWindows ?? []) as WinnerExitWindowRecord[]).filter(window => groupIds.includes(window.group_id)),
    events: (events ?? []).map(event => ({
      id: event.id,
      commandType: event.command_type,
      actorUserId: event.actor_user_id,
      entityType: event.entity_type,
      entityId: event.entity_id,
      createdAt: event.created_at,
      metadata: event.metadata ?? {},
    })),
  };
}

async function logCommand(actor: UserRecord, command: SimulationCommand) {
  await supabaseAdmin.from('simulation_events').insert({
    command_id: command.id,
    command_type: command.type,
    actor_user_id: actor.User_ID,
    entity_type: typeof command.payload.entityType === 'string' ? command.payload.entityType : null,
    entity_id: typeof command.payload.entityId === 'string' ? command.payload.entityId : null,
    metadata: command.payload,
  });
}

async function requireGroup(groupId: string) {
  const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Group_ID', groupId).single();
  if (error) {
    throw error;
  }
  return data as GroupRecord;
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

function isSettledContribution(obligation: ContributionObligationRecord | null) {
  return !!obligation && ['Paid', 'Waived', 'RefundPending'].includes(obligation.status);
}

async function notifySimulatedPayment(group: GroupRecord, userId: string) {
  await createNotification({
    userId,
    type: 'simulation_contribution_paid',
    severity: 'Success',
    title: 'Simulation payment recorded',
    message: `${group.Group_Name} contribution was marked paid by the controller.`,
    actionRoute: 'member/group-cycle',
    relatedEntityType: 'EqubGroup',
    relatedEntityId: group.Group_ID,
  });
}

async function recordSimulatedContribution(group: GroupRecord, round: RoundRecord, userId: string, method = 'Simulation') {
  const memberships = await listActiveMemberships(group.Group_ID);
  if (!memberships.some(membership => membership.User_ID === userId)) {
    throw new Error('Selected user is not an active member of this group.');
  }
  await ensureContributionObligationsForRound(group, round);
  const obligation = await getContributionObligationForUserRound(round.Round_ID, userId);
  if (!obligation) {
    throw new Error('No contribution obligation exists for this user and round.');
  }
  if (isSettledContribution(obligation)) {
    return {
      userId,
      paid: false,
      skipped: true,
      transaction: null,
      message: 'Already settled.',
    };
  }

  const { data: transaction, error } = await supabaseAdmin.from('Transaction').insert({
    User_ID: userId,
    Round_ID: round.Round_ID,
    Amount: Number(group.Amount),
    Type: 'Contribution',
    Payment_Method: method,
    Gateway_Ref: `SIM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    Status: 'Successful',
    Date: new Date().toISOString(),
  }).select('*').single();
  if (error) {
    throw error;
  }

  await markContributionObligationPaid(obligation.id, (transaction as TransactionRecord).Trans_ID);
  await notifySimulatedPayment(group, userId);
  return {
    userId,
    paid: true,
    skipped: false,
    transaction: transaction as TransactionRecord,
    message: 'Payment recorded.',
  };
}

async function createSimulatedContribution(group: GroupRecord, round: RoundRecord, userId: string, method = 'Simulation') {
  const result = await recordSimulatedContribution(group, round, userId, method);
  if (result.skipped) {
    throw new Error('This user is already settled for the current round.');
  }
  const lifecycle = await finalizeRoundIfReady(group, round);

  return lifecycle.autoDrawTriggered ? 'Payment recorded and round finalized.' : 'Payment recorded.';
}

async function forceRoundContributionDeadline(roundId: string, mode: 'due' | 'grace') {
  const now = Date.now();
  const dueAt = new Date(now - 1000).toISOString();
  const graceEndsAt = mode === 'grace'
    ? new Date(now - 1000).toISOString()
    : new Date(now + 6 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('contribution_obligations')
    .update({ due_at: dueAt, grace_ends_at: graceEndsAt, updated_at: new Date().toISOString() })
    .eq('round_id', roundId)
    .in('status', ['Unpaid', 'PendingPayment', 'Late', 'Paid', 'Waived', 'RefundPending']);
  if (error) {
    throw error;
  }
}

async function payMembersInRound(input: {
  group: GroupRecord;
  round: RoundRecord;
  exceptUserId?: string | null;
  forceContinue?: boolean;
  method?: string;
}) {
  const memberships = await listActiveMemberships(input.group.Group_ID);
  const userIds = memberships
    .map(membership => membership.User_ID)
    .filter(userId => userId !== input.exceptUserId);

  if (!userIds.length) {
    throw new Error('No eligible active members were found for this batch payment.');
  }

  await ensureContributionObligationsForRound(input.group, input.round);
  const results = [];
  for (const userId of userIds) {
    results.push(await recordSimulatedContribution(input.group, input.round, userId, input.method ?? 'SimulationBatch'));
  }

  const paid = results.filter(result => result.paid).length;
  const skipped = results.filter(result => result.skipped).length;
  let suffix = `Paid ${paid} member${paid === 1 ? '' : 's'}`;
  if (skipped) {
    suffix += `, skipped ${skipped} already-settled member${skipped === 1 ? '' : 's'}`;
  }

  if (input.forceContinue) {
    await forceRoundContributionDeadline(input.round.Round_ID, 'due');
    const dueResult = await processDueContributionObligations({ now: new Date(), limit: 200 });
    const lifecycle = await finalizeRoundIfReady(input.group, input.round);
    if (lifecycle.autoDrawTriggered) {
      suffix += ' and finalized the round.';
    } else if (input.exceptUserId) {
      suffix += ` and opened the grace period for the unpaid member. ${dueResult.late.length} obligation(s) are late.`;
    } else {
      suffix += '; the round is ready, but finalization did not trigger.';
    }
  }

  return suffix;
}

async function defaultSelectedMemberNow(group: GroupRecord, round: RoundRecord, userId: string) {
  const obligation = await getContributionObligationForUserRound(round.Round_ID, userId);
  if (!obligation) {
    throw new Error('No contribution obligation exists for this user and round.');
  }
  const now = new Date(Date.now() - 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('contribution_obligations')
    .update({ due_at: now, grace_ends_at: now, updated_at: new Date().toISOString() })
    .eq('id', obligation.id);
  if (error) {
    throw error;
  }
  const result = await processDueContributionObligations({ now: new Date(), limit: 200 });
  return `Deadline sweep complete. ${result.defaulted.length} obligation(s) defaulted.`;
}

async function markRoundUnpaidMembersLate(group: GroupRecord, round: RoundRecord) {
  await ensureContributionObligationsForRound(group, round);
  const obligations = await listRoundObligations(round.Round_ID);
  const unpaid = obligations.filter(obligation => ['Unpaid', 'PendingPayment'].includes(obligation.status));
  for (const obligation of unpaid) {
    await markContributionObligationLate(obligation.id);
  }
  return `Marked ${unpaid.length} unpaid obligation(s) Late.`;
}

async function skipActiveGroupTime(group: GroupRecord, round: RoundRecord, days: number) {
  const boundedDays = Math.max(0, Math.min(2, days));
  if (boundedDays <= 0) {
    throw new Error('Skip time must be between one and two days.');
  }

  await ensureContributionObligationsForRound(group, round);
  const offsetMs = boundedDays * 24 * 60 * 60 * 1000;
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .select('*')
    .eq('round_id', round.Round_ID)
    .in('status', ['Unpaid', 'PendingPayment', 'Late']);
  if (error) {
    throw error;
  }

  for (const obligation of (data ?? []) as ContributionObligationRecord[]) {
    const dueAt = obligation.due_at
      ? new Date(new Date(obligation.due_at).getTime() - offsetMs).toISOString()
      : new Date(Date.now() - 1000).toISOString();
    const graceEndsAt = obligation.grace_ends_at
      ? new Date(new Date(obligation.grace_ends_at).getTime() - offsetMs).toISOString()
      : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const update = await supabaseAdmin
      .from('contribution_obligations')
      .update({ due_at: dueAt, grace_ends_at: graceEndsAt, updated_at: new Date().toISOString() })
      .eq('id', obligation.id);
    if (update.error) {
      throw update.error;
    }
  }

  await processDueContributionObligations({ now: new Date(), limit: 200 });
  return `Skipped ${boundedDays} day${boundedDays === 1 ? '' : 's'} for this active group.`;
}

async function listVerifiedMembers() {
  const { data, error } = await supabaseAdmin
    .from('User')
    .select('*')
    .eq('Role', 'Member')
    .eq('KYC_Status', 'Verified')
    .order('Created_At', { ascending: true })
    .limit(100);
  if (error) {
    throw error;
  }
  return (data ?? []) as UserRecord[];
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];
}

async function formControllerGroup(actor: UserRecord, payload: Record<string, unknown>) {
  const verifiedMembers = await listVerifiedMembers();
  if (!verifiedMembers.length) {
    throw new Error('No verified member accounts are available for controller group formation.');
  }
  const requestedMemberIds = readStringArray(payload.memberUserIds);
  const maxMemberInput = payload.maxMembers ?? (requestedMemberIds.length || 5);
  const parsedMaxMembers = Number(maxMemberInput);
  const maxMembers = Math.max(2, Math.min(20, Number.isFinite(parsedMaxMembers) ? parsedMaxMembers : 5));
  const creatorId = typeof payload.creatorUserId === 'string' && payload.creatorUserId
    ? payload.creatorUserId
    : requestedMemberIds[0] ?? verifiedMembers[0].User_ID;
  const memberIds = Array.from(new Set([
    creatorId,
    ...requestedMemberIds,
    ...verifiedMembers.map(user => user.User_ID),
  ])).slice(0, maxMembers);
  if (memberIds.length < 2) {
    throw new Error('At least two verified members are required to form a simulation group.');
  }

  const status = payload.status === 'Pending' ? 'Pending' : 'Active';
  const { data: groupData, error: groupError } = await supabaseAdmin
    .from('EqubGroup')
    .insert({
      Creator_ID: creatorId,
      Group_Name: String(payload.groupName ?? `Controller Equb ${new Date().toLocaleTimeString('en-US', { hour12: false })}`).slice(0, 50),
      Amount: Math.max(1, Number(payload.amount ?? 650)),
      Max_Members: maxMembers,
      Frequency: ['Daily', 'Weekly', 'Bi-weekly', 'Monthly'].includes(String(payload.frequency)) ? String(payload.frequency) : 'Weekly',
      Virtual_Acc_Ref: `SIM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      Status: status,
      Start_Date: status === 'Active' ? new Date().toISOString().slice(0, 10) : null,
    })
    .select('*')
    .single();
  if (groupError) {
    throw groupError;
  }
  const group = groupData as GroupRecord;

  const { error: memberError } = await supabaseAdmin
    .from('GroupMembers')
    .insert(memberIds.map(userId => ({
      Group_ID: group.Group_ID,
      User_ID: userId,
      Status: 'Active',
    })));
  if (memberError) {
    throw memberError;
  }

  if (group.Status === 'Active') {
    const round = await ensureOpenRoundForGroup(group);
    await ensureContributionObligationsForRound(group, round);
  }

  await Promise.all(memberIds.map(userId => createNotification({
    userId,
    type: 'simulation_group_formed',
    severity: 'Success',
    title: 'Controller group formed',
    message: `${group.Group_Name} was formed by the simulation controller.`,
    actionRoute: group.Status === 'Active' ? 'member/group-cycle' : 'member/group',
    relatedEntityType: 'EqubGroup',
    relatedEntityId: group.Group_ID,
  })));

  return `Formed ${group.Status.toLowerCase()} controller group with ${memberIds.length} member(s).`;
}

async function activateGroupNow(group: GroupRecord, actor: UserRecord) {
  const result = await activateApprovedGroup({ group, actor, reason: 'Manual' });
  return result.activated ? 'Group activated and contribution obligations opened.' : `Group activation skipped: ${result.reason}.`;
}

async function forceGroupToPoll(group: GroupRecord, actor: UserRecord) {
  if (group.Status !== 'Frozen') {
    await freezeGroupForAdminReview({
      groupId: group.Group_ID,
      reason: 'ManualAdminFreeze',
      actor,
      metadata: { source: 'simulation-controller.forcePoll' },
    });
  }
  const state = await createFrozenGroupResolutionPoll({ groupId: group.Group_ID, admin: actor });
  return `Resolution poll opened (${state.activeResolutionPoll?.poll.id ?? state.latestResolutionPoll?.poll.id ?? 'existing'}).`;
}

async function findOpenPollId(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_resolution_polls')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'Open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return (data as { id: string } | null)?.id ?? null;
}

async function closeOpenPoll(group: GroupRecord, actor: UserRecord) {
  const pollId = await findOpenPollId(group.Group_ID);
  if (!pollId) {
    throw new Error('No open resolution poll exists for this group.');
  }
  await closeResolutionPollIfReady({ pollId, actor, forceExpired: true });
  return 'Open resolution poll closed.';
}

async function findOpenWinnerExitWindow(groupId: string) {
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

async function decideOpenWinnerExit(group: GroupRecord, actor: UserRecord, decision: 'Continue' | 'Exit', windowId?: string) {
  if (group.Status !== 'Active') {
    throw new Error('Winner exit controls only apply to active groups.');
  }
  const window = windowId ? null : await findOpenWinnerExitWindow(group.Group_ID);
  const targetWindowId = windowId ?? window?.id;
  if (!targetWindowId) {
    throw new Error('No open winner exit window exists for this group.');
  }
  const result = await decideWinnerExitWindow({
    group,
    windowId: targetWindowId,
    decision,
    actor,
  });
  if (result.shouldOpenNextRound) {
    const refreshed = await requireGroup(group.Group_ID);
    if (refreshed.Status === 'Active') {
      await ensureOpenRoundForGroup(refreshed);
    }
  }
  return decision === 'Exit' ? 'Winner exited; next state applied.' : 'Winner continued; next round opened.';
}

async function expireOpenWinnerExit(group: GroupRecord) {
  if (group.Status !== 'Active') {
    throw new Error('Winner exit controls only apply to active groups.');
  }
  const continued = await continueExpiredWinnerExitWindow(group);
  if (!continued) {
    const window = await findOpenWinnerExitWindow(group.Group_ID);
    if (!window) {
      throw new Error('No open winner exit window exists for this group.');
    }
    const { error } = await supabaseAdmin
      .from('winner_exit_windows')
      .update({
        closes_at: new Date(Date.now() - 1000).toISOString(),
        metadata: { ...(window.metadata ?? {}), expired_by: 'simulation-controller' },
      })
      .eq('id', window.id);
    if (error) {
      throw error;
    }
    await continueExpiredWinnerExitWindow(group);
  }
  await ensureOpenRoundForGroup(group);
  return 'Winner exit window expired and defaulted to continue.';
}

async function disbandGroup(group: GroupRecord, actor: UserRecord) {
  const activeMemberships = await listActiveMemberships(group.Group_ID);
  const rounds = await supabaseAdmin
    .from('Round')
    .select('*')
    .eq('Group_ID', group.Group_ID)
    .order('Round_Number', { ascending: false });
  if (rounds.error) {
    throw rounds.error;
  }
  const roundIds = ((rounds.data ?? []) as RoundRecord[]).map(round => round.Round_ID);
  const latestRound = ((rounds.data ?? []) as RoundRecord[])[0] ?? null;
  const transactions = roundIds.length
    ? await supabaseAdmin
      .from('Transaction')
      .select('*')
      .in('Round_ID', roundIds)
      .eq('Type', 'Contribution')
      .eq('Status', 'Successful')
    : { data: [], error: null };
  if (transactions.error) {
    throw transactions.error;
  }

  const amountsByUser = new Map<string, number>();
  for (const transaction of (transactions.data ?? []) as TransactionRecord[]) {
    amountsByUser.set(transaction.User_ID, (amountsByUser.get(transaction.User_ID) ?? 0) + Number(transaction.Amount ?? 0));
  }

  let ticketCount = 0;
  if (amountsByUser.size) {
    const rows = [...amountsByUser.entries()].map(([userId, amount]) => ({
      group_id: group.Group_ID,
      round_id: latestRound?.Round_ID ?? null,
      user_id: userId,
      amount,
      currency: 'ETB',
      reason: 'Simulation controller disbanded this group and created a refund ticket.',
      status: 'Created',
      offset_applied_amount: 0,
      created_by_event_id: null,
      calculation_snapshot: {
        source: 'simulation_controller_disband',
        group_id: group.Group_ID,
        round_ids: roundIds,
      },
    }));
    const { data, error } = await supabaseAdmin.from('refund_tickets').insert(rows).select('*');
    if (error) {
      throw error;
    }
    ticketCount = ((data ?? []) as RefundTicketRecord[]).length;
  }

  const [groupUpdate, memberUpdate, roundUpdate] = await Promise.all([
    supabaseAdmin.from('EqubGroup').update({ Status: 'Completed' }).eq('Group_ID', group.Group_ID),
    supabaseAdmin.from('GroupMembers').update({ Status: 'Removed' }).eq('Group_ID', group.Group_ID).eq('Status', 'Active'),
    roundIds.length ? supabaseAdmin.from('Round').update({ Status: 'Completed' }).in('Round_ID', roundIds).neq('Status', 'Completed') : Promise.resolve({ error: null }),
  ]);
  for (const error of [groupUpdate.error, memberUpdate.error, roundUpdate.error]) {
    if (error) {
      throw error;
    }
  }

  await Promise.all(activeMemberships.map(membership => createNotification({
    userId: membership.User_ID,
    type: 'simulation_group_disbanded',
    severity: 'Warning',
    title: 'Group disbanded',
    message: `${group.Group_Name} was disbanded by the simulation controller.`,
    actionRoute: 'member/groups',
    relatedEntityType: 'EqubGroup',
    relatedEntityId: group.Group_ID,
  })));

  return `Group disbanded. Created ${ticketCount} refund ticket(s).`;
}

async function runBackendCommand(command: SimulationCommand) {
  const payload = command.payload;
  const groupId = typeof payload.groupId === 'string' ? payload.groupId : null;
  const group = groupId ? await requireGroup(groupId) : null;
  const activeGroup = group?.Status === 'Active' ? group : null;
  const round = activeGroup ? await ensureOpenRoundForGroup(activeGroup) : null;

  switch (payload.action) {
    case 'formActiveGroup': {
      return formControllerGroup(actor, { ...payload, status: 'Active' });
    }
    case 'formJoinWindowGroup': {
      return formControllerGroup(actor, { ...payload, status: 'Pending' });
    }
    case 'activateGroupNow': {
      if (!group) {
        throw new Error('groupId is required for activation.');
      }
      return activateGroupNow(group, actor);
    }
    case 'freezeGroup': {
      if (!group) {
        throw new Error('groupId is required for freezing.');
      }
      await freezeGroupForAdminReview({
        groupId: group.Group_ID,
        reason: 'ManualAdminFreeze',
        actor,
        metadata: { source: 'simulation-controller.freezeGroup' },
      });
      return 'Group frozen for controller recovery testing.';
    }
    case 'resumeFrozenGroup':
    case 'resolveFreezeContinue': {
      if (!group) {
        throw new Error('groupId is required for freeze resolution.');
      }
      await resolveOpenGroupFreeze({
        groupId: group.Group_ID,
        admin: actor,
        resolutionAction: 'ContinueWithReserveFrozen',
        resolutionNote: 'Simulation controller resumed the group.',
      });
      return 'Frozen group resumed.';
    }
    case 'resolveFreezeRefund': {
      if (!group) {
        throw new Error('groupId is required for freeze resolution.');
      }
      await resolveOpenGroupFreeze({
        groupId: group.Group_ID,
        admin: actor,
        resolutionAction: 'CreateRefundTickets',
        resolutionNote: 'Simulation controller requested refund tickets.',
      });
      return 'Frozen group resolved with refund tickets.';
    }
    case 'openResolutionPoll':
    case 'forceResolutionPoll': {
      if (!group) {
        throw new Error('groupId is required for polling.');
      }
      return forceGroupToPoll(group, actor);
    }
    case 'closeResolutionPoll': {
      if (!group) {
        throw new Error('groupId is required for polling.');
      }
      return closeOpenPoll(group, actor);
    }
    case 'winnerExitContinue': {
      if (!group) {
        throw new Error('groupId is required for winner exit controls.');
      }
      return decideOpenWinnerExit(group, actor, 'Continue', typeof payload.windowId === 'string' ? payload.windowId : undefined);
    }
    case 'winnerExitLeave': {
      if (!group) {
        throw new Error('groupId is required for winner exit controls.');
      }
      return decideOpenWinnerExit(group, actor, 'Exit', typeof payload.windowId === 'string' ? payload.windowId : undefined);
    }
    case 'expireWinnerExitWindow': {
      if (!group) {
        throw new Error('groupId is required for winner exit controls.');
      }
      return expireOpenWinnerExit(group);
    }
    case 'disbandGroup': {
      if (!group) {
        throw new Error('groupId is required for disbanding.');
      }
      return disbandGroup(group, actor);
    }
    case 'startSimulation':
    case 'pauseSimulation':
    case 'resumeSimulation':
    case 'advanceClock': {
      const offsetSeconds = Math.max(0, Math.min(2 * 24 * 60 * 60, Number(payload.offsetSeconds ?? 0)));
      const updates = {
        id: true,
        enabled: payload.action !== 'pauseSimulation',
        paused: payload.action === 'pauseSimulation',
        time_scale: Number(payload.timeScale ?? 1),
        offset_seconds: offsetSeconds,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin.from('simulation_clock').upsert(updates);
      if (error) {
        throw error;
      }
      return 'Simulation clock updated.';
    }
    case 'createTestPayment':
    case 'markObligationPaid': {
      if (!activeGroup || !round) {
        throw new Error('An active group is required for simulated payments.');
      }
      return createSimulatedContribution(activeGroup, round, requireString(payload.userId, 'userId'), String(payload.method ?? 'Simulation'));
    }
    case 'payAllMembers':
    case 'payAllMembersAndContinue': {
      if (!activeGroup || !round) {
        throw new Error('An active group is required for batch payments.');
      }
      return payMembersInRound({
        group: activeGroup,
        round,
        forceContinue: payload.action === 'payAllMembersAndContinue',
        method: String(payload.method ?? 'SimulationBatch'),
      });
    }
    case 'payAllExceptMember':
    case 'payAllExceptMemberAndContinue': {
      if (!activeGroup || !round) {
        throw new Error('An active group is required for batch payments.');
      }
      return payMembersInRound({
        group: activeGroup,
        round,
        exceptUserId: requireString(payload.userId, 'userId'),
        forceContinue: payload.action === 'payAllExceptMemberAndContinue',
        method: String(payload.method ?? 'SimulationBatch'),
      });
    }
    case 'markObligationLate': {
      await markContributionObligationLate(requireString(payload.obligationId, 'obligationId'));
      return 'Obligation marked Late.';
    }
    case 'markRoundUnpaidLate': {
      if (!activeGroup || !round) {
        throw new Error('An active group is required for late controls.');
      }
      return markRoundUnpaidMembersLate(activeGroup, round);
    }
    case 'defaultSelectedMember': {
      if (!activeGroup || !round) {
        throw new Error('An active group is required for default controls.');
      }
      return defaultSelectedMemberNow(activeGroup, round, requireString(payload.userId, 'userId'));
    }
    case 'processContributionDeadlines': {
      const result = await processDueContributionObligations({ now: new Date(), limit: 500 });
      return `Processed contribution deadlines. ${result.late.length} late and ${result.defaulted.length} defaulted.`;
    }
    case 'skipTime': {
      if (!activeGroup || !round) {
        throw new Error('An active group is required for time skip.');
      }
      return skipActiveGroupTime(activeGroup, round, Number(payload.days ?? 1));
    }
    case 'removeMember': {
      if (!group) {
        throw new Error('groupId is required.');
      }
      const userId = requireString(payload.userId, 'userId');
      const { error } = await supabaseAdmin
        .from('GroupMembers')
        .update({ Status: 'Removed' })
        .eq('Group_ID', group.Group_ID)
        .eq('User_ID', userId);
      if (error) {
        throw error;
      }
      await createNotification({
        userId,
        type: 'simulation_member_removed',
        severity: 'Warning',
        title: 'Removed from active group',
        message: `The controller removed you from ${group.Group_Name}.`,
        actionRoute: 'member/groups',
        relatedEntityType: 'EqubGroup',
        relatedEntityId: group.Group_ID,
      });
      return 'Member removed from active group.';
    }
    case 'recordDrawSeed':
    case 'finalizeRound': {
      if (!activeGroup || !round) {
        throw new Error('An active group is required for draw controls.');
      }
      const metadata = {
        groupId: activeGroup.Group_ID,
        roundId: round.Round_ID,
        drawSeed: payload.drawSeed ?? null,
        requestedWinnerUserId: payload.winnerUserId ?? null,
      };
      const seedEvent = await supabaseAdmin.from('simulation_events').insert({
        command_id: `${command.id}-draw-seed`,
        command_type: 'DrawSeedRecorded',
        actor_user_id: null,
        entity_type: 'Round',
        entity_id: round.Round_ID,
        metadata,
      });
      if (seedEvent.error) {
        throw seedEvent.error;
      }
      if (payload.action === 'recordDrawSeed') {
        return 'Draw seed recorded.';
      }
      const { error } = await supabaseAdmin
        .from('Round')
        .update({ Status: 'Completed', Draw_Date: new Date().toISOString(), Winner_ID: payload.winnerUserId ?? null })
        .eq('Round_ID', round.Round_ID)
        .eq('Status', 'Open');
      if (error) {
        throw error;
      }
      return 'Round finalized with controller-selected draw data.';
    }
    default:
      return 'Command recorded for app-side refresh.';
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = await request.json();
    assertControllerSecret(request, body);
    const actor = await requireAdmin(body.token);

    switch (body.action) {
      case 'getSnapshot':
        return json({ snapshot: await snapshot() });
      case 'runCommand': {
        const command = body.command as SimulationCommand | undefined;
        if (!command?.id || !command.type) {
          return fail('Simulation command id and type are required.', 400);
        }
        const message = await runBackendCommand(command);
        await logCommand(actor, command);
        return json({
          result: {
            ok: true,
            commandId: command.id,
            message,
            snapshot: await snapshot(),
          },
        });
      }
      default:
        return fail('Unsupported simulation action.', 400);
    }
  } catch (error) {
    return failFromError(error, 'Unexpected simulation controller error.', 500, { functionName: 'simulation-controller' });
  }
});
