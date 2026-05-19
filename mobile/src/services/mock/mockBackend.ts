import { seedGroups, seedMemberships, seedNotifications, seedRounds, seedTransactions, seedUsers } from '../../data/seed';
import type {
  AdminOverview,
  AppNotification,
  AuthSession,
  DashboardSnapshot,
  ExportedReport,
  GroupApprovalItem,
  GroupFormationDetail,
  GroupFormationRequestSummary,
  GroupInvitationRecord,
  GroupJoinRequestRecord,
  GroupRecord,
  GroupResolutionPollOptionRecord,
  GroupResolutionPollRecord,
  GroupResolutionVoteRecord,
  GroupRequestRecord,
  GroupStatusSnapshot,
  KycReviewItem,
  MembershipRecord,
  PaymentMethod,
  PaymentResult,
  RefundTicketRecord,
  ReminderBatchResult,
  ReliabilityPublicStatus,
  ReportSummary,
  RoundRecord,
  SessionUser,
  TransactionRecord,
  UssdSessionState,
  UserReliabilityProfileRecord,
  UserRecord,
  WalletSnapshot,
} from '../../types/domain';
import type { AppServices, CreateGroupFormationInput, CreateGroupInput, FormationInvitationInput, FormationTermsAcceptance, KycSubmissionInput, LoginInput, RegisterInput } from '../contracts';

interface SessionRecord {
  userId: string;
  expiresAt: string;
}

interface OtpChallenge {
  phoneNumber: string;
  otp: string;
  expiresAt: string;
}

interface ProviderLog {
  provider: PaymentMethod | 'ReminderEngine';
  status: 'Queued' | 'Successful' | 'Failed';
  message: string;
  createdAt: string;
}

interface UssdSessionRecord {
  sessionId: string;
  userId: string;
  groupId: string;
  stage: UssdSessionState['stage'];
  expiresAt: string;
  merchantRef?: string;
  amount?: number;
  error?: string;
  paymentResult?: PaymentResult;
}

interface DatabaseState {
  users: UserRecord[];
  groups: GroupRecord[];
  memberships: typeof seedMemberships;
  rounds: RoundRecord[];
  transactions: TransactionRecord[];
  notifications: Record<string, AppNotification[]>;
  sessions: Record<string, SessionRecord>;
  otpChallenges: Record<string, OtpChallenge>;
  ussdSessions: Record<string, UssdSessionRecord>;
  auditLogs: string[];
  reminderQueue: string[];
  providerLogs: ProviderLog[];
  rejectedGroupIds: string[];
  groupRequests: GroupRequestRecord[];
  groupJoinRequests: GroupJoinRequestRecord[];
  groupInvitations: GroupInvitationRecord[];
  resolutionPolls: GroupResolutionPollRecord[];
  resolutionPollOptions: GroupResolutionPollOptionRecord[];
  resolutionVotes: GroupResolutionVoteRecord[];
  refundTickets: RefundTicketRecord[];
  reliabilityProfiles: UserReliabilityProfileRecord[];
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const hashPassword = (password: string) => `hash:${password}`;
const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();
const plusMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export class MockBackend implements AppServices {
  private db: DatabaseState;

  constructor() {
    this.db = this.createInitialState();
  }

  reset() {
    this.db = this.createInitialState();
  }

  private createInitialState(): DatabaseState {
    return {
      users: [...clone(seedUsers), ...this.createDemoAdminUsers()],
      groups: [...clone(seedGroups), ...this.createDemoAdminGroups()],
      memberships: clone(seedMemberships),
      rounds: clone(seedRounds),
      transactions: clone(seedTransactions),
      notifications: clone(seedNotifications),
      sessions: {},
      otpChallenges: {},
      ussdSessions: {},
      auditLogs: [
        'Phase 2 formation submitted: Campus Demo Formation • 09:42 AM',
        'Public daily formation queued for admin review • 09:36 AM',
        'KYC approved for Dawit Abebe • 09:15 AM',
        'Cycle frozen for suspicious mismatch • 08:47 AM',
      ],
      reminderQueue: [
        'Dorm A Savings Group • 1 unpaid member • automatic reminder queued',
        'AAU Coders Circle • 2 unpaid members • automatic reminder queued',
        'Exam Week Buffer • 4 unpaid members • due today',
      ],
      providerLogs: [
        { provider: 'MockUSSD', status: 'Successful', message: 'USSD contribution reconciled for Dorm A Savings Group', createdAt: nowIso() },
        { provider: 'Telebirr', status: 'Queued', message: 'Mock provider callback waiting for confirmation', createdAt: nowIso() },
        { provider: 'ReminderEngine', status: 'Successful', message: 'Reminder batch generated for demo queues', createdAt: nowIso() },
      ],
      rejectedGroupIds: [],
      groupRequests: this.createDemoGroupRequests(),
      groupJoinRequests: this.createDemoJoinRequests(),
      groupInvitations: this.createDemoGroupInvitations(),
      resolutionPolls: [],
      resolutionPollOptions: [],
      resolutionVotes: [],
      refundTickets: [],
      reliabilityProfiles: this.createReliabilityProfiles(),
    };
  }

  private createReliabilityProfiles(): UserReliabilityProfileRecord[] {
    return [
      { user_id: 'user-dawit', public_status: 'BuildingTrust', completed_groups_count: 1, perfect_completed_groups_count: 1, late_payment_count: 0, default_count: 0, restriction_count: 0, current_maturity_completed_count: 1, updated_at: nowIso() },
      { user_id: 'user-miki', public_status: 'Trusted', completed_groups_count: 3, perfect_completed_groups_count: 3, late_payment_count: 0, default_count: 0, restriction_count: 0, current_maturity_completed_count: 3, updated_at: nowIso() },
      { user_id: 'user-ruth', public_status: 'New', completed_groups_count: 0, perfect_completed_groups_count: 0, late_payment_count: 0, default_count: 0, restriction_count: 0, current_maturity_completed_count: 0, updated_at: nowIso() },
      { user_id: 'user-saba', public_status: 'BuildingTrust', completed_groups_count: 1, perfect_completed_groups_count: 1, late_payment_count: 1, default_count: 0, restriction_count: 0, current_maturity_completed_count: 1, updated_at: nowIso() },
      { user_id: 'user-banned', public_status: 'Banned', completed_groups_count: 0, perfect_completed_groups_count: 0, late_payment_count: 0, default_count: 1, restriction_count: 1, current_maturity_completed_count: 0, updated_at: nowIso() },
    ];
  }

  private createDemoAdminUsers(): UserRecord[] {
    return [
      {
        User_ID: 'user-noah',
        Full_Name: 'Noah Girma',
        Phone_Number: '0911000007',
        Password_Hash: 'hash:noah1234',
        Student_ID_Img: 'storage://students/noah-id.png',
        KYC_Status: 'Verified',
        Role: 'Member',
        Created_At: nowIso(),
      },
      {
        User_ID: 'user-hana',
        Full_Name: 'Hana Bekele',
        Phone_Number: '0911000005',
        Password_Hash: 'hash:hana1234',
        Student_ID_Img: 'storage://students/hana-id.png',
        KYC_Status: 'Unverified',
        Role: 'Member',
        Created_At: nowIso(),
      },
      {
        User_ID: 'user-yared',
        Full_Name: 'Yared Mekonnen',
        Phone_Number: '0911000006',
        Password_Hash: 'hash:yared1234',
        Student_ID_Img: 'storage://students/yared-id.png',
        KYC_Status: 'Unverified',
        Role: 'Member',
        Created_At: nowIso(),
      },
      {
        User_ID: 'user-banned',
        Full_Name: 'Banned Member',
        Phone_Number: '0911000008',
        Password_Hash: 'hash:banned1234',
        Student_ID_Img: 'storage://students/banned-id.png',
        KYC_Status: 'Banned',
        Role: 'Member',
        Created_At: nowIso(),
      },
    ];
  }

  private createDemoAdminGroups(): GroupRecord[] {
    return [
      {
        Group_ID: 'group-demo-transport',
        Creator_ID: 'user-saba',
        Group_Name: 'Transport Mini Equb',
        Amount: 150,
        Max_Members: 6,
        Frequency: 'Daily',
        Virtual_Acc_Ref: '',
        Status: 'Pending',
        Start_Date: '2026-05-18',
        Description: 'Small daily transport contribution request queued for admin review.',
      },
      {
        Group_ID: 'group-demo-frozen',
        Creator_ID: 'user-admin',
        Group_Name: 'Frozen Recovery Demo',
        Amount: 200,
        Max_Members: 5,
        Frequency: 'Weekly',
        Virtual_Acc_Ref: 'UEQ-FROZEN',
        Status: 'Frozen',
        Start_Date: '2026-05-15',
        Description: 'Frozen group ready for member-poll recovery demo.',
      },
    ];
  }


  private createDemoGroupRequests(): GroupRequestRecord[] {
    return [
      {
        id: 'formation-demo-review',
        creator_id: 'user-dawit',
        submitted_by: 'user-dawit',
        proposed_group_name: 'Campus Demo Formation',
        description: 'Prepared Phase 2 request for admin approval during the phone demo.',
        contribution_amount: 700,
        frequency: 'Weekly',
        min_members: 5,
        max_members: 6,
        visibility: 'Public',
        invite_mode: 'PublicRequest',
        status: 'PendingApproval',
        risk_level: 'Low',
        terms_version: 'phase2-v1',
        agreement_required: true,
        vesting_enabled: true,
        vesting_disabled_by_creator: false,
        risk_warning_accepted_at: null,
        expires_at: plusMinutes(60 * 24 * 3),
        submitted_at: nowIso(),
        reviewed_by: null,
        reviewed_at: null,
        approval_decision_note: null,
        rejection_reason: null,
        approved_group_id: null,
        created_group_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      {
        id: 'formation-demo-public-review-2',
        creator_id: 'user-saba',
        submitted_by: 'user-saba',
        proposed_group_name: 'Campus Lab Supplies',
        description: 'Public daily request queued for admin approval.',
        contribution_amount: 250,
        frequency: 'Daily',
        min_members: 5,
        max_members: 5,
        visibility: 'Public',
        invite_mode: 'PublicRequest',
        status: 'PendingApproval',
        risk_level: 'Low',
        terms_version: 'phase2-v1',
        agreement_required: true,
        vesting_enabled: true,
        vesting_disabled_by_creator: false,
        risk_warning_accepted_at: null,
        expires_at: plusMinutes(60 * 24 * 3),
        submitted_at: nowIso(),
        reviewed_by: null,
        reviewed_at: null,
        approval_decision_note: null,
        rejection_reason: null,
        approved_group_id: null,
        created_group_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      {
        id: 'formation-demo-public',
        creator_id: 'user-ruth',
        submitted_by: null,
        proposed_group_name: 'Laptop Repair Rotation',
        description: 'Public forming request for members to inspect and request to join.',
        contribution_amount: 450,
        frequency: 'Monthly',
        min_members: 5,
        max_members: 7,
        visibility: 'Public',
        invite_mode: 'PublicRequest',
        status: 'Forming',
        risk_level: 'Low',
        terms_version: 'phase2-v1',
        agreement_required: true,
        vesting_enabled: true,
        vesting_disabled_by_creator: false,
        risk_warning_accepted_at: null,
        expires_at: plusMinutes(60 * 24 * 5),
        submitted_at: null,
        reviewed_by: null,
        reviewed_at: null,
        approval_decision_note: null,
        rejection_reason: null,
        approved_group_id: null,
        created_group_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      {
        id: 'formation-demo-private',
        creator_id: 'user-dawit',
        submitted_by: null,
        proposed_group_name: 'Dorm Coffee Circle',
        description: 'Private daily draw request with a shareable invite code.',
        contribution_amount: 350,
        frequency: 'Daily',
        min_members: 5,
        max_members: 5,
        visibility: 'Private',
        invite_mode: 'InviteCodeAndDirect',
        status: 'Forming',
        risk_level: 'Medium',
        terms_version: 'phase2-v1',
        agreement_required: true,
        vesting_enabled: false,
        vesting_disabled_by_creator: true,
        risk_warning_accepted_at: nowIso(),
        expires_at: plusMinutes(60 * 24 * 4),
        submitted_at: null,
        reviewed_by: null,
        reviewed_at: null,
        approval_decision_note: null,
        rejection_reason: null,
        approved_group_id: null,
        created_group_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ];
  }

  private createDemoJoinRequests(): GroupJoinRequestRecord[] {
    return [
      {
        id: 'formation-demo-review-creator',
        group_request_id: 'formation-demo-review',
        user_id: 'user-dawit',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Creator automatically added to the forming group.',
      },
      {
        id: 'formation-demo-review-miki',
        group_request_id: 'formation-demo-review',
        user_id: 'user-miki',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Accepted participant for demo approval readiness.',
      },
      {
        id: 'formation-demo-review-ruth',
        group_request_id: 'formation-demo-review',
        user_id: 'user-ruth',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Accepted participant for demo approval readiness.',
      },
      {
        id: 'formation-demo-review-saba',
        group_request_id: 'formation-demo-review',
        user_id: 'user-saba',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Accepted participant for demo approval readiness.',
      },
      {
        id: 'formation-demo-review-noah',
        group_request_id: 'formation-demo-review',
        user_id: 'user-noah',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Accepted participant for demo approval readiness.',
      },
      {
        id: 'formation-demo-public-creator',
        group_request_id: 'formation-demo-public',
        user_id: 'user-ruth',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-ruth',
        decision_reason: 'Creator automatically added to the forming group.',
      },
      {
        id: 'formation-demo-public-review-2-creator',
        group_request_id: 'formation-demo-public-review-2',
        user_id: 'user-saba',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-saba',
        decision_reason: 'Creator automatically added to the forming group.',
      },
      {
        id: 'formation-demo-public-review-2-dawit',
        group_request_id: 'formation-demo-public-review-2',
        user_id: 'user-dawit',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-saba',
        decision_reason: 'Accepted participant for admin review demo.',
      },
      {
        id: 'formation-demo-public-review-2-miki',
        group_request_id: 'formation-demo-public-review-2',
        user_id: 'user-miki',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-saba',
        decision_reason: 'Accepted participant for admin review demo.',
      },
      {
        id: 'formation-demo-public-review-2-ruth',
        group_request_id: 'formation-demo-public-review-2',
        user_id: 'user-ruth',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-saba',
        decision_reason: 'Accepted participant for admin review demo.',
      },
      {
        id: 'formation-demo-public-review-2-noah',
        group_request_id: 'formation-demo-public-review-2',
        user_id: 'user-noah',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-saba',
        decision_reason: 'Accepted participant for admin review demo.',
      },
      {
        id: 'formation-demo-private-creator',
        group_request_id: 'formation-demo-private',
        user_id: 'user-dawit',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Creator automatically added to the forming group.',
      },
      {
        id: 'formation-demo-private-miki',
        group_request_id: 'formation-demo-private',
        user_id: 'user-miki',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Accepted invite code for private demo readiness.',
      },
      {
        id: 'formation-demo-private-hana',
        group_request_id: 'formation-demo-private',
        user_id: 'user-hana',
        status: 'Requested',
        requested_at: nowIso(),
        accepted_at: null,
        rejected_at: null,
        removed_at: null,
        decision_by: null,
        decision_reason: 'Accepted group terms phase2-v1',
      },
      {
        id: 'formation-demo-private-ruth',
        group_request_id: 'formation-demo-private',
        user_id: 'user-ruth',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Accepted invite code for private demo readiness.',
      },
      {
        id: 'formation-demo-private-saba',
        group_request_id: 'formation-demo-private',
        user_id: 'user-saba',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Accepted invite code for private demo readiness.',
      },
      {
        id: 'formation-demo-private-noah',
        group_request_id: 'formation-demo-private',
        user_id: 'user-noah',
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: 'user-dawit',
        decision_reason: 'Accepted invite code for private demo readiness.',
      },
    ];
  }

  private createDemoGroupInvitations(): GroupInvitationRecord[] {
    return [
      {
        id: 'formation-demo-public-invite',
        group_request_id: 'formation-demo-public',
        invited_user_id: null,
        invited_phone_or_student_id: null,
        invite_code: 'FORM-2026',
        status: 'Pending',
        expires_at: plusMinutes(60 * 24 * 5),
        created_by: 'user-ruth',
        accepted_at: null,
        declined_at: null,
        created_at: nowIso(),
      },
      {
        id: 'formation-demo-private-invite',
        group_request_id: 'formation-demo-private',
        invited_user_id: null,
        invited_phone_or_student_id: '0911999999',
        invite_code: 'UNI-DEMO',
        status: 'Pending',
        expires_at: plusMinutes(60 * 24 * 4),
        created_by: 'user-dawit',
        accepted_at: null,
        declined_at: null,
        created_at: nowIso(),
      },
    ];
  }

  auth = {
    register: async (input: RegisterInput): Promise<SessionUser> => {
      const normalized = this.normalizePhone(input.phoneNumber);
      if (this.db.users.some(user => user.Phone_Number === normalized)) {
        throw new Error('Phone number is already registered.');
      }

      const user: UserRecord = {
        User_ID: makeId('user'),
        Full_Name: input.fullName,
        Phone_Number: normalized,
        Password_Hash: hashPassword(input.password),
        Student_ID_Img: input.studentIdImage,
        KYC_Status: 'Unverified',
        Role: 'Member',
        Created_At: nowIso(),
      };

      this.db.users.unshift(user);
      this.pushNotification(user.User_ID, 'Account created', 'Finish OTP and KYC review to unlock the full platform.');
      return this.toSessionUser(user);
    },

    requestOtp: async (phoneNumber: string): Promise<{ challengeId: string }> => {
      const normalized = this.normalizePhone(phoneNumber);
      const challengeId = makeId('otp');
      this.db.otpChallenges[challengeId] = {
        phoneNumber: normalized,
        otp: '4719',
        expiresAt: plusMinutes(5),
      };
      this.db.providerLogs.unshift({
        provider: 'ReminderEngine',
        status: 'Queued',
        message: `OTP queued for ${normalized}`,
        createdAt: nowIso(),
      });
      return { challengeId };
    },

    verifyOtp: async (phoneNumber: string, otp: string): Promise<{ pendingKycToken?: string }> => {
      const normalized = this.normalizePhone(phoneNumber);
      const challengeEntry = Object.entries(this.db.otpChallenges).find(([, item]) => item.phoneNumber === normalized);
      if (!challengeEntry) {
        throw new Error('No OTP challenge is active for this number.');
      }
      const [challengeId, challenge] = challengeEntry;
      if (challenge.expiresAt < nowIso()) {
        throw new Error('OTP challenge expired.');
      }
      if (challenge.otp !== otp.trim()) {
        throw new Error('Invalid OTP code.');
      }
      delete this.db.otpChallenges[challengeId];
      return { pendingKycToken: `mock-pending-kyc-${normalized}` };
    },

    beginLogin: async (input: LoginInput, roleHint?: 'Member' | 'Admin') => {
      const normalized = this.normalizePhone(input.phoneNumber);
      const user = this.db.users.find(item => item.Phone_Number === normalized);
      if (!user || user.Password_Hash !== hashPassword(input.password)) {
        throw new Error('Invalid phone number or password.');
      }
      if (roleHint && user.Role !== roleHint) {
        throw new Error(`${roleHint} access is not available for this account.`);
      }
      if (user.KYC_Status === 'Banned') {
        throw new Error('This account has been banned and cannot log in.');
      }
      const token = `session-${user.User_ID}-${Date.now()}`;
      this.db.sessions[token] = { userId: user.User_ID, expiresAt: plusMinutes(60 * 24 * 7) };
      return { challengeToken: token, phoneNumber: user.Phone_Number };
    },

    completeLogin: async (challengeToken: string, _otp: string): Promise<AuthSession> => {
      const challenge = this.db.sessions[challengeToken];
      if (!challenge || challenge.expiresAt < nowIso()) {
        throw new Error('Login challenge expired. Start login again.');
      }
      const user = this.requireUser(challenge.userId);
      return { token: challengeToken, user: this.toSessionUser(user) };
    },

    login: async (input: LoginInput, roleHint?: 'Member' | 'Admin'): Promise<AuthSession> => {
      const normalized = this.normalizePhone(input.phoneNumber);
      const user = this.db.users.find(item => item.Phone_Number === normalized);

      if (!user || user.Password_Hash !== hashPassword(input.password)) {
        throw new Error('Invalid phone number or password.');
      }
      if (roleHint && user.Role !== roleHint) {
        throw new Error(`${roleHint} access is not available for this account.`);
      }
      if (user.KYC_Status === 'Banned') {
        throw new Error('This account has been banned and cannot log in.');
      }

      const token = `session-${user.User_ID}-${Date.now()}`;
      this.db.sessions[token] = { userId: user.User_ID, expiresAt: plusMinutes(60 * 24 * 7) };
      return { token, user: this.toSessionUser(user) };
    },

    restore: async (token: string): Promise<AuthSession | null> => {
      const session = this.db.sessions[token];
      if (!session) {
        return null;
      }
      if (session.expiresAt < nowIso()) {
        delete this.db.sessions[token];
        return null;
      }
      const user = this.requireUser(session.userId);
      if (user.KYC_Status === 'Banned') {
        delete this.db.sessions[token];
        return null;
      }
      return { token, user: this.toSessionUser(user) };
    },

    logout: async (): Promise<void> => undefined,
  };

  syncExternalUser(user: SessionUser, passwordHash?: string) {
    const existing = this.db.users.find(item => item.User_ID === user.userId || item.Phone_Number === user.phoneNumber);
    if (existing) {
      existing.Full_Name = user.fullName;
      existing.Phone_Number = user.phoneNumber;
      existing.Role = user.role;
      existing.KYC_Status = user.kycStatus;
      if (passwordHash) {
        existing.Password_Hash = passwordHash;
      }
      return;
    }

    this.db.users.unshift({
      User_ID: user.userId,
      Full_Name: user.fullName,
      Phone_Number: user.phoneNumber,
      Password_Hash: passwordHash ?? hashPassword('placeholder'),
      Student_ID_Img: 'storage://students/pending-upload.png',
      KYC_Status: user.kycStatus,
      Role: user.role,
      Created_At: nowIso(),
    });
  }

  setUserKycStatus(userId: string, status: UserRecord['KYC_Status'], imageRef?: string) {
    const user = this.db.users.find(item => item.User_ID === userId);
    if (!user) {
      return;
    }
    user.KYC_Status = status;
    if (imageRef) {
      user.Student_ID_Img = imageRef;
    }
  }

  syncExternalGroup(group: GroupRecord) {
    const existing = this.db.groups.find(item => item.Group_ID === group.Group_ID);
    if (existing) {
      Object.assign(existing, group);
      return;
    }
    this.db.groups.unshift(clone(group));
  }

  syncExternalGroups(groups: GroupRecord[]) {
    groups.forEach(group => this.syncExternalGroup(group));
  }

  syncExternalMembership(membership: MembershipRecord) {
    const existing = this.db.memberships.find(item => item.Membership_ID === membership.Membership_ID || (item.Group_ID === membership.Group_ID && item.User_ID === membership.User_ID));
    if (existing) {
      Object.assign(existing, membership);
      return;
    }
    this.db.memberships.push(clone(membership));
  }

  syncExternalRound(round: RoundRecord) {
    const existing = this.db.rounds.find(item => item.Round_ID === round.Round_ID || (item.Group_ID === round.Group_ID && item.Round_Number === round.Round_Number));
    if (existing) {
      Object.assign(existing, round);
      return;
    }
    this.db.rounds.push(clone(round));
  }

  applyExternalContributionTransaction(transaction: TransactionRecord): PaymentResult {
    const existing = this.db.transactions.find(item => item.Trans_ID === transaction.Trans_ID);
    if (existing) {
      Object.assign(existing, transaction);
    } else {
      this.db.transactions.unshift(clone(transaction));
    }

    const round = this.db.rounds.find(item => item.Round_ID === transaction.Round_ID);
    if (!round) {
      throw new Error('Round for external contribution was not found in mock state.');
    }
    const group = this.requireGroup(round.Group_ID);
    const payoutAmount = transaction.Type === 'Contribution' && transaction.Status === 'Successful' && round.Status === 'Open'
      ? this.tryCompleteRound(group, round, transaction.User_ID)
      : 0;

    return {
      receiptRef: transaction.Gateway_Ref,
      amount: transaction.Amount,
      method: transaction.Payment_Method,
      autoDrawTriggered: payoutAmount > 0,
      payoutAmount,
    };
  }

  kyc = {
    submitKyc: async (userId: string, input: KycSubmissionInput, _pendingKycToken: string): Promise<AuthSession> => {
      const user = this.requireUser(userId);
      user.Student_ID_Img = `storage://student-ids/${userId}/manifest-${input.documents.length}.json`;
      user.KYC_Status = 'Unverified';
      this.pushNotification(userId, 'KYC submitted', 'Your student ID is waiting for admin review.');
      this.db.auditLogs.unshift(`KYC submitted for ${user.Full_Name}`);
      const token = `session-${user.User_ID}-${Date.now()}`;
      this.db.sessions[token] = { userId: user.User_ID, expiresAt: plusMinutes(60 * 24 * 7) };
      return { token, user: this.toSessionUser(user) };
    },

    listPendingReviews: async (): Promise<KycReviewItem[]> => {
      return this.db.users
        .filter(user => user.Role === 'Member' && user.KYC_Status === 'Unverified')
        .map(user => ({ user: clone(user), note: 'Front ID uploaded and pending manual review.' }));
    },

    approve: async (userId: string): Promise<void> => {
      const user = this.requireUser(userId);
      user.KYC_Status = 'Verified';
      this.db.auditLogs.unshift(`KYC approved for ${user.Full_Name} • ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
      this.pushNotification(userId, 'KYC approved', 'Your account is now verified for group creation and payout withdrawal.');
    },

    requestResubmission: async (userId: string): Promise<void> => {
      const user = this.requireUser(userId);
      user.KYC_Status = 'Unverified';
      this.db.auditLogs.unshift(`KYC resubmission requested for ${user.Full_Name} • ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
      this.pushNotification(userId, 'KYC needs resubmission', 'Please upload clearer student ID documents to continue verification.');
    },

    ban: async (userId: string): Promise<void> => {
      const user = this.requireUser(userId);
      user.KYC_Status = 'Banned';
      this.db.auditLogs.unshift(`Account banned for ${user.Full_Name} • ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
    },
  };

  groups = {
    listBrowseable: async (userId: string): Promise<GroupRecord[]> => {
      const user = this.requireUser(userId);
      return this.db.groups
        .filter(group => group.Status === 'Active')
        .map(group => ({ ...clone(group), Description: `${group.Description}${this.isMember(group.Group_ID, user.User_ID) ? ' You are already a participant.' : ''}` }));
    },

    getGroup: async (groupId: string): Promise<GroupRecord | null> => {
      const group = this.db.groups.find(item => item.Group_ID === groupId);
      return group ? clone(group) : null;
    },

    getGroupStatus: async (userId: string, groupId: string): Promise<GroupStatusSnapshot> => {
      const group = this.requireGroup(groupId);
      const currentRound = this.currentOpenRound(groupId);
      const paidCount = currentRound ? this.successfulContributions(currentRound.Round_ID).length : 0;
      const totalMembers = this.activeMembershipCount(groupId);
      const paidUserIds = new Set(currentRound ? this.successfulContributions(currentRound.Round_ID).map(txn => txn.User_ID) : []);
      const contributors = this.db.memberships
        .filter(membership => membership.Group_ID === groupId && membership.Status === 'Active')
        .map(membership => {
          const user = this.requireUser(membership.User_ID);
          const initials = user.Full_Name
            .split(' ')
            .map(part => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          return {
            userId: user.User_ID,
            fullName: user.Full_Name,
            initials,
            joinedAt: membership.Joined_At,
            hasPaidCurrentRound: paidUserIds.has(user.User_ID),
            isCurrentWinner: currentRound?.Winner_ID === user.User_ID,
            cyclesWon: this.db.rounds.filter(round => round.Group_ID === groupId && round.Winner_ID === user.User_ID).length,
          };
        });
      const winnerHistory = this.db.rounds
        .filter(round => round.Group_ID === groupId && round.Winner_ID)
        .map(round => ({
          roundNumber: round.Round_Number,
          winnerName: this.requireUser(round.Winner_ID as string).Full_Name,
        }));
      const canCurrentUserPay = !!currentRound && this.isMember(groupId, userId) && !this.successfulContributions(currentRound.Round_ID).some(txn => txn.User_ID === userId) && group.Status === 'Active';
      return {
        group: clone(group),
        currentRound: currentRound ? clone(currentRound) : null,
        paidCount,
        totalMembers,
        winnerHistory,
        contributors,
        activeResolutionPoll: this.db.resolutionPolls.find(poll => poll.group_id === groupId && poll.status === 'Open')
          ? this.buildResolutionPollSummary(this.db.resolutionPolls.find(poll => poll.group_id === groupId && poll.status === 'Open')!, userId)
          : null,
        refundTickets: this.db.refundTickets.filter(ticket => ticket.group_id === groupId).map(clone),
        canCurrentUserPay,
        isFrozen: group.Status === 'Frozen',
      };
    },

    createRequest: async (userId: string, input: CreateGroupInput): Promise<GroupRecord> => {
      const user = this.requireUser(userId);
      this.assertVerifiedMember(user);
      const group: GroupRecord = {
        Group_ID: makeId('group'),
        Creator_ID: user.User_ID,
        Group_Name: input.groupName,
        Amount: input.amount,
        Max_Members: input.maxMembers,
        Frequency: input.frequency,
        Virtual_Acc_Ref: '',
        Status: 'Pending',
        Start_Date: new Date().toISOString().slice(0, 10),
        Description: input.description,
      };
      this.db.groups.unshift(group);
      this.db.auditLogs.unshift(`Group request created: ${group.Group_Name} • ${user.Full_Name}`);
      this.pushNotification(user.User_ID, 'Group request submitted', 'Your Equb request is pending admin approval.');
      return clone(group);
    },

    listPendingApprovals: async (): Promise<GroupApprovalItem[]> => {
      return this.db.groups
        .filter(group => (group.Status === 'Pending' || group.Status === 'Frozen') && !this.db.rejectedGroupIds.includes(group.Group_ID))
        .map(group => ({ group: clone(group), creator: clone(this.requireUser(group.Creator_ID)), note: 'Review amount, membership size, and creator status.' }));
    },

    approve: async (groupId: string): Promise<void> => {
      const group = this.requireGroup(groupId);
      group.Status = 'Active';
      group.Virtual_Acc_Ref = group.Virtual_Acc_Ref || `UEQ-${Math.floor(1000 + Math.random() * 9000)}`;
      this.db.auditLogs.unshift(`Group approved: ${group.Group_Name}`);
      this.pushNotification(group.Creator_ID, 'Group approved', 'Your Equb is now active and visible in browseable groups.');
    },

    reject: async (groupId: string): Promise<void> => {
      const group = this.requireGroup(groupId);
      if (!this.db.rejectedGroupIds.includes(group.Group_ID)) {
        this.db.rejectedGroupIds.push(group.Group_ID);
      }
      this.db.auditLogs.unshift(`Group rejected: ${group.Group_Name}`);
      this.pushNotification(group.Creator_ID, 'Group rejected', 'Your Equb request was rejected during admin review.');
    },

    freeze: async (groupId: string): Promise<void> => {
      const group = this.requireGroup(groupId);
      group.Status = 'Frozen';
      this.db.auditLogs.unshift(`Group frozen for compliance: ${group.Group_Name}`);
      this.pushNotification(group.Creator_ID, 'Group frozen', 'Admin compliance review temporarily paused this group.');
    },

    resolveFreeze: async (groupId: string): Promise<void> => {
      const group = this.requireGroup(groupId);
      group.Status = 'Active';
      this.db.auditLogs.unshift(`Group freeze resolved manually: ${group.Group_Name}`);
      this.pushNotification(group.Creator_ID, 'Group resumed', 'Admin reviewed the default case and resumed the group.');
    },

    createResolutionPoll: async (groupId: string): Promise<GroupStatusSnapshot['activeResolutionPoll']> => {
      const group = this.requireGroup(groupId);
      if (group.Status !== 'Frozen') {
        throw new Error('Resolution polls are only available for frozen groups.');
      }
      const existing = this.db.resolutionPolls.find(poll => poll.group_id === groupId && poll.status === 'Open');
      if (existing) {
        return this.buildResolutionPollSummary(existing, group.Creator_ID);
      }
      const activeMemberIds = this.db.memberships
        .filter(item => item.Group_ID === groupId && item.Status === 'Active')
        .map(item => item.User_ID);
      const eligibleVoterIds = activeMemberIds.length > 0
        ? activeMemberIds
        : this.db.users
          .filter(user => user.Role === 'Member' && user.KYC_Status === 'Verified')
          .slice(0, Math.min(group.Max_Members, 5))
          .map(user => user.User_ID);
      const poll: GroupResolutionPollRecord = {
        id: makeId('poll'),
        group_id: groupId,
        freeze_event_id: `freeze-${groupId}`,
        created_by_admin_id: 'user-admin',
        status: 'Open',
        opens_at: nowIso(),
        closes_at: plusMinutes(60 * 24),
        required_threshold_type: 'SimpleMajority',
        eligible_voter_user_ids: eligibleVoterIds,
        winning_option_id: null,
        closed_at: null,
        metadata: {},
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      const options: GroupResolutionPollOptionRecord[] = [
        ['Continue group', 'Resume while reserves stay frozen.', 'ContinueWithReserveFrozen'],
        ['Keep frozen', 'Pause for more admin follow-up.', 'KeepFrozenForReview'],
        ['Simulate refunds', 'Create refund tickets for eligible contributors.', 'CreateRefundTickets'],
      ].map(([label, description, action], index) => ({
        id: makeId('option'),
        poll_id: poll.id,
        option_label: label,
        option_description: description,
        resolution_action: action as GroupResolutionPollOptionRecord['resolution_action'],
        display_order: index + 1,
        created_at: nowIso(),
      }));
      this.db.resolutionPolls.unshift(poll);
      this.db.resolutionPollOptions.unshift(...options);
      this.db.auditLogs.unshift(`Resolution poll opened: ${group.Group_Name}`);
      this.pushNotification(group.Creator_ID, 'Resolution poll opened', 'Members can vote on the frozen group case.');
      return this.buildResolutionPollSummary(poll, group.Creator_ID);
    },

    voteResolutionPoll: async (groupId: string, pollId: string, optionId: string): Promise<void> => {
      const poll = this.db.resolutionPolls.find(item => item.id === pollId && item.group_id === groupId && item.status === 'Open');
      if (!poll) {
        throw new Error('This resolution poll is not open.');
      }
      const voterId = poll.eligible_voter_user_ids[0];
      if (!voterId) {
        throw new Error('No eligible voter is available.');
      }
      if (this.db.resolutionVotes.some(vote => vote.poll_id === pollId && vote.voter_user_id === voterId)) {
        throw new Error('You have already voted on this resolution poll.');
      }
      this.db.resolutionVotes.unshift({
        id: makeId('vote'),
        poll_id: pollId,
        voter_user_id: voterId,
        option_id: optionId,
        voted_at: nowIso(),
      });
      this.db.auditLogs.unshift(`Resolution vote recorded for ${groupId}`);
    },

    closeResolutionPoll: async (groupId: string, pollId: string): Promise<void> => {
      const poll = this.db.resolutionPolls.find(item => item.id === pollId && item.group_id === groupId);
      if (!poll) {
        throw new Error('Resolution poll not found.');
      }
      poll.status = 'Expired';
      poll.closed_at = nowIso();
      poll.updated_at = nowIso();
      const group = this.requireGroup(groupId);
      group.Status = 'Frozen';
      const refundTickets: RefundTicketRecord[] = poll.eligible_voter_user_ids.map(userId => ({
        id: makeId('refund'),
        group_id: groupId,
        round_id: this.currentOpenRound(groupId)?.Round_ID ?? null,
        user_id: userId,
        amount: group.Amount,
        currency: 'ETB',
        reason: 'Simulated refund after unresolved frozen group poll.',
        status: 'Created',
        calculation_snapshot: { poll_id: pollId },
        offset_applied_amount: 0,
        created_by_event_id: poll.freeze_event_id,
        created_at: nowIso(),
        processed_at: null,
      }));
      this.db.refundTickets.unshift(...refundTickets);
    },

    joinGroup: async (userId: string, groupId: string): Promise<void> => {
      const user = this.requireUser(userId);
      this.assertVerifiedMember(user);
      const group = this.requireGroup(groupId);

      if (group.Status !== 'Active') {
        throw new Error('Only active groups can be joined.');
      }
      if (this.isMember(groupId, userId)) {
        throw new Error('You are already a participant in this group.');
      }
      if (this.activeMembershipCount(groupId) >= group.Max_Members) {
        throw new Error('This group is already full.');
      }

      this.db.memberships.push({
        Membership_ID: makeId('membership'),
        Group_ID: groupId,
        User_ID: userId,
        Joined_At: nowIso(),
        Status: 'Active',
      });
      this.pushNotification(userId, 'Joined group', `You joined ${group.Group_Name} and can now contribute to the current round.`);
    },

    getDashboard: async (userId: string): Promise<DashboardSnapshot> => {
      const groupId = this.db.memberships.find(item => item.User_ID === userId && item.Status === 'Active')?.Group_ID ?? null;
      const currentGroup = groupId ? this.requireGroup(groupId) : null;
      const currentRound = currentGroup ? this.currentOpenRound(currentGroup.Group_ID) : null;
      const paidCount = currentRound ? this.successfulContributions(currentRound.Round_ID).length : 0;
      const totalMembers = currentGroup ? this.activeMembershipCount(currentGroup.Group_ID) : 0;
      const totalSaved = this.db.transactions
        .filter(item => item.User_ID === userId && item.Type === 'Contribution' && item.Status === 'Successful')
        .reduce((sum, item) => sum + item.Amount, 0);
      const readyPayout = this.readyPayout(userId);
      const reliabilityProfile = this.reliabilityProfileForUser(userId);
      const recentTransactions = this.db.transactions
        .filter(item => item.User_ID === userId)
        .sort((a, b) => b.Date.localeCompare(a.Date))
        .slice(0, 5)
        .map(clone);

      return {
        currentGroup: currentGroup ? clone(currentGroup) : null,
        currentRound: currentRound ? clone(currentRound) : null,
        paidCount,
        totalMembers,
        totalSaved,
        readyPayout,
        recentTransactions,
        reliabilityProfile: clone(reliabilityProfile),
      };
    },
  };

  formation = {
    listPublic: async (_userId: string): Promise<GroupFormationRequestSummary[]> => {
      return this.db.groupRequests
        .filter(request => request.visibility === 'Public' && request.status === 'Forming')
        .map(request => this.toFormationSummary(request));
    },

    listMine: async (userId: string): Promise<GroupFormationRequestSummary[]> => {
      return this.db.groupRequests
        .filter(request => request.creator_id === userId)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .map(request => this.toFormationSummary(request));
    },

    listPendingApproval: async (): Promise<GroupFormationRequestSummary[]> => {
      return this.db.groupRequests
        .filter(request => request.status === 'PendingApproval' && request.visibility !== 'Private')
        .map(request => this.toFormationSummary(request));
    },

    getRequest: async (_userId: string, requestId: string): Promise<GroupFormationDetail> => {
      return this.toFormationDetail(this.requireFormationRequest(requestId));
    },

    lookupInviteCode: async (userId: string, inviteCode: string): Promise<GroupFormationDetail> => {
      const user = this.requireUser(userId);
      this.assertVerifiedMember(user);
      const normalizedCode = inviteCode.trim().toUpperCase();
      const invitation = this.db.groupInvitations.find(item => item.invite_code?.toUpperCase() === normalizedCode && item.status === 'Pending');
      if (!invitation) {
        throw new Error('Invitation was not found.');
      }
      const request = this.requireFormationRequest(invitation.group_request_id);
      if (request.status !== 'Forming') {
        throw new Error('This group request is not accepting invitations.');
      }
      if (request.expires_at && request.expires_at <= nowIso()) {
        throw new Error('This group request has expired.');
      }
      return {
        ...this.toFormationDetail(request),
        joinRequests: this.db.groupJoinRequests
          .filter(item => item.group_request_id === request.id && item.user_id === userId)
          .map(clone),
      };
    },

    createRequest: async (userId: string, input: CreateGroupFormationInput): Promise<GroupFormationDetail> => {
      const user = this.requireUser(userId);
      this.assertVerifiedMember(user);
      const minMembers = input.minMembers ?? 5;
      if (!Number.isInteger(minMembers) || minMembers < 5) {
        throw new Error('Minimum members must be at least 5.');
      }
      if (!Number.isInteger(input.maxMembers) || input.maxMembers < minMembers) {
        throw new Error('Maximum members must be greater than or equal to minimum members.');
      }
      const request: GroupRequestRecord = {
        id: makeId('formation'),
        creator_id: user.User_ID,
        submitted_by: null,
        proposed_group_name: input.groupName,
        description: input.description ?? null,
        contribution_amount: input.amount,
        frequency: input.frequency,
        min_members: minMembers,
        max_members: input.maxMembers,
        visibility: input.visibility,
        invite_mode: input.inviteMode ?? (input.visibility === 'Public' ? 'PublicRequest' : 'InviteCodeAndDirect'),
        status: 'Forming',
        risk_level: 'Low',
        terms_version: input.termsVersion ?? 'phase2-v1',
        agreement_required: true,
        vesting_enabled: input.vestingEnabled ?? true,
        vesting_disabled_by_creator: input.vestingEnabled === false,
        risk_warning_accepted_at: input.vestingEnabled === false ? nowIso() : null,
        expires_at: plusMinutes(60 * 24 * 3),
        submitted_at: null,
        reviewed_by: null,
        reviewed_at: null,
        approval_decision_note: null,
        rejection_reason: null,
        approved_group_id: null,
        created_group_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      const creatorParticipant: GroupJoinRequestRecord = {
        id: makeId('join'),
        group_request_id: request.id,
        user_id: user.User_ID,
        status: 'Accepted',
        requested_at: nowIso(),
        accepted_at: nowIso(),
        rejected_at: null,
        removed_at: null,
        decision_by: user.User_ID,
        decision_reason: 'Creator automatically added to the forming group.',
      };
      this.db.groupRequests.unshift(request);
      this.db.groupJoinRequests.unshift(creatorParticipant);
      this.db.auditLogs.unshift(`Formation request created: ${request.proposed_group_name} • ${user.Full_Name}`);
      return this.toFormationDetail(request);
    },

    requestJoin: async (userId: string, requestId: string, terms: FormationTermsAcceptance): Promise<GroupFormationDetail> => {
      const user = this.requireUser(userId);
      this.assertVerifiedMember(user);
      const request = this.requireFormationRequest(requestId);
      if (request.status !== 'Forming' || request.visibility !== 'Public') {
        throw new Error('This group request is not accepting public join requests.');
      }
      if (!terms.groupTermsAccepted || terms.acceptedTermsVersion !== request.terms_version) {
        throw new Error('The current group terms must be accepted before requesting to join.');
      }
      let joinRequest = this.db.groupJoinRequests.find(item => item.group_request_id === requestId && item.user_id === userId);
      if (!joinRequest) {
        joinRequest = {
          id: makeId('join'),
          group_request_id: requestId,
          user_id: userId,
          status: 'Requested',
          requested_at: nowIso(),
          accepted_at: null,
          rejected_at: null,
          removed_at: null,
          decision_by: null,
          decision_reason: `Accepted group terms ${request.terms_version}`,
        };
        this.db.groupJoinRequests.unshift(joinRequest);
      }
      return this.toFormationDetail(request);
    },

    acceptJoin: async (userId: string, joinRequestId: string, decisionReason?: string): Promise<GroupFormationDetail> => {
      const joinRequest = this.requireJoinRequest(joinRequestId);
      const request = this.requireFormationRequest(joinRequest.group_request_id);
      if (request.creator_id !== userId) {
        throw new Error('Only the group request creator can manage formation participants.');
      }
      joinRequest.status = 'Accepted';
      joinRequest.accepted_at = nowIso();
      joinRequest.decision_by = userId;
      joinRequest.decision_reason = decisionReason ?? 'Creator accepted participant into the forming group.';
      return this.toFormationDetail(request);
    },

    removeParticipant: async (userId: string, joinRequestId: string, decisionReason?: string): Promise<GroupFormationDetail> => {
      const joinRequest = this.requireJoinRequest(joinRequestId);
      const request = this.requireFormationRequest(joinRequest.group_request_id);
      if (request.creator_id !== userId) {
        throw new Error('Only the group request creator can manage formation participants.');
      }
      joinRequest.status = joinRequest.status === 'Requested' ? 'Rejected' : 'Removed';
      joinRequest.decision_by = userId;
      joinRequest.decision_reason = decisionReason ?? 'Creator removed participant from the forming group.';
      joinRequest.removed_at = joinRequest.status === 'Removed' ? nowIso() : joinRequest.removed_at;
      joinRequest.rejected_at = joinRequest.status === 'Rejected' ? nowIso() : joinRequest.rejected_at;
      return this.toFormationDetail(request);
    },

    invite: async (userId: string, input: FormationInvitationInput): Promise<{ detail: GroupFormationDetail; invitation: GroupInvitationRecord }> => {
      const request = this.requireFormationRequest(input.requestId);
      if (request.creator_id !== userId) {
        throw new Error('Only the group request creator can create invitations.');
      }
      if (request.status !== 'Forming') {
        throw new Error('Only forming group requests can create invitations.');
      }
      const target = input.targetUserId || input.invitedPhoneOrStudentId?.trim();
      if (request.invite_mode === 'PublicRequest' && target) {
        throw new Error('Public forming groups only support shareable invite codes.');
      }
      const invitation: GroupInvitationRecord = {
        id: makeId('invite'),
        group_request_id: request.id,
        invited_user_id: input.targetUserId ?? null,
        invited_phone_or_student_id: input.invitedPhoneOrStudentId?.trim() || null,
        invite_code: input.inviteCode?.trim().toUpperCase() ?? makeId('code').toUpperCase(),
        status: 'Pending',
        expires_at: request.expires_at,
        created_by: userId,
        accepted_at: null,
        declined_at: null,
        created_at: nowIso(),
      };
      this.db.groupInvitations.unshift(invitation);
      return { detail: this.toFormationDetail(request), invitation: clone(invitation) };
    },

    acceptInvite: async (userId: string, input: FormationTermsAcceptance & { invitationId?: string; inviteCode?: string }): Promise<GroupFormationDetail> => {
      const user = this.requireUser(userId);
      this.assertVerifiedMember(user);
      const normalizedCode = input.inviteCode?.trim().toUpperCase();
      const invitation = this.db.groupInvitations.find(item => (input.invitationId && item.id === input.invitationId) || (normalizedCode && item.invite_code?.toUpperCase() === normalizedCode));
      if (!invitation) {
        throw new Error('Invitation was not found.');
      }
      const request = this.requireFormationRequest(invitation.group_request_id);
      if (request.status !== 'Forming') {
        throw new Error('This group request is not accepting invitations.');
      }
      if (request.expires_at && request.expires_at <= nowIso()) {
        throw new Error('This group request has expired.');
      }
      if (!input.groupTermsAccepted || input.acceptedTermsVersion !== request.terms_version) {
        throw new Error('The current group terms must be accepted before accepting an invite.');
      }
      const reusableInviteCode = Boolean(input.inviteCode && invitation.invite_code && !invitation.invited_user_id && !invitation.invited_phone_or_student_id);
      if (!reusableInviteCode && invitation.status !== 'Pending') {
        throw new Error('Invitation is no longer pending.');
      }
      if (invitation.invited_user_id && invitation.invited_user_id !== userId) {
        throw new Error('This invitation belongs to a different member.');
      }
      if (invitation.invited_phone_or_student_id && invitation.invited_phone_or_student_id !== user.Phone_Number && invitation.invited_phone_or_student_id !== user.User_ID) {
        throw new Error('This invitation belongs to a different member.');
      }

      let joinRequest = this.db.groupJoinRequests.find(item => item.group_request_id === request.id && item.user_id === userId);
      if (joinRequest?.status === 'Accepted') {
        return this.toFormationDetail(request);
      }
      if (this.acceptedFormationCount(request.id) >= request.max_members) {
        throw new Error('This group request is already full.');
      }
      if (!reusableInviteCode) {
        invitation.status = 'Accepted';
        invitation.accepted_at = nowIso();
      }
      if (!joinRequest) {
        joinRequest = {
          id: makeId('join'),
          group_request_id: request.id,
          user_id: userId,
          status: 'Accepted',
          requested_at: nowIso(),
          accepted_at: nowIso(),
          rejected_at: null,
          removed_at: null,
          decision_by: invitation.created_by,
          decision_reason: `Accepted invite ${invitation.id} with group terms ${request.terms_version}`,
        };
        this.db.groupJoinRequests.unshift(joinRequest);
      } else {
        joinRequest.status = 'Accepted';
        joinRequest.accepted_at = nowIso();
        joinRequest.rejected_at = null;
        joinRequest.removed_at = null;
        joinRequest.decision_by = invitation.created_by;
        joinRequest.decision_reason = `Accepted invite ${invitation.id} with group terms ${request.terms_version}`;
      }
      return this.toFormationDetail(request);
    },

    submitForApproval: async (userId: string, requestId: string): Promise<GroupFormationDetail> => {
      const request = this.requireFormationRequest(requestId);
      if (request.creator_id !== userId) {
        throw new Error('Only the group request creator can activate this request.');
      }
      if (this.acceptedFormationCount(requestId) < request.min_members) {
        throw new Error(`At least ${request.min_members} accepted participants are required before this group can start.`);
      }
      if (request.visibility === 'Private') {
        const group = this.activateFormationRequest(request, 'Private invite-based group started by creator.');
        this.db.auditLogs.unshift(`Private formation started: ${group.Group_Name}`);
        return this.toFormationDetail(request);
      }
      request.status = 'PendingApproval';
      request.submitted_by = userId;
      request.submitted_at = nowIso();
      request.updated_at = nowIso();
      return this.toFormationDetail(request);
    },

    adminApprove: async (requestId: string, decisionReason?: string): Promise<GroupRecord> => {
      const request = this.requireFormationRequest(requestId);
      return clone(this.activateFormationRequest(request, decisionReason ?? 'Approved by admin.'));
    },

    adminReject: async (requestId: string, decisionReason?: string): Promise<GroupFormationDetail> => {
      const request = this.requireFormationRequest(requestId);
      request.status = 'Rejected';
      request.rejection_reason = decisionReason ?? 'Rejected by admin.';
      request.approval_decision_note = request.rejection_reason;
      request.reviewed_at = nowIso();
      request.updated_at = nowIso();
      return this.toFormationDetail(request);
    },
  };

  payments = {
    payContribution: async (userId: string, groupId: string, method: PaymentMethod): Promise<PaymentResult> => {
      return this.recordContribution(userId, groupId, method);
    },

    startContributionUssd: async (userId: string, groupId: string): Promise<UssdSessionState> => {
      const { group } = this.assertContributionReady(userId, groupId);
      const sessionId = makeId('ussd');
      this.db.ussdSessions[sessionId] = {
        sessionId,
        userId,
        groupId,
        stage: 'AwaitMenu',
        expiresAt: plusMinutes(3),
      };
      return this.toUssdSessionState(this.db.ussdSessions[sessionId], group);
    },

    submitContributionUssd: async (userId: string, sessionId: string, input: string): Promise<UssdSessionState> => {
      const session = this.db.ussdSessions[sessionId];
      if (!session || session.userId !== userId) {
        throw new Error('USSD session was not found. Start again.');
      }

      const group = this.requireGroup(session.groupId);
      const reply = input.trim();

      if (session.expiresAt < nowIso()) {
        session.stage = 'Expired';
        session.error = 'Session expired. Dial the short code again.';
        return this.toUssdSessionState(session, group);
      }

      if (session.stage === 'Completed' || session.stage === 'Cancelled' || session.stage === 'Expired') {
        return this.toUssdSessionState(session, group);
      }

      if (reply === '0') {
        session.stage = 'Cancelled';
        session.error = undefined;
        return this.toUssdSessionState(session, group);
      }

      switch (session.stage) {
        case 'AwaitMenu':
          if (reply !== '1') {
            session.error = 'Reply with 1 to pay the merchant or 0 to cancel.';
            return this.toUssdSessionState(session, group);
          }
          session.stage = 'AwaitReference';
          session.error = undefined;
          return this.toUssdSessionState(session, group);
        case 'AwaitReference':
          if (reply.toUpperCase() !== group.Virtual_Acc_Ref.toUpperCase()) {
            session.error = `Reference must match ${group.Virtual_Acc_Ref}.`;
            return this.toUssdSessionState(session, group);
          }
          session.merchantRef = reply.toUpperCase();
          session.stage = 'AwaitAmount';
          session.error = undefined;
          return this.toUssdSessionState(session, group);
        case 'AwaitAmount':
          if (Number(reply) !== group.Amount) {
            session.error = `Amount must be exactly ${group.Amount} ETB.`;
            return this.toUssdSessionState(session, group);
          }
          session.amount = group.Amount;
          session.stage = 'AwaitConfirm';
          session.error = undefined;
          return this.toUssdSessionState(session, group);
        case 'AwaitConfirm':
          if (reply !== '1') {
            session.error = 'Reply with 1 to confirm or 0 to cancel.';
            return this.toUssdSessionState(session, group);
          }
          session.stage = 'AwaitPin';
          session.error = undefined;
          return this.toUssdSessionState(session, group);
        case 'AwaitPin':
          if (!/^\d{6}$/.test(reply)) {
            session.error = 'Enter your 6-digit Telebirr PIN.';
            return this.toUssdSessionState(session, group);
          }
          session.paymentResult = await this.recordContribution(userId, group.Group_ID, 'MockUSSD');
          session.stage = 'Completed';
          session.error = undefined;
          return this.toUssdSessionState(session, group);
        default:
          return this.toUssdSessionState(session, group);
      }
    },

    listTransactions: async (userId: string): Promise<TransactionRecord[]> => {
      return this.db.transactions.filter(item => item.User_ID === userId).sort((a, b) => b.Date.localeCompare(a.Date)).map(clone);
    },

    getWallet: async (userId: string): Promise<WalletSnapshot> => ({
      balance: this.readyPayout(userId),
      readyPayout: this.readyPayout(userId),
      reservedPayout: 0,
      pendingReserveReleases: 0,
      defaultDestination: 'Internal wallet clearance',
    }),

    withdrawPayout: async (userId: string): Promise<void> => {
      const payout = this.db.transactions.find(item => item.User_ID === userId && item.Type === 'Payout' && item.Status === 'Pending');
      if (!payout) {
        throw new Error('No pending payout is available.');
      }
      payout.Status = 'Successful';
      payout.Date = nowIso();
      this.db.providerLogs.unshift({ provider: payout.Payment_Method, status: 'Successful', message: `Wallet cleared for payout ${userId}`, createdAt: nowIso() });
      this.pushNotification(userId, 'Withdrawal recorded', 'Your wallet payout was cleared from the internal ledger.');
    },
  };

  notifications = {
    listForUser: async (userId: string): Promise<AppNotification[]> => {
      return clone((this.db.notifications[userId] ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },

    markAllRead: async (userId: string): Promise<void> => {
      (this.db.notifications[userId] ?? []).forEach(item => {
        item.unread = false;
      });
    },

    sendReminderBatch: async (): Promise<ReminderBatchResult> => {
      const groups = this.db.groups.filter(group => group.Status === 'Active');
      this.db.reminderQueue = groups.map(group => {
        const round = this.currentOpenRound(group.Group_ID);
        if (!round) {
          return `${group.Group_Name} • no open round`;
        }
        const unpaid = this.activeMembershipCount(group.Group_ID) - this.successfulContributions(round.Round_ID).length;
        return `${group.Group_Name} • ${Math.max(unpaid, 0)} unpaid members • reminder queued`;
      });
      this.db.providerLogs.unshift({ provider: 'ReminderEngine', status: 'Successful', message: `Reminder batch generated for ${this.db.reminderQueue.length} groups`, createdAt: nowIso() });
      return { queue: clone(this.db.reminderQueue), sentAt: nowIso() };
    },
  };

  reports = {
    getAdminOverview: async (): Promise<AdminOverview> => ({
      pendingKycCount: this.db.users.filter(user => user.Role === 'Member' && user.KYC_Status === 'Unverified').length,
      pendingGroupCount: this.db.groups.filter(group => group.Status === 'Pending').length + this.db.groupRequests.filter(request => request.status === 'PendingApproval' && request.visibility !== 'Private').length,
      activeGroupCount: this.db.groups.filter(group => group.Status === 'Active').length,
      exportsCount: 3,
      logs: clone(this.db.auditLogs),
      reminderQueue: clone(this.db.reminderQueue),
      providerLogs: clone(this.db.providerLogs),
      reliabilitySummary: this.reliabilitySummary(),
      auditTimeline: this.db.auditLogs.map((log, index) => ({
        id: `mock-audit-${index}`,
        eventType: log.split(' • ')[0].toLowerCase().replace(/\s+/g, '_'),
        actorRole: index % 2 === 0 ? 'Admin' : 'System',
        actorName: index % 2 === 0 ? 'Saba Admin' : null,
        entityType: 'demo_event',
        entityId: null,
        createdAt: nowIso(),
        summary: log,
      })),
    }),

    listReports: async (): Promise<ReportSummary[]> => [
      { title: 'Total transaction volume', format: 'PDF', description: 'Aggregated contribution and payout volume.' },
      { title: 'Banned users and rejected groups', format: 'CSV', description: 'Compliance status export.' },
      { title: 'Payout success and failure', format: 'PDF', description: 'Operational payout delivery summary.' },
    ],

    exportReport: async (title: string, format: 'PDF' | 'CSV'): Promise<ExportedReport> => {
      const content = format === 'CSV'
        ? 'title,value\nTotal transaction volume,5000\nPending KYC,1'
        : `Report: ${title}\nGenerated: ${nowIso()}\nTransactions: ${this.db.transactions.length}`;
      return {
        fileName: `${title.toLowerCase().replace(/\s+/g, '-')}.${format.toLowerCase()}`,
        format,
        content,
      };
    },
  };

  private requireFormationRequest(requestId: string): GroupRequestRecord {
    const request = this.db.groupRequests.find(item => item.id === requestId);
    if (!request) {
      throw new Error('Group formation request was not found.');
    }
    return request;
  }

  private requireJoinRequest(joinRequestId: string): GroupJoinRequestRecord {
    const joinRequest = this.db.groupJoinRequests.find(item => item.id === joinRequestId);
    if (!joinRequest) {
      throw new Error('Group formation participant request was not found.');
    }
    return joinRequest;
  }

  private acceptedFormationCount(requestId: string) {
    return this.db.groupJoinRequests.filter(item => item.group_request_id === requestId && item.status === 'Accepted').length;
  }

  private activateFormationRequest(request: GroupRequestRecord, decisionReason: string): GroupRecord {
    if (request.status === 'Approved' && request.approved_group_id) {
      return this.requireGroup(request.approved_group_id);
    }
    request.status = 'Approved';
    request.approval_decision_note = decisionReason;
    request.reviewed_at = nowIso();
    const group: GroupRecord = {
      Group_ID: makeId('group'),
      Creator_ID: request.creator_id,
      Group_Name: request.proposed_group_name,
      Amount: request.contribution_amount,
      Max_Members: request.max_members,
      Frequency: request.frequency,
      Virtual_Acc_Ref: `UEQ-${Math.floor(1000 + Math.random() * 9000)}`,
      Status: 'Active',
      Start_Date: new Date().toISOString().slice(0, 10),
      Description: request.description ?? '',
    };
    request.approved_group_id = group.Group_ID;
    request.created_group_at = nowIso();
    this.db.groups.unshift(group);
    this.db.groupJoinRequests
      .filter(join => join.group_request_id === request.id && join.status === 'Accepted')
      .forEach(join => {
        if (!this.db.memberships.some(membership => membership.Group_ID === group.Group_ID && membership.User_ID === join.user_id)) {
          this.db.memberships.push({
            Membership_ID: makeId('membership'),
            Group_ID: group.Group_ID,
            User_ID: join.user_id,
            Joined_At: nowIso(),
            Status: 'Active',
          });
        }
      });
    return group;
  }

  private toFormationSummary(request: GroupRequestRecord): GroupFormationRequestSummary {
    const acceptedCount = this.acceptedFormationCount(request.id);
    return {
      ...clone(request),
      accepted_participant_count: acceptedCount,
      remaining_slots: Math.max(request.max_members - acceptedCount, 0),
    };
  }

  private toFormationDetail(request: GroupRequestRecord): GroupFormationDetail {
    return {
      groupRequest: clone(request),
      joinRequests: this.db.groupJoinRequests.filter(item => item.group_request_id === request.id).map(clone),
      invitations: this.db.groupInvitations.filter(item => item.group_request_id === request.id).map(clone),
      accepted_participant_count: this.acceptedFormationCount(request.id),
      remaining_slots: Math.max(request.max_members - this.acceptedFormationCount(request.id), 0),
    };
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\s+/g, '').replace(/^\+251/, '0');
  }

  private toSessionUser(user: UserRecord): SessionUser {
    return {
      userId: user.User_ID,
      fullName: user.Full_Name,
      phoneNumber: user.Phone_Number,
      role: user.Role,
      kycStatus: user.KYC_Status,
    };
  }

  private requireUser(userId: string): UserRecord {
    const user = this.db.users.find(item => item.User_ID === userId);
    if (!user) {
      throw new Error('User not found.');
    }
    return user;
  }

  private requireGroup(groupId: string): GroupRecord {
    const group = this.db.groups.find(item => item.Group_ID === groupId);
    if (!group) {
      throw new Error('Group not found.');
    }
    return group;
  }

  private currentOpenRound(groupId: string): RoundRecord | null {
    return this.db.rounds.find(item => item.Group_ID === groupId && item.Status === 'Open') ?? null;
  }

  private successfulContributions(roundId: string) {
    return this.db.transactions.filter(item => item.Round_ID === roundId && item.Type === 'Contribution' && item.Status === 'Successful');
  }

  private buildResolutionPollSummary(poll: GroupResolutionPollRecord, currentUserId: string): GroupStatusSnapshot['activeResolutionPoll'] {
    const options = this.db.resolutionPollOptions
      .filter(option => option.poll_id === poll.id)
      .sort((a, b) => a.display_order - b.display_order);
    const votes = this.db.resolutionVotes.filter(vote => vote.poll_id === poll.id);
    const voteCounts = Object.fromEntries(options.map(option => [
      option.id,
      votes.filter(vote => vote.option_id === option.id).length,
    ]));

    return {
      poll: clone(poll),
      options: options.map(clone),
      voteCounts,
      requiredVotes: Math.floor(poll.eligible_voter_user_ids.length / 2) + 1,
      eligibleVoterCount: poll.eligible_voter_user_ids.length,
      currentUserVote: votes.find(vote => vote.voter_user_id === currentUserId) ?? null,
    };
  }

  private reliabilityProfileForUser(userId: string) {
    const existing = this.db.reliabilityProfiles.find(profile => profile.user_id === userId);
    if (existing) {
      return existing;
    }
    return {
      user_id: userId,
      public_status: this.requireUser(userId).KYC_Status === 'Banned' ? 'Banned' : 'New',
      completed_groups_count: 0,
      perfect_completed_groups_count: 0,
      late_payment_count: 0,
      default_count: 0,
      restriction_count: 0,
      current_maturity_completed_count: 0,
      updated_at: nowIso(),
    } satisfies UserReliabilityProfileRecord;
  }

  private reliabilitySummary() {
    return this.db.reliabilityProfiles.reduce<Partial<Record<ReliabilityPublicStatus, number>>>((summary, profile) => {
      summary[profile.public_status] = (summary[profile.public_status] ?? 0) + 1;
      return summary;
    }, {});
  }

  private activeMembershipCount(groupId: string) {
    return this.db.memberships.filter(item => item.Group_ID === groupId && item.Status === 'Active').length;
  }

  private isMember(groupId: string, userId: string) {
    return this.db.memberships.some(item => item.Group_ID === groupId && item.User_ID === userId && item.Status === 'Active');
  }

  private readyPayout(userId: string) {
    return this.db.transactions
      .filter(item => item.User_ID === userId && item.Type === 'Payout' && item.Status === 'Pending')
      .reduce((sum, item) => sum + item.Amount, 0);
  }

  private assertVerifiedMember(user: UserRecord) {
    if (user.Role !== 'Member') {
      throw new Error('This action is only available to members.');
    }
    if (user.KYC_Status !== 'Verified') {
      throw new Error('KYC verification is required for this action.');
    }
  }

  private pushNotification(userId: string, title: string, body: string) {
    const target = this.db.notifications[userId] ?? [];
    target.unshift({ id: makeId('notification'), title, body, createdAt: nowIso(), unread: true });
    this.db.notifications[userId] = target;
  }

  private assertContributionReady(userId: string, groupId: string) {
    this.requireUser(userId);
    const group = this.requireGroup(groupId);
    const round = this.currentOpenRound(groupId);
    if (!round) {
      throw new Error('There is no open round for this group.');
    }
    if (group.Status !== 'Active') {
      throw new Error('Only active groups can accept contributions.');
    }
    if (!this.isMember(groupId, userId)) {
      throw new Error('You must join the group before paying contributions.');
    }
    const alreadyPaid = this.successfulContributions(round.Round_ID).some(item => item.User_ID === userId);
    if (alreadyPaid) {
      throw new Error('You have already paid for this round.');
    }
    return { group, round };
  }

  private async recordContribution(userId: string, groupId: string, method: PaymentMethod): Promise<PaymentResult> {
    const { group, round } = this.assertContributionReady(userId, groupId);
    const receiptRef = `GW-${Math.floor(100000 + Math.random() * 900000)}`;
    const transaction: TransactionRecord = {
      Trans_ID: makeId('txn'),
      User_ID: userId,
      Round_ID: round.Round_ID,
      Amount: group.Amount,
      Type: 'Contribution',
      Payment_Method: method,
      Gateway_Ref: receiptRef,
      Status: 'Successful',
      Date: nowIso(),
    };
    this.db.transactions.unshift(transaction);
    this.db.providerLogs.unshift({ provider: method, status: 'Successful', message: `Contribution reconciled for ${group.Group_Name}`, createdAt: nowIso() });
    this.pushNotification(userId, 'Contribution received', `Your ${method} payment for ${group.Group_Name} was successfully reconciled.`);

    const payoutAmount = this.tryCompleteRound(group, round, userId);
    return {
      receiptRef,
      amount: group.Amount,
      method,
      autoDrawTriggered: payoutAmount > 0,
      payoutAmount,
    };
  }

  private toUssdSessionState(session: UssdSessionRecord, group: GroupRecord): UssdSessionState {
    const base = {
      sessionId: session.sessionId,
      shortCode: '*127#',
      providerLabel: 'Telebirr',
      stage: session.stage,
      expiresAt: session.expiresAt,
      allowCancel: session.stage !== 'Completed' && session.stage !== 'Cancelled' && session.stage !== 'Expired',
      error: session.error,
    };

    switch (session.stage) {
      case 'AwaitMenu':
        return {
          ...base,
          prompt: ['Telebirr', '1. Pay merchant', '2. Buy airtime', '3. Check balance', '0. Cancel'].join('\n'),
          inputLabel: 'Reply with a number',
        };
      case 'AwaitReference':
        return {
          ...base,
          prompt: ['Pay merchant', `${group.Group_Name}`, `Enter merchant ref`, `Use ${group.Virtual_Acc_Ref}`].join('\n'),
          inputLabel: 'Merchant reference',
        };
      case 'AwaitAmount':
        return {
          ...base,
          prompt: ['Enter amount', `Round contribution: ${group.Amount} ETB`, 'Exact amount is required'].join('\n'),
          inputLabel: 'Amount',
        };
      case 'AwaitConfirm':
        return {
          ...base,
          prompt: ['Confirm payment', `Group: ${group.Group_Name}`, `Ref: ${group.Virtual_Acc_Ref}`, `Amount: ${group.Amount} ETB`, '1. Confirm', '0. Cancel'].join('\n'),
          inputLabel: 'Reply with a number',
        };
      case 'AwaitPin':
        return {
          ...base,
          prompt: ['Authorize payment', `Enter your 6-digit Telebirr PIN`, `${group.Amount} ETB -> ${group.Group_Name}`].join('\n'),
          inputLabel: 'PIN',
          expectsMaskedInput: true,
        };
      case 'Completed':
        return {
          ...base,
          allowCancel: false,
          prompt: ['Payment successful', `${group.Amount} ETB sent`, `Ref: ${session.paymentResult?.receiptRef ?? '-'}`, 'SMS confirmation will follow shortly.'].join('\n'),
          inputLabel: '',
          paymentResult: session.paymentResult,
        };
      case 'Cancelled':
        return {
          ...base,
          allowCancel: false,
          prompt: 'Session cancelled.\nNo contribution was recorded.',
          inputLabel: '',
        };
      case 'Expired':
        return {
          ...base,
          allowCancel: false,
          prompt: 'Session expired.\nStart the USSD prompt again.',
          inputLabel: '',
        };
      default:
        return {
          ...base,
          prompt: 'USSD session unavailable.',
          inputLabel: '',
        };
    }
  }

  private tryCompleteRound(group: GroupRecord, round: RoundRecord, payerUserId: string) {
    const paidCount = this.successfulContributions(round.Round_ID).length;
    const totalMembers = this.activeMembershipCount(group.Group_ID);
    if (paidCount !== totalMembers) {
      return 0;
    }

    round.Status = 'Locked';
    const priorWinners = this.db.rounds
      .filter(item => item.Group_ID === group.Group_ID && item.Winner_ID)
      .map(item => item.Winner_ID as string);
    const eligibleUserIds = this.db.memberships
      .filter(item => item.Group_ID === group.Group_ID && item.Status === 'Active')
      .map(item => item.User_ID)
      .filter(userId => this.successfulContributions(round.Round_ID).some(txn => txn.User_ID === userId))
      .filter(userId => !priorWinners.includes(userId));

    const winnerId = eligibleUserIds.includes(payerUserId) ? payerUserId : eligibleUserIds[0];
    round.Winner_ID = winnerId ?? null;
    round.Draw_Date = nowIso();
    round.Status = 'Completed';

    let payoutAmount = 0;
    if (winnerId) {
      payoutAmount = group.Amount * totalMembers;
      this.db.transactions.unshift({
        Trans_ID: makeId('txn'),
        User_ID: winnerId,
        Round_ID: round.Round_ID,
        Amount: payoutAmount,
        Type: 'Payout',
        Payment_Method: 'MockUSSD',
        Gateway_Ref: `PO-${Math.floor(100000 + Math.random() * 900000)}`,
        Status: 'Pending',
        Date: nowIso(),
      });
      this.pushNotification(winnerId, 'Winner selected automatically', `${group.Group_Name} round ${round.Round_Number} completed and your payout is ready.`);
    }

    const nextRound: RoundRecord = {
      Round_ID: makeId('round'),
      Group_ID: group.Group_ID,
      Round_Number: round.Round_Number + 1,
      Winner_ID: null,
      Draw_Date: null,
      Status: 'Open',
    };
    this.db.rounds.push(nextRound);
    this.db.auditLogs.unshift(`Round ${round.Round_Number} auto-completed for ${group.Group_Name}`);
    return payoutAmount;
  }
}

export const mockBackend = new MockBackend();
