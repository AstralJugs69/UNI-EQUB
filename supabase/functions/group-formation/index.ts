import { verifySession } from '../_shared/auth.ts';
import { writeAuditEvent } from '../_shared/audit.ts';
import { fail, json } from '../_shared/contracts.ts';
import type { CreateGroupFormationRequest, GroupFormationAction, GroupFormationPayload } from '../_shared/contracts.ts';
import { loadConfigValue } from '../_shared/config.ts';
import { createNotification } from '../_shared/notifications.ts';
import { ensureContributionObligationsForRound } from '../_shared/obligations.ts';
import { getReliabilityJoinGate } from '../_shared/reliability.ts';
import { ensureOpenRoundForGroup } from '../_shared/rounds.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { ContributionObligationRecord, GroupInvitationRecord, GroupJoinRequestRecord, GroupRecord, GroupRequestRecord, MembershipRecord, RoundRecord, UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const routedActions: GroupFormationAction[] = [
  'listPublic',
  'listMine',
  'listPendingApproval',
  'getRequest',
  'lookupInviteCode',
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

function normalizeInviteTarget(value: string | undefined | null) {
  return cleanText(value).replace(/\s+/g, '').toLowerCase();
}

function createInviteCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function buildVirtualRef(groupId: string) {
  return `UEQ-${groupId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function statusForError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('required') || normalized.includes('not eligible') || normalized.includes('blocked') || normalized.includes('banned') || normalized.includes('kyc') || normalized.includes('only available') || normalized.includes('belongs to another user') || normalized.includes('can join only') || normalized.includes('would exceed active group')) {
    return 403;
  }
  if (normalized.includes('not found')) {
    return 404;
  }
  if (normalized.includes('missing') || normalized.includes('invalid') || normalized.includes('must') || normalized.includes('cannot') || normalized.includes('does not') || normalized.includes('not accepting') || normalized.includes('expired') || normalized.includes('no remaining slots') || normalized.includes('already') || normalized.includes('only') || normalized.includes('not visible') || normalized.includes('no longer pending')) {
    return 400;
  }
  return 500;
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
  const frequency = assertAllowedValue(input.frequency, ['Daily', 'Weekly', 'Bi-weekly', 'Monthly'], 'frequency');

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
  assertVerifiedMember(actor);
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

async function listMyFormationRequests(actor: UserRecord) {
  assertVerifiedMember(actor);
  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('creator_id', actor.User_ID)
    .order('updated_at', { ascending: false })
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
      creatorId: actor.User_ID,
      mine: true,
    },
  });
}

async function listPendingApprovalFormationRequests() {
  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('status', 'PendingApproval')
    .neq('visibility', 'Private')
    .order('submitted_at', { ascending: true })
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
      status: 'PendingApproval',
      adminReviewQueue: true,
    },
  });
}

async function getFormationRequestDetail(actor: UserRecord, body: GroupFormationPayload) {
  if (!body.requestId) {
    throw new Error('Missing group request id.');
  }

  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('id', body.requestId)
    .single();

  if (error) {
    throw error;
  }

  const groupRequest = data as GroupRequestRecord;
  const { data: joinRows, error: joinError } = await supabaseAdmin
    .from('group_join_requests')
    .select('*')
    .eq('group_request_id', groupRequest.id)
    .order('requested_at', { ascending: true });

  if (joinError) {
    throw joinError;
  }

  const joinRequests = (joinRows ?? []) as GroupJoinRequestRecord[];
  const canSeePrivateDetail = actor.Role === 'Admin'
    || actor.User_ID === groupRequest.creator_id
    || joinRequests.some(item => item.user_id === actor.User_ID);

  if (groupRequest.visibility === 'Private' && !canSeePrivateDetail) {
    throw new Error('This private group request is not visible to the signed-in user.');
  }

  let invitations = [] as GroupInvitationRecord[];
  if (actor.Role === 'Admin' || actor.User_ID === groupRequest.creator_id) {
    const { data: invitationRows, error: invitationError } = await supabaseAdmin
      .from('group_invitations')
      .select('*')
      .eq('group_request_id', groupRequest.id)
      .order('created_at', { ascending: false });

    if (invitationError) {
      throw invitationError;
    }
    invitations = (invitationRows ?? []) as GroupInvitationRecord[];
  }

  const acceptedCount = joinRequests.filter(item => item.status === 'Accepted').length;
  return json({
    groupRequest,
    joinRequests,
    invitations,
    accepted_participant_count: acceptedCount,
    remaining_slots: Math.max(groupRequest.max_members - acceptedCount, 0),
  });
}

async function lookupFormationInviteCode(actor: UserRecord, body: GroupFormationPayload) {
  if (!body.inviteCode) {
    throw new Error('Missing invite code.');
  }
  const invitation = await loadPendingInvitation(body);
  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('id', invitation.group_request_id)
    .single();

  if (error) {
    throw error;
  }

  const groupRequest = data as GroupRequestRecord;
  if (groupRequest.status !== 'Forming') {
    throw new Error('This group request is not accepting invitations.');
  }
  if (groupRequest.expires_at && new Date(groupRequest.expires_at).getTime() <= Date.now()) {
    throw new Error('This group request has expired.');
  }

  const { data: joinRows, error: joinError } = await supabaseAdmin
    .from('group_join_requests')
    .select('*')
    .eq('group_request_id', groupRequest.id)
    .order('requested_at', { ascending: true });

  if (joinError) {
    throw joinError;
  }

  const joinRequests = (joinRows ?? []) as GroupJoinRequestRecord[];
  const acceptedCount = joinRequests.filter(item => item.status === 'Accepted').length;
  const currentUserJoin = joinRequests.filter(item => item.user_id === actor.User_ID);
  return json({
    groupRequest,
    joinRequests: currentUserJoin,
    invitations: [invitation],
    accepted_participant_count: acceptedCount,
    remaining_slots: Math.max(groupRequest.max_members - acceptedCount, 0),
    invite_code_preview: true,
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

async function listAcceptedParticipantUserIds(groupRequestId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_join_requests')
    .select('user_id')
    .eq('group_request_id', groupRequestId)
    .eq('status', 'Accepted');

  if (error) {
    throw error;
  }
  return (data ?? []).map(row => String(row.user_id));
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

async function loadCreatorManagedGroupRequest(actor: UserRecord, requestId: string | undefined) {
  if (!requestId) {
    throw new Error('Missing group request id.');
  }

  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error) {
    throw error;
  }

  const request = data as GroupRequestRecord;
  if (request.creator_id !== actor.User_ID) {
    throw new Error('Only the group request creator can invite participants.');
  }
  if (request.status !== 'Forming') {
    throw new Error('Invitations can only be created while a group request is forming.');
  }
  if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
    throw new Error('This group request has expired.');
  }

  return request;
}

async function createFormationInvitation(actor: UserRecord, body: GroupFormationPayload) {
  const request = await loadCreatorManagedGroupRequest(actor, body.requestId);
  const invitedTarget = cleanText(body.invitedPhoneOrStudentId) || null;
  if (request.invite_mode === 'PublicRequest' && (body.targetUserId || invitedTarget)) {
    throw new Error('Public forming groups only support shareable invite codes.');
  }
  const shouldCreateInviteCode = request.invite_mode === 'InviteCode' || request.invite_mode === 'InviteCodeAndDirect' || (!body.targetUserId && !invitedTarget);
  const inviteCode = body.inviteCode ? cleanText(body.inviteCode).toUpperCase() : (shouldCreateInviteCode ? createInviteCode() : null);

  if (!body.targetUserId && !invitedTarget && !inviteCode) {
    throw new Error('Invitation requires a target user, phone/student id, or invite code.');
  }
  if (body.targetUserId === actor.User_ID) {
    throw new Error('The creator is already a participant in this forming group.');
  }

  const { data, error } = await supabaseAdmin
    .from('group_invitations')
    .insert({
      group_request_id: request.id,
      invited_user_id: body.targetUserId ?? null,
      invited_phone_or_student_id: invitedTarget,
      invite_code: inviteCode,
      status: 'Pending',
      expires_at: request.expires_at,
      created_by: actor.User_ID,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await writeAuditEvent({
    actor,
    eventType: 'group_formation_invitation_created',
    entityType: 'group_invitations',
    entityId: (data as GroupInvitationRecord).id,
    metadata: {
      group_request_id: request.id,
      invited_user_id: body.targetUserId ?? null,
      invited_phone_or_student_id: invitedTarget,
      has_invite_code: Boolean(inviteCode),
    },
  });

  return json({
    groupRequest: request,
    invitation: data,
  }, 201);
}

async function loadPendingInvitation(body: GroupFormationPayload) {
  if (!body.invitationId && !body.inviteCode) {
    throw new Error('Missing invitation id or invite code.');
  }

  let query = supabaseAdmin.from('group_invitations').select('*');
  if (body.invitationId) {
    query = query.eq('id', body.invitationId);
  } else {
    query = query.eq('invite_code', cleanText(body.inviteCode).toUpperCase());
  }

  const { data, error } = await query.single();
  if (error) {
    throw error;
  }

  const invitation = data as GroupInvitationRecord;
  if (invitation.status !== 'Pending') {
    throw new Error('This invitation is no longer pending.');
  }
  if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
    throw new Error('This invitation has expired.');
  }
  return invitation;
}

function assertInvitationMatchesActor(invitation: GroupInvitationRecord, actor: UserRecord, body: GroupFormationPayload) {
  if (invitation.invited_user_id && invitation.invited_user_id !== actor.User_ID) {
    throw new Error('This invitation belongs to another user.');
  }
  if (invitation.invited_phone_or_student_id) {
    const actorPhone = normalizeInviteTarget(actor.Phone_Number);
    const target = normalizeInviteTarget(invitation.invited_phone_or_student_id);
    if (actorPhone !== target) {
      throw new Error('This invitation does not match the signed-in member.');
    }
  }
  if (!body.groupTermsAccepted) {
    throw new Error('The current group terms must be accepted before accepting an invite.');
  }
}

async function acceptFormationInvitation(actor: UserRecord, body: GroupFormationPayload) {
  const invitation = await loadPendingInvitation(body);
  const { data: groupRequest, error: requestError } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('id', invitation.group_request_id)
    .single();

  if (requestError) {
    throw requestError;
  }

  const request = groupRequest as GroupRequestRecord;
  assertInvitationMatchesActor(invitation, actor, body);
  if (body.acceptedTermsVersion !== request.terms_version) {
    throw new Error('The current group terms must be accepted before accepting an invite.');
  }
  if (request.status !== 'Forming') {
    throw new Error('This group request is not accepting invitations.');
  }
  if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
    throw new Error('This group request has expired.');
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
  if (existing?.status !== 'Accepted' && acceptedCount >= request.max_members) {
    throw new Error('This group request has no remaining slots.');
  }

  const now = new Date().toISOString();
  const reusableInviteCode = Boolean(body.inviteCode && invitation.invite_code && !invitation.invited_user_id && !invitation.invited_phone_or_student_id);
  const participantPayload = {
    status: 'Accepted',
    requested_at: existing?.requested_at ?? now,
    accepted_at: now,
    rejected_at: null,
    removed_at: null,
    decision_by: invitation.created_by,
    decision_reason: `Accepted invite ${invitation.id} with group terms ${request.terms_version}`,
  };

  const participantMutation = existing
    ? supabaseAdmin.from('group_join_requests').update(participantPayload).eq('id', existing.id)
    : supabaseAdmin.from('group_join_requests').insert({
      group_request_id: request.id,
      user_id: actor.User_ID,
      ...participantPayload,
    });

  const { data: joinRequest, error: joinError } = await participantMutation.select('*').single();
  if (joinError) {
    throw joinError;
  }

  let updatedInvitation = invitation;
  if (!reusableInviteCode) {
    const { data: acceptedInvitation, error: invitationError } = await supabaseAdmin
      .from('group_invitations')
      .update({
        status: 'Accepted',
        accepted_at: now,
      })
      .eq('id', invitation.id)
      .select('*')
      .single();

    if (invitationError) {
      throw invitationError;
    }
    updatedInvitation = acceptedInvitation as GroupInvitationRecord;
  }

  await writeAuditEvent({
    actor,
    eventType: 'group_formation_invitation_accepted',
    entityType: 'group_invitations',
    entityId: invitation.id,
    metadata: {
      group_request_id: request.id,
      join_request_id: (joinRequest as GroupJoinRequestRecord).id,
      previous_join_status: existing?.status ?? null,
      reusable_invite_code: reusableInviteCode,
    },
  });

  const finalAcceptedCount = existing?.status === 'Accepted' ? acceptedCount : acceptedCount + 1;
  return json({
    groupRequest: request,
    invitation: updatedInvitation,
    joinRequest,
    accepted_participant_count: finalAcceptedCount,
    remaining_slots: Math.max(request.max_members - finalAcceptedCount, 0),
  });
}

async function loadCreatorOwnedFormingRequest(actor: UserRecord, requestId: string | undefined) {
  if (!requestId) {
    throw new Error('Missing group request id.');
  }

  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error) {
    throw error;
  }

  const request = data as GroupRequestRecord;
  if (request.creator_id !== actor.User_ID) {
    throw new Error('Only the group request creator can activate this request.');
  }
  if (request.status !== 'Forming') {
    throw new Error('Only forming group requests can be activated.');
  }
  if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
    throw new Error('This group request has expired.');
  }
  return request;
}

async function listAdminUsers() {
  const { data, error } = await supabaseAdmin
    .from('User')
    .select('*')
    .eq('Role', 'Admin');

  if (error) {
    throw error;
  }
  return (data ?? []) as UserRecord[];
}

async function notifyAdminsOfSubmittedGroup(request: GroupRequestRecord, acceptedParticipantCount: number) {
  const admins = await listAdminUsers();
  const notifications = [];
  for (const admin of admins) {
    notifications.push(await createNotification({
      userId: admin.User_ID,
      type: 'GroupFormationSubmitted',
      severity: 'Info',
      title: 'Group request ready for review',
      message: `${request.proposed_group_name} has ${acceptedParticipantCount} accepted participants and is awaiting admin approval.`,
      actionRoute: 'admin/group-formation',
      relatedEntityType: 'group_requests',
      relatedEntityId: request.id,
      metadata: {
        group_request_id: request.id,
        accepted_participant_count: acceptedParticipantCount,
        min_members: request.min_members,
      },
    }));
  }
  return notifications;
}

async function submitFormationForApproval(actor: UserRecord, body: GroupFormationPayload) {
  const request = await loadCreatorOwnedFormingRequest(actor, body.requestId);
  const policy = await loadFormationPolicySnapshot();
  const acceptedParticipantUserIds = await listAcceptedParticipantUserIds(request.id);
  const requiredMinimum = Math.max(request.min_members, policy.minMembers);

  if (acceptedParticipantUserIds.length < requiredMinimum) {
    throw new Error(`At least ${requiredMinimum} accepted participants are required before this group can start.`);
  }

  if (request.visibility === 'Private') {
    return activateFormationRequest({
      actor,
      request,
      acceptedParticipantUserIds,
      decisionReason: 'Private invite-based group started by creator.',
      eventType: 'group_formation_private_started',
      reviewedBy: null,
    });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .update({
      status: 'PendingApproval',
      submitted_by: actor.User_ID,
      submitted_at: now,
    })
    .eq('id', request.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const submittedRequest = data as GroupRequestRecord;
  const adminNotifications = await notifyAdminsOfSubmittedGroup(submittedRequest, acceptedParticipantUserIds.length);
  const creatorNotification = await createNotification({
    userId: actor.User_ID,
    type: 'GroupFormationSubmitted',
    severity: 'Success',
    title: 'Group request submitted',
    message: `${submittedRequest.proposed_group_name} is now waiting for admin approval.`,
    actionRoute: 'member/group-formation',
    relatedEntityType: 'group_requests',
    relatedEntityId: submittedRequest.id,
    metadata: {
      group_request_id: submittedRequest.id,
      accepted_participant_count: acceptedParticipantUserIds.length,
      min_members: submittedRequest.min_members,
    },
  });

  await writeAuditEvent({
    actor,
    eventType: 'group_formation_submitted_for_approval',
    entityType: 'group_requests',
    entityId: submittedRequest.id,
    metadata: {
      accepted_participant_count: acceptedParticipantUserIds.length,
      accepted_participant_user_ids: acceptedParticipantUserIds,
      required_minimum: requiredMinimum,
      admin_notification_count: adminNotifications.length,
    },
  });

  return json({
    groupRequest: submittedRequest,
    accepted_participant_count: acceptedParticipantUserIds.length,
    required_minimum: requiredMinimum,
    notifications: {
      admins: adminNotifications.length,
      creator: creatorNotification.id,
    },
  });
}

async function loadAdminReviewRequest(requestId: string | undefined) {
  if (!requestId) {
    throw new Error('Missing group request id.');
  }

  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error) {
    throw error;
  }
  return data as GroupRequestRecord;
}

async function getGroupById(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('EqubGroup')
    .select('*')
    .eq('Group_ID', groupId)
    .single();

  if (error) {
    throw error;
  }
  return data as GroupRecord;
}

async function ensureCanonicalGroupForRequest(request: GroupRequestRecord) {
  if (request.approved_group_id) {
    return getGroupById(request.approved_group_id);
  }

  const groupId = crypto.randomUUID();
  const { data, error } = await supabaseAdmin
    .from('EqubGroup')
    .insert({
      Group_ID: groupId,
      Creator_ID: request.creator_id,
      Group_Name: request.proposed_group_name.trim().slice(0, 50),
      Amount: request.contribution_amount,
      Max_Members: request.max_members,
      Frequency: request.frequency,
      Virtual_Acc_Ref: buildVirtualRef(groupId),
      Status: 'Active',
      Start_Date: new Date().toISOString().slice(0, 10),
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as GroupRecord;
}

async function ensureCanonicalMemberships(group: GroupRecord, userIds: string[]) {
  const rows = [...new Set(userIds)].map(userId => ({
    Group_ID: group.Group_ID,
    User_ID: userId,
    Joined_At: new Date().toISOString(),
    Status: 'Active',
  }));

  if (!rows.length) {
    return [] as MembershipRecord[];
  }

  const { data, error } = await supabaseAdmin
    .from('GroupMembers')
    .upsert(rows, { onConflict: 'Group_ID,User_ID' })
    .select('*');

  if (error) {
    throw error;
  }
  return (data ?? []) as MembershipRecord[];
}

async function assertAcceptedParticipantsCanBecomeActive(userIds: string[]) {
  const blockedParticipants = [];
  for (const userId of [...new Set(userIds)]) {
    const gate = await getReliabilityJoinGate(userId);
    if (!gate.canJoinNormalGroup) {
      blockedParticipants.push({
        userId,
        reason: gate.blockedReason ?? 'User is not eligible to join another active group.',
        publicStatus: gate.profile.public_status,
        activeGroupCount: gate.activeGroupCount,
        activeGroupLimit: gate.activeGroupLimit,
      });
    }
  }

  if (blockedParticipants.length > 0) {
    throw new Error(`Cannot approve this group because ${blockedParticipants.length} accepted participant${blockedParticipants.length === 1 ? '' : 's'} would exceed active group reliability limits.`);
  }
}

async function notifyFormationApproval(request: GroupRequestRecord, group: GroupRecord, participantUserIds: string[]) {
  const notifications = [];
  for (const userId of [...new Set(participantUserIds)]) {
    notifications.push(await createNotification({
      userId,
      type: 'GroupFormationApproved',
      severity: 'Success',
      title: 'Group approved',
      message: `${group.Group_Name} is now active.`,
      actionRoute: 'member/group',
      relatedEntityType: 'EqubGroup',
      relatedEntityId: group.Group_ID,
      metadata: {
        group_request_id: request.id,
        group_id: group.Group_ID,
      },
    }));
  }
  return notifications;
}

async function activateFormationRequest(input: {
  actor: UserRecord;
  request: GroupRequestRecord;
  acceptedParticipantUserIds: string[];
  decisionReason: string;
  eventType: string;
  reviewedBy: string | null;
}) {
  await assertAcceptedParticipantsCanBecomeActive(input.acceptedParticipantUserIds);

  const group = await ensureCanonicalGroupForRequest(input.request);
  const memberships = await ensureCanonicalMemberships(group, input.acceptedParticipantUserIds);
  const round = await ensureOpenRoundForGroup(group) as RoundRecord;
  const obligations = await ensureContributionObligationsForRound(group, round);
  const now = new Date().toISOString();
  const { data: updatedRequest, error: updateError } = await supabaseAdmin
    .from('group_requests')
    .update({
      status: 'Approved',
      reviewed_by: input.reviewedBy,
      reviewed_at: now,
      approval_decision_note: input.decisionReason,
      approved_group_id: group.Group_ID,
      created_group_at: now,
    })
    .eq('id', input.request.id)
    .select('*')
    .single();

  if (updateError) {
    throw updateError;
  }

  const participantNotifications = await notifyFormationApproval(updatedRequest as GroupRequestRecord, group, input.acceptedParticipantUserIds);
  await writeAuditEvent({
    actor: input.actor,
    eventType: input.eventType,
    entityType: 'group_requests',
    entityId: input.request.id,
    metadata: {
      group_id: group.Group_ID,
      round_id: round.Round_ID,
      accepted_participant_count: input.acceptedParticipantUserIds.length,
      membership_count: memberships.length,
      obligation_count: obligations.length,
      visibility: input.request.visibility,
    },
  });

  return json({
    groupRequest: updatedRequest as GroupRequestRecord,
    group,
    memberships,
    round,
    obligations: obligations as ContributionObligationRecord[],
    accepted_participant_count: input.acceptedParticipantUserIds.length,
    remaining_slots: Math.max(input.request.max_members - input.acceptedParticipantUserIds.length, 0),
    notifications: {
      participants: participantNotifications.length,
    },
  });
}

async function approveFormationRequest(actor: UserRecord, body: GroupFormationPayload) {
  const request = await loadAdminReviewRequest(body.requestId);
  if (request.status === 'Approved' && request.approved_group_id) {
    const group = await getGroupById(request.approved_group_id);
    return json({ groupRequest: request, group, alreadyApproved: true });
  }
  if (request.status !== 'PendingApproval') {
    throw new Error('Only pending-approval group requests can be approved.');
  }

  const policy = await loadFormationPolicySnapshot();
  const acceptedParticipantUserIds = await listAcceptedParticipantUserIds(request.id);
  const requiredMinimum = Math.max(request.min_members, policy.minMembers);
  if (acceptedParticipantUserIds.length < requiredMinimum) {
    throw new Error(`At least ${requiredMinimum} accepted participants are required before approval.`);
  }

  return activateFormationRequest({
    actor,
    eventType: 'group_formation_approved',
    request,
    acceptedParticipantUserIds,
    decisionReason: cleanText(body.decisionReason) || 'Approved by admin.',
    reviewedBy: actor.User_ID,
  });
}

async function rejectFormationRequest(actor: UserRecord, body: GroupFormationPayload) {
  const request = await loadAdminReviewRequest(body.requestId);
  if (request.status === 'Rejected') {
    return json({ groupRequest: request, alreadyRejected: true });
  }
  if (request.status !== 'PendingApproval') {
    throw new Error('Only pending-approval group requests can be rejected.');
  }

  const reason = cleanText(body.decisionReason) || 'Rejected by admin.';
  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .update({
      status: 'Rejected',
      reviewed_by: actor.User_ID,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
      approval_decision_note: reason,
    })
    .eq('id', request.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const acceptedParticipantUserIds = await listAcceptedParticipantUserIds(request.id);
  const notifications = [];
  for (const userId of [...new Set(acceptedParticipantUserIds)]) {
    notifications.push(await createNotification({
      userId,
      type: 'GroupFormationRejected',
      severity: 'Warning',
      title: 'Group request rejected',
      message: `${request.proposed_group_name} was not approved.`,
      actionRoute: 'member/group-formation',
      relatedEntityType: 'group_requests',
      relatedEntityId: request.id,
      metadata: {
        group_request_id: request.id,
        reason,
      },
    }));
  }

  await writeAuditEvent({
    actor,
    eventType: 'group_formation_rejected',
    entityType: 'group_requests',
    entityId: request.id,
    metadata: {
      reason,
      notified_participant_count: notifications.length,
    },
  });

  return json({
    groupRequest: data as GroupRequestRecord,
    notifications: {
      participants: notifications.length,
    },
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

      case 'listMine':
        return listMyFormationRequests(actor);

      case 'listPendingApproval':
        assertAdmin(actor);
        return listPendingApprovalFormationRequests();

      case 'getRequest':
        if (actor.Role !== 'Admin') {
          assertVerifiedMember(actor);
        }
        return getFormationRequestDetail(actor, body);

      case 'lookupInviteCode':
        await assertNormalFormationEligibility(actor);
        return lookupFormationInviteCode(actor, body);

      case 'acceptInvite':
        await assertNormalFormationEligibility(actor);
        return acceptFormationInvitation(actor, body);

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
        assertVerifiedMember(actor);
        return createFormationInvitation(actor, body);

      case 'submitForApproval':
        assertVerifiedMember(actor);
        return submitFormationForApproval(actor, body);

      case 'adminApprove':
        assertAdmin(actor);
        return approveFormationRequest(actor, body);

      case 'adminReject':
        assertAdmin(actor);
        return rejectFormationRequest(actor, body);

      default:
        return fail('Unsupported group formation action.', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected group formation error.';
    console.error('group-formation failed', { message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: statusForError(message),
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
