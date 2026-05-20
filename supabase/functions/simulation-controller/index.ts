import { fail, failFromError, json } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { createNotification } from '../_shared/notifications.ts';
import {
  ensureContributionObligationsForRound,
  getContributionObligationForUserRound,
  markContributionObligationLate,
  markContributionObligationPaid,
  processDueContributionObligations,
} from '../_shared/obligations.ts';
import { finalizeRoundIfReady } from '../_shared/roundLifecycle.ts';
import { ensureOpenRoundForGroup } from '../_shared/rounds.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { ContributionObligationRecord, GroupRecord, MembershipRecord, RoundRecord, TransactionRecord, UserRecord } from '../_shared/types.ts';

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
  ] = await Promise.all([
    supabaseAdmin.from('EqubGroup').select('*').eq('Status', 'Active').order('Start_Date', { ascending: false }),
    supabaseAdmin.from('Round').select('*').order('Round_Number', { ascending: true }),
    supabaseAdmin.from('GroupMembers').select('*').order('Joined_At', { ascending: false }),
    supabaseAdmin.from('Transaction').select('*').order('Date', { ascending: false }).limit(100),
    supabaseAdmin.from('simulation_events').select('*').order('created_at', { ascending: false }).limit(50),
  ]);
  for (const error of [groupsError, roundsError, membershipsError, transactionsError, eventsError]) {
    if (error) {
      throw error;
    }
  }

  const activeGroups = (groups ?? []) as GroupRecord[];
  const activeGroupIds = activeGroups.map(group => group.Group_ID);
  const activeRounds = ((rounds ?? []) as RoundRecord[]).filter(round => activeGroupIds.includes(round.Group_ID));
  const activeRoundIds = activeRounds.map(round => round.Round_ID);
  const activeMemberships = ((memberships ?? []) as MembershipRecord[]).filter(membership => activeGroupIds.includes(membership.Group_ID) && membership.Status === 'Active');
  const userIds = Array.from(new Set(activeMemberships.map(item => item.User_ID)));

  const [{ data: users, error: usersError }, { data: obligations, error: obligationsError }] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from('User').select('User_ID, Full_Name, Phone_Number, KYC_Status, Role, Created_At').in('User_ID', userIds)
      : Promise.resolve({ data: [], error: null }),
    activeGroupIds.length
      ? supabaseAdmin.from('contribution_obligations').select('*').in('group_id', activeGroupIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const error of [usersError, obligationsError]) {
    if (error) {
      throw error;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    groups: activeGroups,
    rounds: activeRounds,
    memberships: activeMemberships,
    users: users ?? [],
    obligations: (obligations ?? []) as ContributionObligationRecord[],
    transactions: ((transactions ?? []) as TransactionRecord[]).filter(transaction => activeRoundIds.includes(transaction.Round_ID)),
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

async function requireActiveGroup(groupId: string) {
  const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Group_ID', groupId).single();
  if (error) {
    throw error;
  }
  const group = data as GroupRecord;
  if (group.Status !== 'Active') {
    throw new Error('Simulation commands can only mutate active groups.');
  }
  return group;
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

async function createSimulatedContribution(group: GroupRecord, round: RoundRecord, userId: string, method = 'Simulation') {
  const memberships = await listActiveMemberships(group.Group_ID);
  if (!memberships.some(membership => membership.User_ID === userId)) {
    throw new Error('Selected user is not an active member of this group.');
  }
  await ensureContributionObligationsForRound(group, round);
  const obligation = await getContributionObligationForUserRound(round.Round_ID, userId);
  if (!obligation) {
    throw new Error('No contribution obligation exists for this user and round.');
  }
  if (['Paid', 'Waived', 'RefundPending'].includes(obligation.status)) {
    throw new Error('This user is already settled for the current round.');
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
  const lifecycle = await finalizeRoundIfReady(group, round);
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

  return lifecycle.autoDrawTriggered ? 'Payment recorded and round finalized.' : 'Payment recorded.';
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

async function runBackendCommand(command: SimulationCommand) {
  const payload = command.payload;
  const groupId = typeof payload.groupId === 'string' ? payload.groupId : null;
  const group = groupId ? await requireActiveGroup(groupId) : null;
  const round = group ? await ensureOpenRoundForGroup(group) : null;

  switch (payload.action) {
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
      if (!group || !round) {
        throw new Error('groupId is required for simulated payments.');
      }
      return createSimulatedContribution(group, round, requireString(payload.userId, 'userId'), String(payload.method ?? 'Simulation'));
    }
    case 'markObligationLate': {
      await markContributionObligationLate(requireString(payload.obligationId, 'obligationId'));
      return 'Obligation marked Late.';
    }
    case 'skipTime': {
      if (!group || !round) {
        throw new Error('groupId is required for time skip.');
      }
      return skipActiveGroupTime(group, round, Number(payload.days ?? 1));
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
      if (!group || !round) {
        throw new Error('groupId is required for draw controls.');
      }
      const metadata = {
        groupId: group.Group_ID,
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
