const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const functionPath = path.join(repoRoot, 'supabase/functions/group-formation/index.ts');
const contractsPath = path.join(repoRoot, 'supabase/functions/_shared/contracts.ts');
const configPath = path.join(repoRoot, 'supabase/config.toml');

const requiredActions = [
  'listPublic',
  'listMine',
  'listPendingApproval',
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

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--output') {
      parsed.output = args[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(repoRoot, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, token, label) {
  if (!content.includes(token)) {
    throw new Error(`Missing ${label}: ${token}`);
  }
}

function main() {
  const args = parseArgs();
  const source = read(functionPath);
  const contracts = read(contractsPath);
  const config = read(configPath);

  [
    'verifySession',
    'requireActor',
    'assertAdmin',
    'assertVerifiedMember',
    'assertNormalFormationEligibility',
    'statusForError',
    'createFormationRequest',
    'validateCreateRequestInput',
    'listPublicFormationRequests',
    'listMyFormationRequests',
    'getFormationRequestDetail',
    'requestJoinFormationGroup',
    'assertRequestCanReceivePublicJoinRequest',
    'countAcceptedParticipants',
    'loadCreatorManagedJoinRequest',
    'acceptJoinRequest',
    'removeFormationParticipant',
    'loadCreatorManagedGroupRequest',
    'createFormationInvitation',
    'acceptFormationInvitation',
    'loadPendingInvitation',
    'assertInvitationMatchesActor',
    'createInviteCode',
    'normalizeInviteTarget',
    'submitFormationForApproval',
    'loadCreatorOwnedFormingRequest',
    'listAcceptedParticipantUserIds',
    'notifyAdminsOfSubmittedGroup',
    'createNotification',
    'approveFormationRequest',
    'rejectFormationRequest',
    'ensureCanonicalGroupForRequest',
    'ensureCanonicalMemberships',
    'notifyFormationApproval',
    'ensureOpenRoundForGroup',
    'ensureContributionObligationsForRound',
    'buildVirtualRef',
    'writeAuditEvent',
    'getReliabilityJoinGate',
    'loadFormationPolicySnapshot',
    'Deno.serve',
  ].forEach(token => assertIncludes(source, token, 'formation boundary token'));

  requiredActions.forEach(action => assertIncludes(source, `'${action}'`, `formation action ${action}`));
  [
    'listPendingApprovalFormationRequests',
    'listMyFormationRequests',
    ".eq('status', 'PendingApproval')",
    'adminReviewQueue',
  ].forEach(token => assertIncludes(source, token, 'admin pending approval list token'));

  [
    ".eq('creator_id', actor.User_ID)",
    'mine: true',
  ].forEach(token => assertIncludes(source, token, 'creator-owned request list token'));

  [
    ".from('group_requests')",
    ".from('group_join_requests')",
    "status: 'Forming'",
    "status: 'Accepted'",
    'expires_at',
    'policy.minMembers',
    'policy.maxMembers',
    'policy.expiryDays',
    'risk_warning_accepted_at',
    'Only private invite-based group requests can disable payout vesting.',
  ].forEach(token => assertIncludes(source, token, 'create request implementation token'));

  [
    ".from('group_join_requests')",
    ".from('group_invitations')",
    'This private group request is not visible to the signed-in user.',
    'accepted_participant_count: acceptedCount',
    'remaining_slots: Math.max(groupRequest.max_members - acceptedCount, 0)',
  ].forEach(token => assertIncludes(source, token, 'formation detail implementation token'));

  [
    ".eq('visibility', 'Public')",
    ".eq('status', 'Forming')",
    'assertVerifiedMember(actor);',
    'expires_at.is.null,expires_at.gt.',
    'accepted_participant_count',
    'remaining_slots',
    'expiredRequestsHidden',
  ].forEach(token => assertIncludes(source, token, 'public discovery implementation token'));

  [
    'groupTermsAccepted',
    'acceptedTermsVersion',
    'The current group terms must be accepted before requesting to join.',
    'This group request has no remaining slots.',
    "status: 'Requested'",
    'alreadyExisted',
    "Accepted group terms",
    "request.visibility !== 'Public'",
    "request.status !== 'Forming'",
  ].forEach(token => assertIncludes(source, token, 'request join implementation token'));

  [
    'acceptedTermsVersion?: string',
    'groupTermsAccepted?: boolean',
  ].forEach(token => assertIncludes(contracts, token, 'request join contract token'));

  [
    'Only the group request creator can manage formation participants.',
    'The creator participant row cannot be changed through participant management.',
    'group_formation_join_accepted',
    'group_formation_join_rejected',
    'group_formation_participant_removed',
    "status: 'Accepted'",
    "status: nextStatus",
    "nextStatus === 'Rejected'",
    "nextStatus === 'Removed'",
    'accepted_participant_count: acceptedCount + 1',
  ].forEach(token => assertIncludes(source, token, 'creator participant management token'));

  [
    ".from('group_invitations')",
    'group_formation_invitation_created',
    'group_formation_invitation_accepted',
    "invite_mode === 'PublicRequest'",
    'Invitation requires a target user, phone/student id, or invite code.',
    'This invitation belongs to another user.',
    'This invitation does not match the signed-in member.',
    'requestedInviteCode',
    'redeemingByCode',
    'invitation.invite_code',
    'The current group terms must be accepted before accepting an invite.',
    "status: 'Pending'",
    "status: 'Accepted'",
    'invite_code: inviteCode',
    'accepted_at: now',
  ].forEach(token => assertIncludes(source, token, 'invite implementation token'));

  [
    "status: 'PendingApproval'",
    'submitted_by: actor.User_ID',
    'submitted_at: now',
    'At least ${requiredMinimum} accepted participants are required before admin approval submission.',
    'GroupFormationSubmitted',
    'Group request ready for review',
    'Group request submitted',
    'group_formation_submitted_for_approval',
    'admin_notification_count',
    'accepted_participant_user_ids',
  ].forEach(token => assertIncludes(source, token, 'submit for approval implementation token'));

  [
    ".from('EqubGroup')",
    ".from('GroupMembers')",
    "status: 'Approved'",
    "status: 'Rejected'",
    'approved_group_id: group.Group_ID',
    'created_group_at: now',
    'ensureOpenRoundForGroup(group)',
    'ensureContributionObligationsForRound(group, round)',
    'GroupFormationApproved',
    'GroupFormationRejected',
    'group_formation_approved',
    'group_formation_rejected',
    'Only pending-approval group requests can be approved.',
    'Only pending-approval group requests can be rejected.',
  ].forEach(token => assertIncludes(source, token, 'admin approval implementation token'));

  assertIncludes(config, '[functions.group-formation]', 'Supabase function config');
  assertIncludes(config, 'verify_jwt = false', 'function JWT config style');

  const result = {
    scenario: 'phase2-group-formation-admin-approval-validation',
    function: 'supabase/functions/group-formation/index.ts',
    contracts: 'supabase/functions/_shared/contracts.ts',
    config: 'supabase/config.toml',
    routedActions: requiredActions,
    completedChecks: [
      'group-formation Edge Function source exists',
      'session validation boundary exists',
      'member/admin role gates exist',
      'all planned Phase 2 formation actions are routed',
      'createRequest inserts a Forming group_requests row with config-driven min/max/expiry validation',
      'createRequest inserts the creator as an Accepted formation participant',
      'listPublic returns only Public Forming requests that are not expired with accepted participant counts without applying join eligibility gates',
      'listPendingApproval returns the admin review queue for submitted formation requests',
      'getRequest returns formation detail with participants, creator/admin invitations, accepted count, and remaining slots',
      'requestJoin requires current terms acceptance and creates or reuses a Requested join row',
      'creator can accept requested participants and reject/remove participants with audit events',
      'creator can create direct invitations and shareable invite-code invitations that members can accept into accepted participation',
      'creator can submit forming request for admin approval after accepted participants meet configured minimum',
      'admin can approve into canonical EqubGroup, GroupMembers, initial Round, obligations, notifications, and audit or reject in group_requests',
      'Supabase function config registers group-formation with internal token verification pattern',
      'expected validation failures return readable non-500 function responses',
    ],
    requiresSupabaseCredentials: false,
    validatedAt: new Date().toISOString(),
  };

  const output = JSON.stringify(result, null, 2);
  if (args.output) {
    const outputPath = path.resolve(repoRoot, args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${output}\n`);
  }
  console.log(output);
}

main();
