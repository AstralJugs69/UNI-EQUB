import type {
  AdminOverview,
  AppNotification,
  AccountSlot,
  AuthSession,
  DashboardSnapshot,
  ExportedReport,
  GroupAnnouncement,
  GroupApprovalItem,
  GroupFormationDetail,
  GroupFormationRequestSummary,
  GroupInvitationRecord,
  GroupRecord,
  GroupStatusSnapshot,
  GroupFreezeResolutionAction,
  KycReviewItem,
  KycDocumentKind,
  PaymentMethod,
  PaymentResult,
  ReminderBatchResult,
  ReportSummary,
  SessionUser,
  SimulationCommand,
  SimulationCommandResult,
  SimulationSnapshot,
  UserProfile,
  UssdSessionState,
  WalletSnapshot,
} from '../../types/domain';

export interface RegisterInput {
  fullName: string;
  phoneNumber: string;
  password: string;
  studentIdImage: string;
}

export interface LoginInput {
  phoneNumber: string;
  password: string;
}

export interface KycDocumentUpload {
  kind: KycDocumentKind;
  fileName: string;
  contentType: string;
  base64: string;
}

export interface KycSubmissionInput {
  documents: KycDocumentUpload[];
}

export interface CreateGroupInput {
  groupName: string;
  amount: number;
  frequency: GroupRecord['Frequency'];
  maxMembers: number;
  description: string;
}

export interface CreateGroupFormationInput {
  groupName: string;
  description?: string;
  amount: number;
  frequency: GroupRecord['Frequency'];
  minMembers?: number;
  maxMembers: number;
  visibility: 'Public' | 'Private';
  inviteMode?: 'PublicRequest' | 'InviteCode' | 'DirectInvite' | 'InviteCodeAndDirect';
  vestingEnabled?: boolean;
  riskWarningAccepted?: boolean;
  termsVersion?: string;
}

export interface FormationTermsAcceptance {
  groupTermsAccepted: boolean;
  acceptedTermsVersion: string;
}

export interface FormationInvitationInput {
  requestId: string;
  targetUserId?: string;
  invitedPhoneOrStudentId?: string;
  inviteCode?: string;
}

export interface LoginChallenge {
  challengeToken: string;
  phoneNumber: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<SessionUser>;
  requestOtp(phoneNumber: string): Promise<{ challengeId: string }>;
  verifyOtp(phoneNumber: string, otp: string): Promise<{ pendingKycToken?: string }>;
  beginLogin(input: LoginInput, roleHint?: 'Member' | 'Admin'): Promise<LoginChallenge>;
  completeLogin(challengeToken: string, otp: string): Promise<AuthSession>;
  login(input: LoginInput, roleHint?: 'Member' | 'Admin'): Promise<AuthSession>;
  restore(token: string): Promise<AuthSession | null>;
  logout(): Promise<void>;
}

export interface KycService {
  submitKyc(userId: string, input: KycSubmissionInput, pendingKycToken: string): Promise<AuthSession>;
  resubmitKyc(userId: string, input: KycSubmissionInput): Promise<AuthSession>;
  listPendingReviews(): Promise<KycReviewItem[]>;
  approve(userId: string): Promise<void>;
  requestResubmission(userId: string): Promise<void>;
  ban(userId: string): Promise<void>;
}

export interface GroupService {
  listBrowseable(userId: string): Promise<GroupRecord[]>;
  getGroup(groupId: string): Promise<GroupRecord | null>;
  getGroupStatus(userId: string, groupId: string): Promise<GroupStatusSnapshot>;
  createRequest(userId: string, input: CreateGroupInput): Promise<GroupRecord>;
  listPendingApprovals(): Promise<GroupApprovalItem[]>;
  approve(groupId: string): Promise<void>;
  reject(groupId: string): Promise<void>;
  freeze(groupId: string): Promise<void>;
  resolveFreeze(groupId: string, resolutionAction?: GroupFreezeResolutionAction, resolutionNote?: string): Promise<void>;
  createResolutionPoll(groupId: string): Promise<GroupStatusSnapshot['activeResolutionPoll']>;
  voteResolutionPoll(groupId: string, pollId: string, optionId: string): Promise<void>;
  closeResolutionPoll(groupId: string, pollId: string): Promise<void>;
  joinGroup(userId: string, groupId: string): Promise<void>;
  getDashboard(userId: string): Promise<DashboardSnapshot>;
}

export interface GroupFormationService {
  listPublic(userId: string): Promise<GroupFormationRequestSummary[]>;
  listMine(userId: string): Promise<GroupFormationRequestSummary[]>;
  listPendingApproval(): Promise<GroupFormationRequestSummary[]>;
  getRequest(userId: string, requestId: string): Promise<GroupFormationDetail>;
  lookupInviteCode(userId: string, inviteCode: string): Promise<GroupFormationDetail>;
  createRequest(userId: string, input: CreateGroupFormationInput): Promise<GroupFormationDetail>;
  requestJoin(userId: string, requestId: string, terms: FormationTermsAcceptance): Promise<GroupFormationDetail>;
  acceptJoin(userId: string, joinRequestId: string, decisionReason?: string): Promise<GroupFormationDetail>;
  removeParticipant(userId: string, joinRequestId: string, decisionReason?: string): Promise<GroupFormationDetail>;
  invite(userId: string, input: FormationInvitationInput): Promise<{ detail: GroupFormationDetail; invitation: GroupInvitationRecord }>;
  acceptInvite(userId: string, input: FormationTermsAcceptance & { invitationId?: string; inviteCode?: string }): Promise<GroupFormationDetail>;
  submitForApproval(userId: string, requestId: string): Promise<GroupFormationDetail>;
  adminApprove(requestId: string, decisionReason?: string): Promise<GroupRecord>;
  adminReject(requestId: string, decisionReason?: string): Promise<GroupFormationDetail>;
}

export interface PaymentService {
  payContribution(userId: string, groupId: string, method: PaymentMethod): Promise<PaymentResult>;
  startContributionUssd(userId: string, groupId: string): Promise<UssdSessionState>;
  submitContributionUssd(userId: string, sessionId: string, input: string): Promise<UssdSessionState>;
  listTransactions(userId: string): Promise<DashboardSnapshot['recentTransactions']>;
  getWallet(userId: string): Promise<WalletSnapshot>;
  withdrawPayout(userId: string): Promise<void>;
}

export interface NotificationService {
  listForUser(userId: string): Promise<AppNotification[]>;
  markAllRead(userId: string): Promise<void>;
  sendReminderBatch(): Promise<ReminderBatchResult>;
}

export interface ReportService {
  getAdminOverview(): Promise<AdminOverview>;
  listReports(): Promise<ReportSummary[]>;
  exportReport(title: string, format: 'PDF' | 'CSV'): Promise<ExportedReport>;
}

export interface ProfileUpdateInput {
  university?: string | null;
  academicYear?: string | null;
  language?: string;
  theme?: UserProfile['theme'];
  notificationPreference?: UserProfile['notificationPreference'];
  walletLabel?: string | null;
  avatarSeed?: string;
}

export interface ProfileService {
  getProfile(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, input: ProfileUpdateInput): Promise<UserProfile>;
  ensureAvatarSeed(userId: string): Promise<UserProfile['avatar']>;
}

export interface AccountService {
  listSlots(): Promise<AccountSlot[]>;
  saveCurrent(session: AuthSession): Promise<AccountSlot>;
  switchTo(userId: string): Promise<{ token: string | null; slot: AccountSlot | null }>;
  removeSlot(userId: string): Promise<void>;
}

export interface AnnouncementInput {
  groupId?: string | null;
  groupRequestId?: string | null;
  title: string;
  body: string;
  priority?: GroupAnnouncement['priority'];
  pinned?: boolean;
}

export interface AnnouncementService {
  listForGroup(input: { groupId?: string | null; groupRequestId?: string | null }): Promise<GroupAnnouncement[]>;
  create(input: AnnouncementInput): Promise<GroupAnnouncement>;
  update(id: string, input: Partial<AnnouncementInput>): Promise<GroupAnnouncement>;
  archive(id: string): Promise<void>;
}

export interface SimulationService {
  getSnapshot(): Promise<SimulationSnapshot>;
  runCommand(command: SimulationCommand): Promise<SimulationCommandResult>;
}

export interface AppServices {
  auth: AuthService;
  kyc: KycService;
  groups: GroupService;
  formation: GroupFormationService;
  payments: PaymentService;
  notifications: NotificationService;
  reports: ReportService;
  profile: ProfileService;
  accounts: AccountService;
  announcements: AnnouncementService;
  simulation: SimulationService;
}
