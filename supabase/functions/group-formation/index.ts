import { verifySession } from '../_shared/auth.ts';
import { fail, json } from '../_shared/contracts.ts';
import type { CreateGroupFormationRequest, GroupFormationAction, GroupFormationPayload } from '../_shared/contracts.ts';
import { loadConfigValue } from '../_shared/config.ts';
import { getReliabilityJoinGate } from '../_shared/reliability.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupRequestRecord, UserRecord } from '../_shared/types.ts';

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

function cleanText(value: string | undefined | null) {
  return value?.trim() ?? '';
}

function assertAllowedValue<T extends string>(value: string, allowed: T[], label: string): T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value as T;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function validateCreateRequestInput(input: CreateGroupFormationRequest | undefined, policy: Awaited<ReturnType<typeof loadFormationPolicySnapshot>>) {
  if (!input) {
    throw new Error('Missing group formation request details.');
  }

  const groupName = cleanText(input.groupName);
  if (groupName.length < 3 || groupName.length > 80) {
    throw new Error('Group name must be between 3 and 80 characters.');
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Contribution amount must be greater than zero.');
  }

  const minMembers = input.minMembers ?? policy.minMembers;
  if (!Number.isInteger(minMembers) || minMembers < policy.minMembers) {
    throw new Error(`Minimum members must be at least ${policy.minMembers}.`);
  }
  if (!Number.isInteger(input.maxMembers) || input.maxMembers < minMembers) {
    throw new Error('Maximum members must be greater than or equal to minimum members.');
  }
  if (input.maxMembers > policy.maxMembers) {
    throw new Error(`Maximum members cannot exceed the configured limit of ${policy.maxMembers}.`);
  }

  const visibility = assertAllowedValue(input.visibility, ['Public', 'Private'], 'visibility');
  const inviteMode = assertAllowedValue(input.inviteMode ?? (visibility === 'Public' ? 'PublicRequest' : 'InviteCode'), [
    'PublicRequest',
    'InviteCode',
    'DirectInvite',
    'InviteCodeAndDirect',
  ], 'invite mode');
  const frequency = assertAllowedValue(input.frequency, ['Weekly', 'Bi-weekly', 'Monthly'], 'frequency');

  const vestingEnabled = input.vestingEnabled ?? true;
  if (!vestingEnabled && visibility !== 'Private') {
    throw new Error('Only private invite-based group requests can disable payout vesting.');
  }
  if (!vestingEnabled && !input.riskWarningAccepted) {
    throw new Error('Risk warning acceptance is required before disabling payout vesting.');
  }
  if (visibility === 'Public' && inviteMode !== 'PublicRequest') {
    throw new Error('Public group formation requests must use public request mode.');
  }
  if (visibility === 'Private' && inviteMode === 'PublicRequest') {
    throw new Error('Private group formation requests must use an invite-based mode.');
  }

  return {
    groupName,
    description: cleanText(input.description) || null,
    contributionAmount: Number(input.amount.toFixed(2)),
    frequency,
    minMembers,
    maxMembers: input.maxMembers,
    visibility,
    inviteMode,
    vestingEnabled,
    termsVersion: cleanText(input.termsVersion) || 'phase2-v1',
  };
}

async function createFormationRequest(actor: UserRecord, createRequest: CreateGroupFormationRequest | undefined) {
  const policy = await loadFormationPolicySnapshot();
  const input = validateCreateRequestInput(createRequest, policy);
  const now = new Date();
  const expiresAt = addDays(now, policy.expiryDays).toISOString();
  const riskWarningAcceptedAt = input.vestingEnabled ? null : now.toISOString();

  const { data: groupRequest, error } = await supabaseAdmin
    .from('group_requests')
    .insert({
      creator_id: actor.User_ID,
      proposed_group_name: input.groupName,
      description: input.description,
      contribution_amount: input.contributionAmount,
      frequency: input.frequency,
      min_members: input.minMembers,
      max_members: input.maxMembers,
      visibility: input.visibility,
      invite_mode: input.inviteMode,
      status: 'Forming',
      terms_version: input.termsVersion,
      vesting_enabled: input.vestingEnabled,
      vesting_disabled_by_creator: !input.vestingEnabled,
      risk_warning_accepted_at: riskWarningAcceptedAt,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const request = groupRequest as GroupRequestRecord;
  const { data: creatorParticipant, error: participantError } = await supabaseAdmin
    .from('group_join_requests')
    .insert({
      group_request_id: request.id,
      user_id: actor.User_ID,
      status: 'Accepted',
      accepted_at: now.toISOString(),
      decision_by: actor.User_ID,
      decision_reason: 'Creator automatically added to the forming group.',
    })
    .select('*')
    .single();

  if (participantError) {
    throw participantError;
  }

  return json({
    groupRequest: request,
    creatorParticipant,
    policy,
  }, 201);
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
        await assertNormalFormationEligibility(actor);
        return createFormationRequest(actor, body.createRequest);

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
