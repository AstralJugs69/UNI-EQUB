import { verifySession } from '../_shared/auth.ts';
import { writeAuditEvent } from '../_shared/audit.ts';
import { fail, json } from '../_shared/contracts.ts';
import type { CreateGroupFormationRequest, GroupFormationAction, GroupFormationPayload } from '../_shared/contracts.ts';
import { loadConfigValue } from '../_shared/config.ts';
import { getReliabilityJoinGate } from '../_shared/reliability.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupJoinRequestRecord, GroupRequestRecord, UserRecord } from '../_shared/types.ts';

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

async function listPublicFormationRequests(actor: UserRecord) {
  await assertNormalFormationEligibility(actor);
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('id, creator_id, proposed_group_name, description, contribution_amount, frequency, min_members, max_members, visibility, invite_mode, status, risk_level, terms_version, agreement_required, vesting_enabled, expires_at, created_at, updated_at')
    .eq('visibility', 'Public')
    .eq('status', 'Forming')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const requests = (data ?? []) as GroupRequestRecord[];
  const requestIds = requests.map(request => request.id);
  const participantCounts = new Map<string, number>();

  if (requestIds.length > 0) {
    const { data: participants, error: participantError } = await supabaseAdmin
      .from('group_join_requests')
      .select('group_request_id')
      .in('group_request_id', requestIds)
      .eq('status', 'Accepted');

    if (participantError) {
      throw participantError;
    }

    for (const participant of participants ?? []) {
      const requestId = String(participant.group_request_id);
      participantCounts.set(requestId, (participantCounts.get(requestId) ?? 0) + 1);
    }
  }

  return json({
    requests: requests.map(request => ({
      ...request,
      accepted_participant_count: participantCounts.get(request.id) ?? 0,
      remaining_slots: Math.max(request.max_members - (participantCounts.get(request.id) ?? 0), 0),
    })),
    filter: {
      visibility: 'Public',
      status: 'Forming',
      expiredRequestsHidden: true,
    },
  });
}

async function countAcceptedParticipants(groupRequestId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_join_requests')
    .select('id')
    .eq('group_request_id', groupRequestId)
    .eq('status', 'Accepted');

  if (error) {
    throw error;
  }
  return (data ?? []).length;
}

function assertRequestCanReceivePublicJoinRequest(request: GroupRequestRecord, actor: UserRecord) {
  if (request.creator_id === actor.User_ID) {
    throw new Error('Group creators are already participants in their own formation request.');
  }
  if (request.visibility !== 'Public') {
    throw new Error('This group request is private and requires an invitation.');
  }
  if (request.status !== 'Forming') {
    throw new Error('This group request is not accepting join requests.');
  }
  if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
    throw new Error('This group request has expired.');
  }
}

async function requestJoinFormationGroup(actor: UserRecord, body: GroupFormationPayload) {
  if (!body.requestId) {
    throw new Error('Missing group request id.');
  }

  const { data: groupRequest, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('id', body.requestId)
    .single();

  if (error) {
    throw error;
  }

  const request = groupRequest as GroupRequestRecord;
  assertRequestCanReceivePublicJoinRequest(request, actor);
  if (!body.groupTermsAccepted || body.acceptedTermsVersion !== request.terms_version) {
    throw new Error('The current group terms must be accepted before requesting to join.');
  }

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('group_join_requests')
    .select('*')
    .eq('group_request_id', request.id)
    .eq('user_id', actor.User_ID)
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  const existing = (existingRows?.[0] ?? null) as GroupJoinRequestRecord | null;
  const acceptedCount = await countAcceptedParticipants(request.id);
  if (existing?.status === 'Requested' || existing?.status === 'Accepted') {
    return json({
      groupRequest: request,
      joinRequest: existing,
      alreadyExisted: true,
      accepted_participant_count: acceptedCount,
      remaining_slots: Math.max(request.max_members - acceptedCount, 0),
    });
  }
  if (acceptedCount >= request.max_members) {
    throw new Error('This group request has no remaining slots.');
  }

  const payload = {
    status: 'Requested',
    requested_at: new Date().toISOString(),
    accepted_at: null,
    rejected_at: null,
    removed_at: null,
    decision_by: null,
    decision_reason: `Accepted group terms ${request.terms_version}`,
  };

  const joinMutation = existing
    ? supabaseAdmin.from('group_join_requests').update(payload).eq('id', existing.id)
    : supabaseAdmin.from('group_join_requests').insert({
      group_request_id: request.id,
      user_id: actor.User_ID,
      ...payload,
    });

  const { data: joinRequest, error: joinError } = await joinMutation.select('*').single();
  if (joinError) {
    throw joinError;
  }

  return json({
    groupRequest: request,
    joinRequest,
    alreadyExisted: false,
    accepted_participant_count: acceptedCount,
    remaining_slots: Math.max(request.max_members - acceptedCount, 0),
  }, 201);
}

async function loadCreatorManagedJoinRequest(actor: UserRecord, joinRequestId: string | undefined) {
  if (!joinRequestId) {
    throw new Error('Missing join request id.');
  }

  const { data: joinRequest, error: joinError } = await supabaseAdmin
    .from('group_join_requests')
    .select('*')
    .eq('id', joinRequestId)
    .single();

  if (joinError) {
    throw joinError;
  }

  const participant = joinRequest as GroupJoinRequestRecord;
  const { data: groupRequest, error: groupError } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('id', participant.group_request_id)
    .single();

  if (groupError) {
    throw groupError;
  }

  const request = groupRequest as GroupRequestRecord;
  if (request.creator_id !== actor.User_ID) {
    throw new Error('Only the group request creator can manage formation participants.');
  }
  if (request.status !== 'Forming') {
    throw new Error('Participants can only be managed while a group request is forming.');
  }
  if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
    throw new Error('This group request has expired.');
  }
  if (participant.user_id === actor.User_ID) {
    throw new Error('The creator participant row cannot be changed through participant management.');
  }

  return { request, participant };
}

async function acceptJoinRequest(actor: UserRecord, body: GroupFormationPayload) {
  const { request, participant } = await loadCreatorManagedJoinRequest(actor, body.joinRequestId);
  if (participant.status === 'Accepted') {
    return json({ groupRequest: request, joinRequest: participant, alreadyAccepted: true });
  }
  if (participant.status !== 'Requested') {
    throw new Error('Only requested participants can be accepted.');
  }

  const acceptedCount = await countAcceptedParticipants(request.id);
  if (acceptedCount >= request.max_members) {
    throw new Error('This group request has no remaining slots.');
  }

  const { data, error } = await supabaseAdmin
    .from('group_join_requests')
    .update({
      status: 'Accepted',
      accepted_at: new Date().toISOString(),
      rejected_at: null,
      removed_at: null,
      decision_by: actor.User_ID,
      decision_reason: cleanText(body.decisionReason) || 'Creator accepted participant into the forming group.',
    })
    .eq('id', participant.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await writeAuditEvent({
    actor,
    eventType: 'group_formation_join_accepted',
    entityType: 'group_join_requests',
    entityId: participant.id,
    metadata: {
      group_request_id: request.id,
      participant_user_id: participant.user_id,
    },
  });

  return json({
    groupRequest: request,
    joinRequest: data,
    accepted_participant_count: acceptedCount + 1,
    remaining_slots: Math.max(request.max_members - acceptedCount - 1, 0),
  });
}

async function removeFormationParticipant(actor: UserRecord, body: GroupFormationPayload) {
  const { request, participant } = await loadCreatorManagedJoinRequest(actor, body.joinRequestId);
  if (participant.status === 'Rejected' || participant.status === 'Removed') {
    return json({ groupRequest: request, joinRequest: participant, alreadyFinal: true });
  }
  if (participant.status !== 'Requested' && participant.status !== 'Accepted') {
    throw new Error('Only requested or accepted participants can be rejected or removed.');
  }

  const now = new Date().toISOString();
  const nextStatus = participant.status === 'Requested' ? 'Rejected' : 'Removed';
  const { data, error } = await supabaseAdmin
    .from('group_join_requests')
    .update({
      status: nextStatus,
      rejected_at: nextStatus === 'Rejected' ? now : participant.rejected_at,
      removed_at: nextStatus === 'Removed' ? now : participant.removed_at,
      decision_by: actor.User_ID,
      decision_reason: cleanText(body.decisionReason) || (nextStatus === 'Rejected'
        ? 'Creator rejected participant request.'
        : 'Creator removed participant from the forming group.'),
    })
    .eq('id', participant.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await writeAuditEvent({
    actor,
    eventType: nextStatus === 'Rejected' ? 'group_formation_join_rejected' : 'group_formation_participant_removed',
    entityType: 'group_join_requests',
    entityId: participant.id,
    metadata: {
      group_request_id: request.id,
      participant_user_id: participant.user_id,
      previous_status: participant.status,
      next_status: nextStatus,
    },
  });

  return json({
    groupRequest: request,
    joinRequest: data,
    action: nextStatus,
  });
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
        return listPublicFormationRequests(actor);

      case 'getRequest':
      case 'acceptInvite':
        assertVerifiedMember(actor);
        return pendingImplementation(body.action, actor);

      case 'createRequest':
        await assertNormalFormationEligibility(actor);
        return createFormationRequest(actor, body.createRequest);

      case 'requestJoin':
        await assertNormalFormationEligibility(actor);
        return requestJoinFormationGroup(actor, body);

      case 'acceptJoin':
        assertVerifiedMember(actor);
        return acceptJoinRequest(actor, body);

      case 'removeParticipant':
        assertVerifiedMember(actor);
        return removeFormationParticipant(actor, body);

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
