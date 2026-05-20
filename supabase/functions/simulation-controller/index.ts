import { fail, failFromError, json } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupRecord, MembershipRecord, RoundRecord, TransactionRecord, UserRecord } from '../_shared/types.ts';

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
    supabaseAdmin.from('EqubGroup').select('*').order('Start_Date', { ascending: false }),
    supabaseAdmin.from('Round').select('*').order('Round_Number', { ascending: true }),
    supabaseAdmin.from('GroupMembers').select('*').order('Joined_At', { ascending: false }),
    supabaseAdmin.from('Transaction').select('*').order('Date', { ascending: false }).limit(50),
    supabaseAdmin.from('simulation_events').select('*').order('created_at', { ascending: false }).limit(50),
  ]);
  for (const error of [groupsError, roundsError, membershipsError, transactionsError, eventsError]) {
    if (error) {
      throw error;
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    groups: (groups ?? []) as GroupRecord[],
    rounds: (rounds ?? []) as RoundRecord[],
    memberships: (memberships ?? []) as MembershipRecord[],
    transactions: (transactions ?? []) as TransactionRecord[],
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

async function ensureRound(groupId: string) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('Round')
    .select('*')
    .eq('Group_ID', groupId)
    .eq('Status', 'Open')
    .maybeSingle();
  if (existingError) {
    throw existingError;
  }
  if (existing) {
    return existing as RoundRecord;
  }
  const { data: latest, error: latestError } = await supabaseAdmin
    .from('Round')
    .select('Round_Number')
    .eq('Group_ID', groupId)
    .order('Round_Number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) {
    throw latestError;
  }
  const { data, error } = await supabaseAdmin
    .from('Round')
    .insert({
      Group_ID: groupId,
      Round_Number: Number(latest?.Round_Number ?? 0) + 1,
      Winner_ID: null,
      Draw_Date: null,
      Status: 'Open',
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return data as RoundRecord;
}

async function runBackendCommand(command: SimulationCommand) {
  const payload = command.payload;
  switch (payload.action) {
    case 'startSimulation':
    case 'pauseSimulation':
    case 'resumeSimulation':
    case 'advanceClock': {
      const updates = {
        id: true,
        enabled: payload.action !== 'pauseSimulation',
        paused: payload.action === 'pauseSimulation',
        time_scale: Number(payload.timeScale ?? 1),
        offset_seconds: Number(payload.offsetSeconds ?? 0),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin.from('simulation_clock').upsert(updates);
      if (error) {
        throw error;
      }
      return 'Simulation clock updated.';
    }
    case 'markObligationPaid':
    case 'markObligationLate':
    case 'markObligationDefaulted': {
      const status = payload.action === 'markObligationPaid' ? 'Paid' : payload.action === 'markObligationLate' ? 'Late' : 'Defaulted';
      const timestampColumn = status === 'Paid' ? 'paid_at' : status === 'Late' ? 'late_at' : 'defaulted_at';
      const { error } = await supabaseAdmin
        .from('contribution_obligations')
        .update({ status, [timestampColumn]: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', payload.obligationId);
      if (error) {
        throw error;
      }
      return `Obligation marked ${status}.`;
    }
    case 'removeMember': {
      const { error } = await supabaseAdmin
        .from('GroupMembers')
        .update({ Status: 'Removed' })
        .eq('Group_ID', payload.groupId)
        .eq('User_ID', payload.userId);
      if (error) {
        throw error;
      }
      return 'Member removed from group.';
    }
    case 'freezeGroup':
    case 'resumeGroup': {
      const { error } = await supabaseAdmin
        .from('EqubGroup')
        .update({ Status: payload.action === 'freezeGroup' ? 'Frozen' : 'Active' })
        .eq('Group_ID', payload.groupId);
      if (error) {
        throw error;
      }
      return payload.action === 'freezeGroup' ? 'Group frozen.' : 'Group resumed.';
    }
    case 'createTestPayment': {
      if (!payload.groupId || !payload.userId) {
        throw new Error('groupId and userId are required for test payments.');
      }
      const round = await ensureRound(String(payload.groupId));
      const amount = Number(payload.amount ?? 0);
      const { error } = await supabaseAdmin.from('Transaction').insert({
        User_ID: payload.userId,
        Round_ID: round.Round_ID,
        Amount: amount,
        Type: 'Contribution',
        Payment_Method: payload.method ?? 'MockUSSD',
        Gateway_Ref: payload.gatewayRef ?? `SIM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        Status: 'Successful',
        Date: new Date().toISOString(),
      });
      if (error) {
        throw error;
      }
      return 'Test payment created.';
    }
    case 'finalizeRound': {
      const { error } = await supabaseAdmin
        .from('Round')
        .update({ Status: 'Completed', Draw_Date: new Date().toISOString(), Winner_ID: payload.winnerUserId ?? null })
        .eq('Round_ID', payload.roundId);
      if (error) {
        throw error;
      }
      return 'Round finalized.';
    }
    default:
      return 'Command recorded for app-side simulation.';
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
