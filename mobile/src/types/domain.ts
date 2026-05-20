export type UserRole = 'Member' | 'Admin';
export type KycStatus = 'Unverified' | 'Verified' | 'Banned';
export type EqubGroupStatus = 'Pending' | 'Active' | 'Frozen' | 'Completed';
export type GroupStatus = EqubGroupStatus;
export type GroupRequestStatus = 'Draft' | 'Forming' | 'PendingApproval' | 'Approved' | 'Rejected' | 'Expired' | 'Cancelled';
export type GroupJoinRequestStatus = 'Requested' | 'Accepted' | 'Rejected' | 'Removed' | 'Withdrawn' | 'Expired';
export type GroupInvitationStatus = 'Pending' | 'Accepted' | 'Declined' | 'Expired' | 'Cancelled';
export type RoundStatus = 'Open' | 'Locked' | 'Completed';
export type TransactionStatus = 'Pending' | 'Successful' | 'Failed';
export type TransactionType = 'Contribution' | 'Payout';
export type PaymentMethod = 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
export type UssdSessionStage = 'AwaitMenu' | 'AwaitReference' | 'AwaitAmount' | 'AwaitConfirm' | 'AwaitPin' | 'Completed' | 'Cancelled' | 'Expired';
export type AppConfigValueType = 'integer' | 'number' | 'boolean' | 'string' | 'object' | 'placeholder';
export type AuditActorRole = UserRole | 'System' | 'EdgeFunction';
export type NotificationSeverity = 'Info' | 'Success' | 'Warning' | 'Error';
export type MemberKycFlowStatus = 'NotSubmitted' | 'PendingReview' | 'NeedsResubmission' | 'Verified' | 'Banned';
export type ContributionObligationStatus = 'Unpaid' | 'PendingPayment' | 'Paid' | 'Late' | 'Defaulted' | 'Waived' | 'RefundPending';
export type PaymentProviderAttemptStatus = 'Initiated' | 'Pending' | 'Successful' | 'Failed' | 'Timeout' | 'Cancelled' | 'Duplicate' | 'InvalidAmount';
export type LedgerDirection = 'Credit' | 'Debit' | 'Memo';
export type LedgerEntryType =
  | 'ContributionReceived'
  | 'PaymentAttemptPending'
  | 'PaymentAttemptFailed'
  | 'PayoutRequestCreated'
  | 'PayoutReleased'
  | 'PayoutReserved'
  | 'PayoutReleaseScheduled'
  | 'PayoutReleaseCancelled'
  | 'ReserveReleased'
  | 'ReserveFrozen'
  | 'DefaultOffset'
  | 'RefundTicketCreated'
  | 'PenaltySimulated'
  | 'GroupDisbandmentAdjustment';
export type PayoutRequestStatus = 'Pending' | 'PartiallyReleased' | 'Completed' | 'Failed' | 'Frozen' | 'Cancelled';
export type PayoutReleaseScheduleStatus = 'Pending' | 'Released' | 'Frozen' | 'Cancelled';
export type ReliabilityPublicStatus = 'New' | 'BuildingTrust' | 'Trusted' | 'Restricted' | 'Banned';
export type UserRestrictionStatus = 'Active' | 'ClearedByAdmin' | 'ClearedByRecovery' | 'EscalatedToBan';
export type GroupFreezeEventStatus = 'Open' | 'UnderReview' | 'ResolvedContinue' | 'ResolvedKeepFrozen' | 'Cancelled';
export type GroupFreezeResolutionAction = 'ContinueWithReserveFrozen' | 'KeepFrozenForReview' | 'CreateRefundTickets';
export type GroupResolutionPollStatus = 'Open' | 'Closed' | 'Expired' | 'Cancelled';
export type GroupResolutionPollAction = 'ContinueWithReserveFrozen' | 'KeepFrozenForReview' | 'CreateRefundTickets';
export type RefundTicketStatus = 'Created' | 'PendingReview' | 'SimulatedCompleted' | 'Cancelled';
export type KycSubmissionStatus = 'PendingReview' | 'Approved' | 'Rejected' | 'NeedsResubmission' | 'Superseded';
export type KycDocumentKind = 'front_id' | 'back_id' | 'selfie' | 'legacy_student_id';

export interface UserRecord {
  User_ID: string;
  Full_Name: string;
  Phone_Number: string;
  Password_Hash: string;
  Student_ID_Img: string;
  KYC_Status: KycStatus;
  Role: UserRole;
  Created_At: string;
}

export interface GroupRecord {
  Group_ID: string;
  Creator_ID: string;
  Group_Name: string;
  Amount: number;
  Max_Members: number;
  Frequency: 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly';
  Virtual_Acc_Ref: string;
  Status: GroupStatus;
  Start_Date: string;
  Description: string;
}

export interface MembershipRecord {
  Membership_ID: string;
  Group_ID: string;
  User_ID: string;
  Joined_At: string;
  Status: 'Active' | 'Left' | 'Removed';
}

export interface RoundRecord {
  Round_ID: string;
  Group_ID: string;
  Round_Number: number;
  Winner_ID: string | null;
  Draw_Date: string | null;
  Status: RoundStatus;
}

export interface TransactionRecord {
  Trans_ID: string;
  User_ID: string;
  Round_ID: string;
  Amount: number;
  Type: TransactionType;
  Payment_Method: PaymentMethod;
  Gateway_Ref: string;
  Status: TransactionStatus;
  Date: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
  source?: 'Durable' | 'Derived';
  severity?: NotificationSeverity;
  actionRoute?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

export interface ReportSummary {
  title: string;
  format: 'PDF' | 'CSV';
  description: string;
}

export interface SessionUser {
  userId: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  kycStatus: KycStatus;
}

export interface AuthSession {
  token: string;
  user: SessionUser;
}

export interface DashboardSnapshot {
  currentGroup: GroupRecord | null;
  activeGroups: GroupRecord[];
  currentRound: RoundRecord | null;
  paidCount: number;
  totalMembers: number;
  totalSaved: number;
  readyPayout: number;
  recentTransactions: TransactionRecord[];
  kycState: MemberKycState;
  reliabilityProfile?: UserReliabilityProfileRecord | null;
}

export interface MemberKycState {
  status: MemberKycFlowStatus;
  canSubmit: boolean;
  latestSubmissionId?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  decisionNote?: string | null;
}

export interface WalletSnapshot {
  balance: number;
  readyPayout: number;
  reservedPayout: number;
  pendingReserveReleases: number;
  defaultDestination: string;
}

export interface GroupStatusSnapshot {
  group: GroupRecord;
  currentRound: RoundRecord | null;
  paidCount: number;
  totalMembers: number;
  winnerHistory: Array<{ roundNumber: number; winnerName: string }>;
  contributors?: GroupStatusContributor[];
  activeResolutionPoll?: GroupResolutionPollSummary | null;
  refundTickets?: RefundTicketRecord[];
  canCurrentUserPay: boolean;
  isFrozen: boolean;
}

export interface GroupStatusContributor {
  userId: string;
  fullName: string;
  initials: string;
  joinedAt: string;
  hasPaidCurrentRound: boolean;
  isCurrentWinner: boolean;
  cyclesWon: number;
}

export interface PaymentResult {
  receiptRef: string;
  amount: number;
  method: PaymentMethod;
  autoDrawTriggered: boolean;
  payoutAmount: number;
}

export interface UssdSessionState {
  sessionId: string;
  shortCode: string;
  providerLabel: string;
  stage: UssdSessionStage;
  prompt: string;
  inputLabel: string;
  expiresAt: string;
  allowCancel: boolean;
  expectsMaskedInput?: boolean;
  error?: string;
  paymentResult?: PaymentResult;
}

export interface ReminderBatchResult {
  queue: string[];
  sentAt: string;
}

export interface ExportedReport {
  fileName: string;
  format: 'PDF' | 'CSV';
  content: string;
  contentBase64?: string;
  mimeType?: string;
}

export interface AdminOverview {
  pendingKycCount: number;
  pendingGroupCount: number;
  activeGroupCount: number;
  exportsCount: number;
  logs: string[];
  reminderQueue: string[];
  reliabilitySummary?: Partial<Record<ReliabilityPublicStatus, number>>;
  auditTimeline?: AuditTimelineItem[];
  providerLogs?: Array<{
    provider: PaymentMethod | 'ReminderEngine';
    status: 'Queued' | 'Successful' | 'Failed';
    message: string;
    createdAt: string;
  }>;
}

export interface AuditTimelineItem {
  id: string;
  eventType: string;
  actorRole: 'Member' | 'Admin' | 'System' | 'EdgeFunction';
  actorName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  summary: string;
}

export interface KycReviewItem {
  user: UserRecord;
  note: string;
  submission?: KycSubmissionRecord;
  documents?: KycDocumentRecord[];
}

export interface KycSubmissionRecord {
  id: string;
  user_id: string;
  status: KycSubmissionStatus;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KycDocumentRecord {
  id: string;
  submission_id: string;
  user_id: string;
  kind: KycDocumentKind;
  storage_ref: string;
  bucket: string | null;
  object_path: string | null;
  file_name: string | null;
  content_type: string | null;
  metadata: Record<string, unknown>;
  uploaded_at: string;
}

export interface GroupApprovalItem {
  group: GroupRecord;
  creator: UserRecord;
  note: string;
}

export interface AppConfigRecord {
  key: string;
  value: unknown;
  value_type: AppConfigValueType;
  description: string;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditEventRecord {
  id: string;
  actor_user_id: string | null;
  actor_role: AuditActorRole;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface DurableNotificationRecord {
  id: string;
  user_id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action_route: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  expires_at: string | null;
  delivered_in_app_at: string | null;
  created_at: string;
}

export interface GroupRequestRecord {
  id: string;
  creator_id: string;
  submitted_by: string | null;
  proposed_group_name: string;
  description: string | null;
  contribution_amount: number;
  frequency: GroupRecord['Frequency'];
  min_members: number;
  max_members: number;
  visibility: 'Public' | 'Private';
  invite_mode: 'PublicRequest' | 'InviteCode' | 'DirectInvite' | 'InviteCodeAndDirect';
  status: GroupRequestStatus;
  risk_level: 'Low' | 'Medium' | 'High';
  terms_version: string;
  agreement_required: boolean;
  vesting_enabled: boolean;
  vesting_disabled_by_creator: boolean;
  risk_warning_accepted_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approval_decision_note: string | null;
  rejection_reason: string | null;
  approved_group_id: string | null;
  created_group_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupJoinRequestRecord {
  id: string;
  group_request_id: string;
  user_id: string;
  status: GroupJoinRequestStatus;
  requested_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  removed_at: string | null;
  decision_by: string | null;
  decision_reason: string | null;
}

export interface GroupInvitationRecord {
  id: string;
  group_request_id: string;
  invited_user_id: string | null;
  invited_phone_or_student_id: string | null;
  invite_code: string | null;
  status: GroupInvitationStatus;
  expires_at: string | null;
  created_by: string;
  accepted_at: string | null;
  declined_at: string | null;
  created_at: string;
}

export interface GroupFormationRequestSummary extends GroupRequestRecord {
  accepted_participant_count: number;
  remaining_slots: number;
}

export interface GroupFormationDetail {
  groupRequest: GroupRequestRecord;
  joinRequests: GroupJoinRequestRecord[];
  invitations: GroupInvitationRecord[];
  accepted_participant_count: number;
  remaining_slots: number;
}

export interface ContributionObligationRecord {
  id: string;
  round_id: string;
  group_id: string;
  user_id: string;
  amount_due: number;
  currency: string;
  due_at: string | null;
  grace_ends_at: string | null;
  status: ContributionObligationStatus;
  paid_transaction_id: string | null;
  paid_at: string | null;
  late_at: string | null;
  defaulted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentProviderAttemptRecord {
  id: string;
  provider_name: string;
  provider_mode: 'Mock' | 'Sandbox';
  event_type: 'ContributionPayment' | 'PayoutProcessing' | 'RefundTicket';
  attempt_sequence: number;
  user_id: string;
  group_id: string | null;
  round_id: string | null;
  contribution_obligation_id: string | null;
  payout_request_id: string | null;
  amount: number | null;
  currency: string;
  normalized_phone: string | null;
  gateway_reference: string | null;
  idempotency_key: string;
  request_payload: Record<string, unknown>;
  callback_payload: Record<string, unknown>;
  status: PaymentProviderAttemptStatus;
  verification_result: string | null;
  verified_at: string | null;
  verified_by_system: boolean;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  callback_received_at: string | null;
}

export interface LedgerEntryRecord {
  id: string;
  user_id: string | null;
  group_id: string | null;
  round_id: string | null;
  transaction_id: string | null;
  payout_request_id: string | null;
  entry_type: LedgerEntryType;
  direction: LedgerDirection;
  amount: number;
  currency: string;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PayoutRequestRecord {
  id: string;
  group_id: string;
  round_id: string;
  winner_user_id: string;
  total_payout_amount: number;
  immediate_release_amount: number;
  reserved_amount: number;
  currency: string;
  status: PayoutRequestStatus;
  destination_type: string | null;
  destination_reference: string | null;
  provider_attempt_id: string | null;
  requested_at: string;
  processed_at: string | null;
  failed_reason: string | null;
  created_at: string;
}

export interface PayoutReleaseScheduleRecord {
  id: string;
  payout_request_id: string;
  user_id: string;
  group_id: string;
  round_id: string;
  trigger_obligation_id: string | null;
  release_amount: number;
  currency: string;
  status: PayoutReleaseScheduleStatus;
  released_at: string | null;
  created_at: string;
}

export interface UserReliabilityProfileRecord {
  user_id: string;
  public_status: ReliabilityPublicStatus;
  completed_groups_count: number;
  perfect_completed_groups_count: number;
  late_payment_count: number;
  default_count: number;
  restriction_count: number;
  current_maturity_completed_count: number;
  updated_at: string;
}

export interface UserRestrictionRecord {
  id: string;
  user_id: string;
  restriction_type: string;
  reason: string;
  status: UserRestrictionStatus;
  created_by: string | null;
  created_at: string;
  cleared_by: string | null;
  cleared_at: string | null;
  required_recovery_groups: number;
  completed_recovery_groups: number;
}

export interface GroupFreezeEventRecord {
  id: string;
  group_id: string;
  trigger_user_id: string | null;
  trigger_round_id: string | null;
  trigger_obligation_id: string | null;
  reason: string;
  status: GroupFreezeEventStatus;
  frozen_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_action: GroupFreezeResolutionAction | null;
  resolution_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GroupResolutionPollRecord {
  id: string;
  group_id: string;
  freeze_event_id: string;
  created_by_admin_id: string;
  status: GroupResolutionPollStatus;
  opens_at: string;
  closes_at: string;
  required_threshold_type: 'SimpleMajority';
  eligible_voter_user_ids: string[];
  winning_option_id: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GroupResolutionPollOptionRecord {
  id: string;
  poll_id: string;
  option_label: string;
  option_description: string | null;
  resolution_action: GroupResolutionPollAction;
  display_order: number;
  created_at: string;
}

export interface GroupResolutionVoteRecord {
  id: string;
  poll_id: string;
  voter_user_id: string;
  option_id: string;
  voted_at: string;
}

export interface GroupResolutionPollSummary {
  poll: GroupResolutionPollRecord;
  options: GroupResolutionPollOptionRecord[];
  voteCounts: Record<string, number>;
  requiredVotes: number;
  eligibleVoterCount: number;
  currentUserVote: GroupResolutionVoteRecord | null;
}

export interface RefundTicketRecord {
  id: string;
  group_id: string;
  round_id: string | null;
  user_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundTicketStatus;
  calculation_snapshot: Record<string, unknown>;
  offset_applied_amount: number;
  created_by_event_id: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface SeedScenarioManifest {
  name: string;
  description: string;
  dependencies: string[];
  deterministic: boolean;
  destructive: boolean;
}

export interface SeedRunSummary {
  scenario: string;
  target: 'local' | 'linked' | 'staging';
  startedAt: string;
  completedAt: string;
  created: Record<string, number>;
  wipedTables: string[];
  warnings: string[];
}

export interface AvatarDescriptor {
  seed: string;
  style: 'Initials' | 'Geometric' | 'Orbital';
  palette: string;
}

export interface UserProfile {
  userId: string;
  university: string | null;
  academicYear: string | null;
  language: string;
  theme: 'Light' | 'Dark' | 'System';
  notificationPreference: 'PushAndSms' | 'PushOnly' | 'SmsOnly' | 'None';
  walletLabel: string | null;
  avatar: AvatarDescriptor;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSlot {
  userId: string;
  displayName: string;
  role: UserRole;
  phoneNumber: string;
  avatarSeed: string;
  lastActiveAt: string;
  tokenState: 'Available' | 'Expired' | 'Missing';
}

export type GroupAnnouncementPriority = 'Normal' | 'High' | 'Critical';
export type GroupAnnouncementScope = 'ApprovedGroup' | 'FormingGroup';

export interface GroupAnnouncement {
  id: string;
  groupId: string | null;
  groupRequestId: string | null;
  createdBy: string;
  title: string;
  body: string;
  priority: GroupAnnouncementPriority;
  pinned: boolean;
  scope: GroupAnnouncementScope;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationDevice {
  id: string;
  transport: string;
  model?: string | null;
  product?: string | null;
  authorized: boolean;
  appInstalled: boolean;
  appRunning: boolean;
}

export interface SimulationCommand {
  id: string;
  type:
    | 'Navigate'
    | 'SelectActiveGroup'
    | 'SelectPersona'
    | 'Refresh'
    | 'ShowBanner'
    | 'PaymentReturn'
    | 'SpeedTime'
    | 'BackendLifecycle';
  payload: Record<string, unknown>;
  issuedAt: string;
}

export interface SimulationSnapshot {
  generatedAt: string;
  groups: GroupRecord[];
  rounds: RoundRecord[];
  memberships: MembershipRecord[];
  transactions: TransactionRecord[];
  events: Array<{
    id: string;
    commandType: string;
    actorUserId: string | null;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
}

export interface SimulationCommandResult {
  ok: boolean;
  commandId: string;
  message: string;
  snapshot?: SimulationSnapshot;
}
