import { verifySession } from '../_shared/auth.ts';
import { fail } from '../_shared/contracts.ts';
import type { GroupFormationAction, GroupFormationPayload } from '../_shared/contracts.ts';
import { loadConfigValue } from '../_shared/config.ts';
import { getReliabilityJoinGate } from '../_shared/reliability.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const routedActions: GroupFormationAction[] = [
  'listPublic',
  'getRequest',
  'createRequest',
  'requestJoin',
  'acceptJoin',
  'removeParticipant',
  'invite',
  'acceptInvite',
  'submitForApproval',
  'adminApprove',
  'adminReject',
];

async function requireActor(token: string) {
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
  if (user.KYC_Status === 'Banned') {
    throw new Error('This account has been banned.');
  }
  return user;
}

function assertAdmin(user: UserRecord) {
  if (user.Role !== 'Admin') {
    throw new Error('Admin access is required for this action.');
  }
}

function assertVerifiedMember(user: UserRecord) {
  if (user.Role !== 'Member') {
    throw new Error('This action is only available to members.');
  }
  if (user.KYC_Status !== 'Verified') {
    throw new Error('KYC verification is required for this action.');
  }
}

async function assertNormalFormationEligibility(user: UserRecord) {
  assertVerifiedMember(user);
  const gate = await getReliabilityJoinGate(user.User_ID);
  if (!gate.canJoinNormalGroup) {
    throw new Error(gate.blockedReason ?? 'User is not eligible for normal group formation.');
  }
  return gate;
}

function ensureRoutedAction(action: string): action is GroupFormationAction {
  return routedActions.includes(action as GroupFormationAction);
}

function pendingImplementation(action: GroupFormationAction, actor: UserRecord) {
  return new Response(JSON.stringify({
    ok: false,
    error: 'Phase 2 group-formation workflow implementation is pending.',
    data: {
      action,
      actor: {
        userId: actor.User_ID,
        role: actor.Role,
        kycStatus: actor.KYC_Status,
      },
      status: 'NotImplemented',
      message: 'Phase 2 group-formation command boundary is routed; workflow implementation will be added in the next batches.',
    },
  }), {
    status: 501,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = (await request.json()) as GroupFormationPayload;
    if (!body.token) {
      return fail('Missing session token.', 401);
    }
    if (!body.action || !ensureRoutedAction(body.action)) {
      return fail('Unsupported group formation action.', 400);
    }

    const actor = await requireActor(body.token);

    switch (body.action) {
      case 'listPublic':
      case 'getRequest':
      case 'acceptInvite':
        assertVerifiedMember(actor);
        return pendingImplementation(body.action, actor);

      case 'createRequest':
      case 'requestJoin':
        await assertNormalFormationEligibility(actor);
        return pendingImplementation(body.action, actor);

      case 'acceptJoin':
      case 'removeParticipant':
      case 'invite':
      case 'submitForApproval':
        assertVerifiedMember(actor);
        return pendingImplementation(body.action, actor);

      case 'adminApprove':
      case 'adminReject':
        assertAdmin(actor);
        return pendingImplementation(body.action, actor);

      default:
        return fail('Unsupported group formation action.', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected group formation error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

export async function loadFormationPolicySnapshot() {
  const [minMembers, maxMembers, expiryDays] = await Promise.all([
    loadConfigValue<number>('min_group_members', 5),
    loadConfigValue<number>('max_group_members', 12),
    loadConfigValue<number>('group_formation_expiry_days', 3),
  ]);

  return {
    minMembers,
    maxMembers,
    expiryDays,
  };
}
