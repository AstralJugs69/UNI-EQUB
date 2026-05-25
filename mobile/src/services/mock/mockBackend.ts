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
  GroupJoinRequestRecord,
  GroupRecord,
  GroupStatusSnapshot,
  KycReviewItem,
  MemberKycState,
  MembershipRecord,
  PaymentMethod,
  PaymentResult,
  ReminderBatchResult,
  ReportSummary,
  RoundRecord,
  SessionUser,
  SimulationCommand,
  SimulationCommandResult,
  SimulationSnapshot,
  TransactionRecord,
  UssdSessionState,
  UserProfile,
  UserRecord,
  WalletSnapshot,
} from '../../types/domain';
import type {
  AppServices,
  CreateGroupFormationInput,
  CreateGroupInput,
  FormationInvitationInput,
  FormationTermsAcceptance,
  KycSubmissionInput,
  LoginInput,
  RegisterInput,
} from '../contracts';

interface SessionRecord {
  userId: string;
  expiresAt: string;
}

interface OtpChallenge {
  phoneNumber: string;
  otp: string;
  expiresAt: string;
}

interface UssdSessionRecord {
  sessionId: string;
  userId: string;
  groupId: string;
  stage: UssdSessionState['stage'];
  expiresAt: string;
  paymentResult?: PaymentResult;
}

interface DatabaseState {
  users: UserRecord[];
  groups: GroupRecord[];
  memberships: MembershipRecord[];
  rounds: RoundRecord[];
  transactions: TransactionRecord[];
  notifications: Record<string, AppNotification[]>;
  sessions: Record<string, SessionRecord>;
  otpChallenges: Record<string, OtpChallenge>;
  ussdSessions: Record<string, UssdSessionRecord>;
  auditLogs: string[];
  groupRequests: GroupFormationRequestSummary[];
  groupJoinRequests: GroupJoinRequestRecord[];
  groupInvitations: GroupInvitationRecord[];
  profiles: Record<string, UserProfile>;
  accountSlots: AccountSlot[];
  announcements: GroupAnnouncement[];
  simulationEvents: SimulationSnapshot['events'];
  kycStates: Record<string, MemberKycState>;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const hashPassword = (password: string) => `hash:${password}`;
const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();
const plusMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const emptyDashboard = (kycState: MemberKycState): DashboardSnapshot => ({
  currentGroup: null,
  activeGroups: [],
  completedGroups: [],
  currentRound: null,
  paidCount: 0,
  totalMembers: 0,
  totalSaved: 0,
  readyPayout: 0,
  recentTransactions: [],
  kycState,
  reliabilityProfile: null,
});

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
      users: [],
      groups: [],
      memberships: [],
      rounds: [],
      transactions: [],
      notifications: {},
      sessions: {},
      otpChallenges: {},
      ussdSessions: {},
      auditLogs: [],
      groupRequests: [],
      groupJoinRequests: [],
      groupInvitations: [],
      profiles: {},
      accountSlots: [],
      announcements: [],
      simulationEvents: [],
      kycStates: {},
    };
  }

  auth = {
    register: async (input: RegisterInput) => {
      if (this.db.users.some(user => this.normalizePhone(user.Phone_Number) === this.normalizePhone(input.phoneNumber))) {
        throw new Error('A user with this phone number already exists.');
      }
      if (this.db.users.some(user => user.Email?.toLowerCase() === input.email.toLowerCase())) {
        throw new Error('A user with this email address already exists.');
      }
      const requiresOtp = this.db.users.filter(user => user.Role === 'Member').length === 0;
      const user: UserRecord = {
        User_ID: makeId('user'),
        Full_Name: input.fullName.trim(),
        Phone_Number: this.normalizePhone(input.phoneNumber),
        Email: input.email.trim().toLowerCase(),
        Email_Verified_At: null,
        Password_Hash: hashPassword(input.password),
        Student_ID_Img: input.studentIdImage,
        KYC_Status: 'Unverified',
        Role: 'Member',
        Created_At: nowIso(),
      };
      this.db.users.push(user);
      this.db.kycStates[user.User_ID] = {
        status: input.studentIdImage ? 'PendingReview' : 'NotSubmitted',
        canSubmit: !input.studentIdImage,
        submittedAt: input.studentIdImage ? nowIso() : null,
      };
      return {
        user: this.toSessionUser(user),
        requiresOtp,
        requiresEmailVerification: true,
        pendingKycToken: requiresOtp ? undefined : `mock-pending-kyc-${user.Phone_Number}`,
      };
    },

    requestOtp: async (phoneNumber: string): Promise<{ challengeId: string }> => {
      const challengeId = makeId('otp');
      this.db.otpChallenges[phoneNumber] = {
        phoneNumber,
        otp: '4719',
        expiresAt: plusMinutes(10),
      };
      return { challengeId };
    },

    verifyOtp: async (phoneNumber: string, otp: string): Promise<{ pendingKycToken?: string }> => {
      const challenge = this.db.otpChallenges[phoneNumber];
      if (!challenge || challenge.otp !== otp || new Date(challenge.expiresAt).getTime() < Date.now()) {
        throw new Error('No OTP challenge is active for this number.');
      }
      delete this.db.otpChallenges[phoneNumber];
      return { pendingKycToken: `mock-pending-kyc-${phoneNumber}` };
    },

    requestEmailVerification: async (input: { userId?: string; email?: string }) => {
      const user = input.userId
        ? this.requireUser(input.userId)
        : this.db.users.find(item => item.Email?.toLowerCase() === input.email?.toLowerCase());
      if (!user?.Email) {
        throw new Error('No email address is attached to this account.');
      }
      return { email: user.Email, expiresAt: plusMinutes(30) };
    },

    verifyEmail: async (input: { userId?: string; code: string }) => {
      const user = this.requireUser(input.userId ?? '');
      if (input.code !== '123456') {
        throw new Error('The email verification code is incorrect or has already been used.');
      }
      user.Email_Verified_At = nowIso();
      return {
        email: user.Email ?? '',
        verifiedAt: user.Email_Verified_At,
        user: this.toSessionUser(user),
        requiresOtp: (await this.auth.getOtpGate({ phoneNumber: user.Phone_Number })).requiresOtp,
        pendingKycToken: user.Role === 'Member' && user.KYC_Status === 'Unverified' ? `mock-pending-kyc-${user.Phone_Number}` : undefined,
      };
    },

    beginLogin: async (input: LoginInput, roleHint?: 'Member' | 'Admin') => {
      const session = await this.auth.login(input, roleHint);
      return { challengeToken: session.token, phoneNumber: session.user.phoneNumber };
    },

    completeLogin: async (challengeToken: string): Promise<AuthSession> => {
      const session = await this.auth.restore(challengeToken);
      if (!session) {
        throw new Error('Login challenge expired.');
      }
      return session;
    },

    login: async (input: LoginInput, roleHint?: 'Member' | 'Admin'): Promise<AuthSession> => {
      const user = input.email
        ? this.db.users.find(item => item.Email?.toLowerCase() === input.email?.toLowerCase())
        : this.db.users.find(item => this.normalizePhone(item.Phone_Number) === this.normalizePhone(input.phoneNumber ?? ''));
      if (!user || user.Password_Hash !== hashPassword(input.password)) {
        throw new Error('Invalid email or password.');
      }
      if (user.KYC_Status === 'Banned') {
        throw new Error('This account has been banned and cannot log in.');
      }
      if (roleHint && user.Role !== roleHint) {
        throw new Error(roleHint === 'Admin' ? 'Admin access is not available for this account.' : 'Member access is not available for this account.');
      }
      const token = makeId('session');
      this.db.sessions[token] = { userId: user.User_ID, expiresAt: plusMinutes(60 * 24 * 7) };
      return { token, user: this.toSessionUser(user) };
    },

    getOtpGate: async (input: { token?: string; phoneNumber?: string }) => {
      const user = input.token
        ? this.db.users.find(item => item.User_ID === this.db.sessions[input.token!]?.userId)
        : this.db.users.find(item => this.normalizePhone(item.Phone_Number) === this.normalizePhone(input.phoneNumber ?? ''));
      const firstMember = this.db.users.filter(item => item.Role === 'Member').sort((a, b) => a.Created_At.localeCompare(b.Created_At))[0];
      return { requiresOtp: !!user && user.Role === 'Member' && firstMember?.User_ID === user.User_ID, phoneNumber: user?.Phone_Number ?? input.phoneNumber ?? null };
    },

    resetPassword: async (input: { phoneNumber: string; newPassword: string; otp?: string }) => {
      const user = this.db.users.find(item => this.normalizePhone(item.Phone_Number) === this.normalizePhone(input.phoneNumber));
      if (!user) {
        throw new Error('No account was found for this phone number.');
      }
      const gate = await this.auth.getOtpGate({ phoneNumber: input.phoneNumber });
      if (gate.requiresOtp) {
        if (!input.otp) {
          throw new Error('OTP is required to reset this password.');
        }
        await this.auth.verifyOtp(input.phoneNumber, input.otp);
      }
      user.Password_Hash = hashPassword(input.newPassword);
      return { requiresOtp: gate.requiresOtp, reset: true };
    },

    restore: async (token: string): Promise<AuthSession | null> => {
      const session = this.db.sessions[token];
      if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
        return null;
      }
      const user = this.db.users.find(item => item.User_ID === session.userId);
      return user ? { token, user: this.toSessionUser(user) } : null;
    },

    logout: async (): Promise<void> => undefined,
  };

  kyc = {
    submitKyc: async (userId: string, _input: KycSubmissionInput, _pendingKycToken: string): Promise<AuthSession> => {
      const user = this.requireUser(userId);
      user.KYC_Status = 'Unverified';
      this.db.kycStates[userId] = { status: 'PendingReview', canSubmit: false, submittedAt: nowIso() };
      return this.createSession(user);
    },

    resubmitKyc: async (userId: string, _input: KycSubmissionInput): Promise<AuthSession> => {
      const user = this.requireUser(userId);
      user.KYC_Status = 'Unverified';
      this.db.kycStates[userId] = { status: 'PendingReview', canSubmit: false, submittedAt: nowIso() };
      return this.createSession(user);
    },

    listPendingReviews: async (): Promise<KycReviewItem[]> => {
      return this.db.users
        .filter(user => this.kycStateForUser(user.User_ID).status === 'PendingReview')
        .map(user => ({ user: clone(user), note: 'Uploaded and pending manual review.' }));
    },

    approve: async (userId: string): Promise<void> => {
      const user = this.requireUser(userId);
      user.KYC_Status = 'Verified';
      this.db.kycStates[userId] = { status: 'Verified', canSubmit: false, reviewedAt: nowIso() };
    },

    requestResubmission: async (userId: string): Promise<void> => {
      const user = this.requireUser(userId);
      user.KYC_Status = 'Unverified';
      this.db.kycStates[userId] = { status: 'NeedsResubmission', canSubmit: true, reviewedAt: nowIso(), decisionNote: 'Upload clearer KYC documents.' };
    },

    ban: async (userId: string): Promise<void> => {
      const user = this.requireUser(userId);
      user.KYC_Status = 'Banned';
      this.db.kycStates[userId] = { status: 'Banned', canSubmit: false, reviewedAt: nowIso(), decisionNote: 'Account banned by admin.' };
    },
  };

  groups = {
    listBrowseable: async (_userId: string): Promise<GroupRecord[]> => this.db.groups
      .filter(group => group.Status === 'Pending')
      .filter(group => this.db.groupRequests.some(request => request.approved_group_id === group.Group_ID && request.status === 'Approved' && !request.activated_at))
      .map(clone),

    getGroup: async (groupId: string): Promise<GroupRecord | null> => {
      const group = this.db.groups.find(item => item.Group_ID === groupId);
      return group ? clone(group) : null;
    },

    getGroupStatus: async (userId: string, groupId: string): Promise<GroupStatusSnapshot> => {
      const group = this.requireGroup(groupId);
      const round = this.currentOpenRound(groupId);
      const activeMembers = this.db.memberships.filter(item => item.Group_ID === groupId && item.Status === 'Active');
      const paid = round ? this.successfulContributions(round.Round_ID) : [];
      return {
        group: clone(group),
        currentRound: round ? clone(round) : null,
        paidCount: paid.length,
        totalMembers: activeMembers.length,
        winnerHistory: [],
        latestDraw: null,
        contributors: activeMembers.map(membership => {
          const user = this.requireUser(membership.User_ID);
          return {
            userId: user.User_ID,
            fullName: user.Full_Name,
            initials: this.initialsForName(user.Full_Name),
            joinedAt: membership.Joined_At,
            hasPaidCurrentRound: paid.some(item => item.User_ID === user.User_ID),
            isCurrentWinner: round?.Winner_ID === user.User_ID,
            cyclesWon: 0,
          };
        }),
        activeResolutionPoll: null,
        latestResolutionPoll: null,
        winnerExitWindow: null,
        refundTickets: [],
        canCurrentUserPay: !!round && group.Status === 'Active' && activeMembers.some(item => item.User_ID === userId) && !paid.some(item => item.User_ID === userId),
        isFrozen: group.Status === 'Frozen',
      };
    },

    createRequest: async (userId: string, input: CreateGroupInput): Promise<GroupRecord> => {
      this.assertVerifiedMember(userId);
      const group: GroupRecord = {
        Group_ID: makeId('group'),
        Creator_ID: userId,
        Group_Name: input.groupName,
        Amount: input.amount,
        Max_Members: input.maxMembers,
        Frequency: input.frequency,
        Virtual_Acc_Ref: '',
        Status: 'Pending',
        Start_Date: new Date().toISOString().slice(0, 10),
        Description: input.description,
      };
      this.db.groups.push(group);
      return clone(group);
    },

    listPendingApprovals: async (): Promise<GroupApprovalItem[]> => {
      return this.db.groups
        .filter(group => group.Status === 'Pending' || group.Status === 'Frozen')
        .map(group => ({
          group: clone(group),
          creator: clone(this.requireUser(group.Creator_ID)),
          note: group.Status === 'Frozen' ? 'Frozen group pending recovery decision.' : 'Pending admin review.',
        }));
    },

    approve: async (groupId: string): Promise<void> => {
      const group = this.requireGroup(groupId);
      group.Status = 'Active';
      group.Virtual_Acc_Ref = group.Virtual_Acc_Ref || `UEQ-${group.Group_ID.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      this.ensureOpenRound(groupId);
      this.ensureMembership(group.Group_ID, group.Creator_ID);
    },

    reject: async (groupId: string): Promise<void> => {
      this.db.groups = this.db.groups.filter(group => group.Group_ID !== groupId);
    },

    freeze: async (groupId: string): Promise<void> => {
      this.requireGroup(groupId).Status = 'Frozen';
    },

    resolveFreeze: async (groupId: string): Promise<void> => {
      this.requireGroup(groupId).Status = 'Active';
    },

    createResolutionPoll: async (): Promise<GroupStatusSnapshot['activeResolutionPoll']> => null,
    voteResolutionPoll: async (): Promise<void> => undefined,
    closeResolutionPoll: async (): Promise<void> => undefined,
    decideWinnerExit: async (): Promise<void> => undefined,

    joinGroup: async (userId: string, groupId: string): Promise<void> => {
      this.assertVerifiedMember(userId);
      const group = this.requireGroup(groupId);
      if (group.Status !== 'Active') {
        throw new Error('Only active groups can be joined.');
      }
      this.ensureMembership(groupId, userId);
      this.ensureOpenRound(groupId);
    },

    getDashboard: async (userId: string): Promise<DashboardSnapshot> => {
      const user = this.requireUser(userId);
      const activeMemberships = this.db.memberships.filter(item => item.User_ID === userId && item.Status === 'Active');
      const activeGroups = activeMemberships
        .map(membership => this.db.groups.find(group => group.Group_ID === membership.Group_ID))
        .filter((group): group is GroupRecord => !!group && group.Status !== 'Completed');
      const completedGroups = activeMemberships
        .map(membership => this.db.groups.find(group => group.Group_ID === membership.Group_ID))
        .filter((group): group is GroupRecord => !!group && group.Status === 'Completed');
      const currentGroup = activeGroups[0] ?? null;
      const currentRound = currentGroup ? this.currentOpenRound(currentGroup.Group_ID) : null;
      const paid = currentRound ? this.successfulContributions(currentRound.Round_ID) : [];
      const recentTransactions = this.db.transactions.filter(item => item.User_ID === userId).sort((a, b) => b.Date.localeCompare(a.Date));
      return {
        ...emptyDashboard(this.kycStateForUser(user.User_ID)),
        currentGroup: currentGroup ? clone(currentGroup) : null,
        activeGroups: activeGroups.map(clone),
        completedGroups: completedGroups.map(clone),
        currentRound: currentRound ? clone(currentRound) : null,
        paidCount: paid.length,
        totalMembers: currentGroup ? this.db.memberships.filter(item => item.Group_ID === currentGroup.Group_ID && item.Status === 'Active').length : 0,
        totalSaved: recentTransactions.filter(item => item.Type === 'Contribution' && item.Status === 'Successful').reduce((sum, item) => sum + item.Amount, 0),
        readyPayout: recentTransactions.filter(item => item.Type === 'Payout' && item.Status === 'Pending').reduce((sum, item) => sum + item.Amount, 0),
        recentTransactions: recentTransactions.slice(0, 5).map(clone),
      };
    },
  };

  formation = {
    listPublic: async (_userId: string): Promise<GroupFormationRequestSummary[]> => this.db.groupRequests.filter(item => item.visibility === 'Public' && item.status === 'Forming').map(clone),
    listMine: async (userId: string): Promise<GroupFormationRequestSummary[]> => this.db.groupRequests.filter(item => item.creator_id === userId).map(clone),
    listPendingApproval: async (): Promise<GroupFormationRequestSummary[]> => this.db.groupRequests.filter(item => item.status === 'PendingApproval' && item.visibility !== 'Private').map(clone),
    getRequest: async (_userId: string, requestId: string): Promise<GroupFormationDetail> => this.toFormationDetail(this.requireFormationRequest(requestId)),
    lookupInviteCode: async (_userId: string, inviteCode: string): Promise<GroupFormationDetail> => {
      const invitation = this.db.groupInvitations.find(item => item.invite_code === inviteCode.trim().toUpperCase() && item.status === 'Pending');
      if (!invitation) {
        throw new Error('Invite code was not found.');
      }
      return this.toFormationDetail(this.requireFormationRequest(invitation.group_request_id));
    },
    createRequest: async (userId: string, input: CreateGroupFormationInput): Promise<GroupFormationDetail> => {
      this.assertVerifiedMember(userId);
      const request: GroupFormationRequestSummary = {
        id: makeId('formation'),
        creator_id: userId,
        submitted_by: null,
        proposed_group_name: input.groupName,
        description: input.description ?? null,
        contribution_amount: input.amount,
        frequency: input.frequency,
        min_members: input.minMembers ?? Math.min(5, input.maxMembers),
        max_members: input.maxMembers,
        total_cycles: input.maxMembers,
        visibility: input.visibility,
        invite_mode: input.inviteMode ?? (input.visibility === 'Private' ? 'InviteCodeAndDirect' : 'PublicRequest'),
        status: 'Forming',
        risk_level: input.visibility === 'Private' ? 'Medium' : 'Low',
        terms_version: input.termsVersion ?? 'phase2-v1',
        agreement_required: true,
        vesting_enabled: input.vestingEnabled ?? true,
        vesting_disabled_by_creator: input.vestingEnabled === false,
        risk_warning_accepted_at: input.riskWarningAccepted ? nowIso() : null,
        expires_at: plusMinutes(60 * 24 * 7),
        submitted_at: null,
        reviewed_by: null,
        reviewed_at: null,
        approval_decision_note: null,
        rejection_reason: null,
        approved_group_id: null,
        created_group_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
        accepted_participant_count: 1,
        remaining_slots: Math.max(input.maxMembers - 1, 0),
      };
      this.db.groupRequests.push(request);
      this.db.groupJoinRequests.push(this.makeJoinRequest(request.id, userId, 'Accepted', userId, 'Creator automatically added.'));
      return this.toFormationDetail(request);
    },
    requestJoin: async (userId: string, requestId: string, _terms: FormationTermsAcceptance): Promise<GroupFormationDetail> => {
      this.assertVerifiedMember(userId);
      const request = this.requireFormationRequest(requestId);
      const existing = this.db.groupJoinRequests.find(item => item.group_request_id === requestId && item.user_id === userId);
      if (!existing) {
        this.db.groupJoinRequests.push(this.makeJoinRequest(requestId, userId, 'Requested', null, 'Accepted group terms.'));
      }
      return this.toFormationDetail(request);
    },
    acceptJoin: async (userId: string, joinRequestId: string, decisionReason?: string): Promise<GroupFormationDetail> => {
      const join = this.requireJoinRequest(joinRequestId);
      const request = this.requireFormationRequest(join.group_request_id);
      if (request.creator_id !== userId) {
        throw new Error('Only the creator can accept participants.');
      }
      join.status = 'Accepted';
      join.accepted_at = nowIso();
      join.decision_by = userId;
      join.decision_reason = decisionReason ?? 'Accepted by creator.';
      return this.toFormationDetail(request);
    },
    removeParticipant: async (userId: string, joinRequestId: string, decisionReason?: string): Promise<GroupFormationDetail> => {
      const join = this.requireJoinRequest(joinRequestId);
      const request = this.requireFormationRequest(join.group_request_id);
      if (request.creator_id !== userId) {
        throw new Error('Only the creator can remove participants.');
      }
      join.status = 'Removed';
      join.removed_at = nowIso();
      join.decision_by = userId;
      join.decision_reason = decisionReason ?? 'Removed by creator.';
      return this.toFormationDetail(request);
    },
    invite: async (userId: string, input: FormationInvitationInput): Promise<{ detail: GroupFormationDetail; invitation: GroupInvitationRecord }> => {
      const request = this.requireFormationRequest(input.requestId);
      if (request.creator_id !== userId) {
        throw new Error('Only the creator can invite participants.');
      }
      const invitation: GroupInvitationRecord = {
        id: makeId('invite'),
        group_request_id: request.id,
        invited_user_id: input.targetUserId ?? null,
        invited_phone_or_student_id: input.invitedPhoneOrStudentId ?? null,
        invite_code: input.inviteCode?.trim().toUpperCase() ?? `UNI-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'Pending',
        expires_at: plusMinutes(60 * 24 * 7),
        created_by: userId,
        accepted_at: null,
        declined_at: null,
        created_at: nowIso(),
      };
      this.db.groupInvitations.push(invitation);
      return { detail: this.toFormationDetail(request), invitation: clone(invitation) };
    },
    acceptInvite: async (userId: string, input: FormationTermsAcceptance & { invitationId?: string; inviteCode?: string }): Promise<GroupFormationDetail> => {
      const invitation = this.db.groupInvitations.find(item =>
        (input.invitationId && item.id === input.invitationId) || (input.inviteCode && item.invite_code === input.inviteCode.trim().toUpperCase()),
      );
      if (!invitation) {
        throw new Error('Invite was not found.');
      }
      const request = this.requireFormationRequest(invitation.group_request_id);
      const existing = this.db.groupJoinRequests.find(item => item.group_request_id === request.id && item.user_id === userId);
      if (!existing) {
        this.db.groupJoinRequests.push(this.makeJoinRequest(request.id, userId, 'Accepted', invitation.created_by, 'Invite accepted.'));
      }
      return this.toFormationDetail(request);
    },
    submitForApproval: async (userId: string, requestId: string): Promise<GroupFormationDetail> => {
      const request = this.requireFormationRequest(requestId);
      if (request.creator_id !== userId) {
        throw new Error('Only the creator can submit this forming group.');
      }
      const accepted = this.acceptedFormationCount(requestId);
      if (accepted < request.min_members) {
        throw new Error(`At least ${request.min_members} accepted participants are required before this group can start.`);
      }
      if (request.visibility === 'Private') {
        const group = this.activateFormationRequest(request, 'Private group started by creator.');
        request.status = 'Approved';
        request.approved_group_id = group.Group_ID;
      } else {
        request.status = 'PendingApproval';
        request.submitted_by = userId;
        request.submitted_at = nowIso();
      }
      return this.toFormationDetail(request);
    },
    adminApprove: async (requestId: string): Promise<GroupRecord> => this.activateFormationRequest(this.requireFormationRequest(requestId), 'Approved by admin.'),
    adminReject: async (requestId: string, decisionReason?: string): Promise<GroupFormationDetail> => {
      const request = this.requireFormationRequest(requestId);
      request.status = 'Rejected';
      request.rejection_reason = decisionReason ?? 'Rejected by admin.';
      request.reviewed_at = nowIso();
      return this.toFormationDetail(request);
    },
  };

  payments = {
    payContribution: async (userId: string, groupId: string, method: PaymentMethod): Promise<PaymentResult> => this.recordContribution(userId, groupId, method),
    startContributionUssd: async (userId: string, groupId: string): Promise<UssdSessionState> => {
      this.assertContributionReady(userId, groupId);
      const session: UssdSessionRecord = { sessionId: makeId('ussd'), userId, groupId, stage: 'AwaitMenu', expiresAt: plusMinutes(5) };
      this.db.ussdSessions[session.sessionId] = session;
      return this.toUssdSessionState(session);
    },
    submitContributionUssd: async (userId: string, sessionId: string, input: string): Promise<UssdSessionState> => {
      const session = this.db.ussdSessions[sessionId];
      if (!session || session.userId !== userId) {
        throw new Error('USSD session was not found.');
      }
      if (input === '0') {
        session.stage = 'Cancelled';
        return this.toUssdSessionState(session);
      }
      const order: UssdSessionState['stage'][] = ['AwaitMenu', 'AwaitReference', 'AwaitAmount', 'AwaitConfirm', 'AwaitPin'];
      const index = order.indexOf(session.stage);
      if (session.stage === 'AwaitPin') {
        session.paymentResult = await this.recordContribution(userId, session.groupId, 'MockUSSD');
        session.stage = 'Completed';
      } else if (index >= 0) {
        session.stage = order[index + 1];
      }
      return this.toUssdSessionState(session);
    },
    listTransactions: async (userId: string): Promise<TransactionRecord[]> => this.db.transactions.filter(item => item.User_ID === userId).sort((a, b) => b.Date.localeCompare(a.Date)).map(clone),
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
    },
  };

  notifications = {
    listForUser: async (userId: string): Promise<AppNotification[]> => clone((this.db.notifications[userId] ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    markAllRead: async (userId: string): Promise<void> => {
      (this.db.notifications[userId] ?? []).forEach(item => {
        item.unread = false;
      });
    },
    sendReminderBatch: async (): Promise<ReminderBatchResult> => ({ queue: [], sentAt: nowIso() }),
  };

  reports = {
    getAdminOverview: async (): Promise<AdminOverview> => ({
      pendingKycCount: this.db.users.filter(user => this.kycStateForUser(user.User_ID).status === 'PendingReview').length,
      pendingGroupCount: this.db.groups.filter(group => group.Status === 'Pending' || group.Status === 'Frozen').length + this.db.groupRequests.filter(request => request.status === 'PendingApproval').length,
      activeGroupCount: this.db.groups.filter(group => group.Status === 'Active').length,
      exportsCount: 0,
      logs: clone(this.db.auditLogs),
      reminderQueue: [],
      providerLogs: [],
      auditTimeline: [],
      reliabilitySummary: {},
    }),
    listReports: async (): Promise<ReportSummary[]> => [],
    exportReport: async (title: string, format: 'PDF' | 'CSV'): Promise<ExportedReport> => ({
      fileName: `${title.toLowerCase().replace(/\s+/g, '-')}.${format.toLowerCase()}`,
      format,
      content: '',
    }),
  };

  profile = {
    getProfile: async (userId: string): Promise<UserProfile> => this.ensureProfile(userId),
    updateProfile: async (userId: string, input: Partial<UserProfile>): Promise<UserProfile> => {
      const current = this.ensureProfile(userId);
      const user = this.requireUser(userId);
      if (input.email !== undefined) {
        user.Email = input.email;
        user.Email_Verified_At = null;
      }
      if (typeof input.phoneNumber === 'string') {
        user.Phone_Number = this.normalizePhone(input.phoneNumber);
      }
      const updated: UserProfile = {
        ...current,
        email: input.email ?? user.Email ?? current.email,
        emailVerifiedAt: user.Email_Verified_At ?? null,
        phoneNumber: user.Phone_Number,
        university: input.university ?? current.university,
        academicYear: input.academicYear ?? current.academicYear,
        language: input.language ?? current.language,
        theme: input.theme ?? current.theme,
        notificationPreference: input.notificationPreference ?? current.notificationPreference,
        walletLabel: input.walletLabel ?? current.walletLabel,
        avatar: input.avatar ?? current.avatar,
        profileImageUrl: input.profileImageUrl ?? current.profileImageUrl,
        profileImagePath: input.profileImagePath ?? current.profileImagePath,
        updatedAt: nowIso(),
      };
      this.db.profiles[userId] = updated;
      return clone(updated);
    },
    uploadProfileImage: async (userId: string, input: { fileName: string; contentType: string; base64: string }): Promise<UserProfile> => {
      const current = this.ensureProfile(userId);
      const updated: UserProfile = {
        ...current,
        profileImagePath: `mock-profile-images/${userId}/${input.fileName}`,
        profileImageUrl: `data:${input.contentType};base64,${input.base64}`,
        updatedAt: nowIso(),
      };
      this.db.profiles[userId] = updated;
      return clone(updated);
    },
    removeProfileImage: async (userId: string): Promise<UserProfile> => {
      const current = this.ensureProfile(userId);
      const updated: UserProfile = {
        ...current,
        profileImagePath: null,
        profileImageUrl: null,
        updatedAt: nowIso(),
      };
      this.db.profiles[userId] = updated;
      return clone(updated);
    },
    ensureAvatarSeed: async (userId: string) => this.ensureProfile(userId).avatar,
  };

  accounts = {
    listSlots: async (): Promise<AccountSlot[]> => clone(this.db.accountSlots),
    saveCurrent: async (session: AuthSession): Promise<AccountSlot> => {
      const slot: AccountSlot = {
        userId: session.user.userId,
        displayName: session.user.fullName,
        role: session.user.role,
        phoneNumber: session.user.phoneNumber,
        avatarSeed: session.user.userId,
        lastActiveAt: nowIso(),
        tokenState: 'Available',
      };
      this.db.accountSlots = [slot, ...this.db.accountSlots.filter(item => item.userId !== slot.userId)];
      return clone(slot);
    },
    switchTo: async (userId: string) => ({
      token: Object.entries(this.db.sessions).find(([, value]) => value.userId === userId)?.[0] ?? null,
      slot: clone(this.db.accountSlots.find(item => item.userId === userId) ?? null),
    }),
    removeSlot: async (userId: string): Promise<void> => {
      this.db.accountSlots = this.db.accountSlots.filter(item => item.userId !== userId);
    },
  };

  announcements = {
    listForGroup: async (input: { groupId?: string | null; groupRequestId?: string | null }): Promise<GroupAnnouncement[]> =>
      this.db.announcements
        .filter(item => !item.archivedAt)
        .filter(item => input.groupId ? item.groupId === input.groupId : true)
        .filter(item => input.groupRequestId ? item.groupRequestId === input.groupRequestId : true)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
        .map(clone),
    create: async (input: { groupId?: string | null; groupRequestId?: string | null; title: string; body: string; priority?: GroupAnnouncement['priority']; pinned?: boolean }): Promise<GroupAnnouncement> => {
      const announcement: GroupAnnouncement = {
        id: makeId('announcement'),
        groupId: input.groupId ?? null,
        groupRequestId: input.groupRequestId ?? null,
        createdBy: 'mock-admin',
        title: input.title,
        body: input.body,
        priority: input.priority ?? 'Normal',
        pinned: input.pinned ?? false,
        scope: input.groupRequestId ? 'FormingGroup' : 'ApprovedGroup',
        archivedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      this.db.announcements.unshift(announcement);
      return clone(announcement);
    },
    update: async (id: string, input: Partial<{ title: string; body: string; priority: GroupAnnouncement['priority']; pinned: boolean }>): Promise<GroupAnnouncement> => {
      const announcement = this.db.announcements.find(item => item.id === id);
      if (!announcement) {
        throw new Error('Announcement was not found.');
      }
      Object.assign(announcement, input, { updatedAt: nowIso() });
      return clone(announcement);
    },
    archive: async (id: string): Promise<void> => {
      const announcement = this.db.announcements.find(item => item.id === id);
      if (announcement) {
        announcement.archivedAt = nowIso();
        announcement.updatedAt = nowIso();
      }
    },
  };

  simulation = {
    getSnapshot: async (): Promise<SimulationSnapshot> => this.simulationSnapshot(),
    runCommand: async (command: SimulationCommand): Promise<SimulationCommandResult> => {
      this.db.simulationEvents.unshift({
        id: command.id,
        commandType: command.type,
        actorUserId: null,
        entityType: typeof command.payload.entityType === 'string' ? command.payload.entityType : null,
        entityId: typeof command.payload.entityId === 'string' ? command.payload.entityId : null,
        createdAt: nowIso(),
        metadata: command.payload,
      });
      return { ok: true, commandId: command.id, message: 'Mock simulation command recorded.', snapshot: this.simulationSnapshot() };
    },
  };

  private createSession(user: UserRecord): AuthSession {
    const token = makeId('session');
    this.db.sessions[token] = { userId: user.User_ID, expiresAt: plusMinutes(60 * 24 * 7) };
    return { token, user: this.toSessionUser(user) };
  }

  private ensureProfile(userId: string): UserProfile {
    const user = this.requireUser(userId);
    const existing = this.db.profiles[userId];
    if (existing) {
      return clone({
        ...existing,
        email: user.Email ?? existing.email ?? null,
        emailVerifiedAt: user.Email_Verified_At ?? existing.emailVerifiedAt ?? null,
        phoneNumber: user.Phone_Number,
      });
    }
    const created: UserProfile = {
      userId,
      email: user.Email ?? null,
      emailVerifiedAt: user.Email_Verified_At ?? null,
      phoneNumber: user.Phone_Number,
      university: null,
      academicYear: null,
      language: 'English',
      theme: 'Light',
      notificationPreference: 'PushAndSms',
      walletLabel: null,
      profileImageUrl: null,
      profileImagePath: null,
      avatar: {
        seed: userId,
        style: 'Geometric',
        palette: 'blue',
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.db.profiles[userId] = created;
    return clone(created);
  }

  private simulationSnapshot(): SimulationSnapshot {
    return {
      generatedAt: nowIso(),
      groups: this.db.groups.map(clone),
      rounds: this.db.rounds.map(clone),
      memberships: this.db.memberships.map(clone),
      transactions: this.db.transactions.map(clone),
      events: this.db.simulationEvents.map(clone),
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
      email: user.Email ?? null,
      emailVerifiedAt: user.Email_Verified_At ?? null,
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

  private currentOpenRound(groupId: string) {
    return this.db.rounds.find(item => item.Group_ID === groupId && item.Status === 'Open') ?? null;
  }

  private ensureOpenRound(groupId: string): RoundRecord {
    const existing = this.currentOpenRound(groupId);
    if (existing) {
      return existing;
    }
    const next: RoundRecord = {
      Round_ID: makeId('round'),
      Group_ID: groupId,
      Round_Number: 1,
      Winner_ID: null,
      Draw_Date: null,
      Status: 'Open',
    };
    this.db.rounds.push(next);
    return next;
  }

  private ensureMembership(groupId: string, userId: string) {
    if (!this.db.memberships.some(item => item.Group_ID === groupId && item.User_ID === userId && item.Status === 'Active')) {
      this.db.memberships.push({
        Membership_ID: makeId('membership'),
        Group_ID: groupId,
        User_ID: userId,
        Joined_At: nowIso(),
        Status: 'Active',
      });
    }
  }

  private successfulContributions(roundId: string) {
    return this.db.transactions.filter(item => item.Round_ID === roundId && item.Type === 'Contribution' && item.Status === 'Successful');
  }

  private assertVerifiedMember(userId: string) {
    const user = this.requireUser(userId);
    if (user.Role !== 'Member') {
      throw new Error('This action is only available to members.');
    }
    if (user.KYC_Status !== 'Verified') {
      throw new Error('KYC verification is required for this action.');
    }
  }

  private kycStateForUser(userId: string): MemberKycState {
    const user = this.requireUser(userId);
    const explicit = this.db.kycStates[userId];
    if (explicit) {
      return explicit;
    }
    if (user.KYC_Status === 'Verified') {
      return { status: 'Verified', canSubmit: false };
    }
    if (user.KYC_Status === 'Banned') {
      return { status: 'Banned', canSubmit: false };
    }
    return { status: user.Student_ID_Img ? 'PendingReview' : 'NotSubmitted', canSubmit: !user.Student_ID_Img };
  }

  private requireFormationRequest(requestId: string): GroupFormationRequestSummary {
    const request = this.db.groupRequests.find(item => item.id === requestId);
    if (!request) {
      throw new Error('Group formation request was not found.');
    }
    return request;
  }

  private requireJoinRequest(joinRequestId: string): GroupJoinRequestRecord {
    const request = this.db.groupJoinRequests.find(item => item.id === joinRequestId);
    if (!request) {
      throw new Error('Group formation participant request was not found.');
    }
    return request;
  }

  private makeJoinRequest(groupRequestId: string, userId: string, status: GroupJoinRequestRecord['status'], decisionBy: string | null, decisionReason: string): GroupJoinRequestRecord {
    const now = nowIso();
    return {
      id: makeId('join'),
      group_request_id: groupRequestId,
      user_id: userId,
      status,
      requested_at: now,
      accepted_at: status === 'Accepted' ? now : null,
      rejected_at: null,
      removed_at: null,
      decision_by: decisionBy,
      decision_reason: decisionReason,
    };
  }

  private acceptedFormationCount(requestId: string) {
    return this.db.groupJoinRequests.filter(item => item.group_request_id === requestId && item.status === 'Accepted').length;
  }

  private enrichJoinRequest(joinRequest: GroupJoinRequestRecord): GroupJoinRequestRecord {
    const user = this.db.users.find(item => item.User_ID === joinRequest.user_id);
    const profile = this.db.profiles[joinRequest.user_id];
    return {
      ...clone(joinRequest),
      participantProfile: user ? {
        userId: user.User_ID,
        fullName: user.Full_Name,
        phoneNumber: user.Phone_Number,
        kycStatus: user.KYC_Status,
        university: profile?.university ?? null,
        academicYear: profile?.academicYear ?? null,
        avatarSeed: profile?.avatar.seed ?? null,
        avatarStyle: profile?.avatar.style ?? null,
        avatarPalette: profile?.avatar.palette ?? null,
        reliability: null,
      } : null,
    };
  }

  private toFormationDetail(request: GroupFormationRequestSummary): GroupFormationDetail {
    const accepted = this.acceptedFormationCount(request.id);
    return {
      groupRequest: clone({
        ...request,
        accepted_participant_count: accepted,
        remaining_slots: Math.max(request.max_members - accepted, 0),
      }),
      joinRequests: this.db.groupJoinRequests.filter(item => item.group_request_id === request.id).map(item => this.enrichJoinRequest(item)),
      invitations: this.db.groupInvitations.filter(item => item.group_request_id === request.id).map(clone),
      accepted_participant_count: accepted,
      remaining_slots: Math.max(request.max_members - accepted, 0),
    };
  }

  private activateFormationRequest(request: GroupFormationRequestSummary, decisionReason: string): GroupRecord {
    request.status = 'Approved';
    request.reviewed_at = nowIso();
    request.approval_decision_note = decisionReason;
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
    this.db.groups.push(group);
    this.db.groupJoinRequests
      .filter(join => join.group_request_id === request.id && join.status === 'Accepted')
      .forEach(join => this.ensureMembership(group.Group_ID, join.user_id));
    this.ensureOpenRound(group.Group_ID);
    return clone(group);
  }

  private assertContributionReady(userId: string, groupId: string) {
    this.assertVerifiedMember(userId);
    const group = this.requireGroup(groupId);
    const round = this.ensureOpenRound(groupId);
    if (group.Status !== 'Active') {
      throw new Error('Only active groups can accept contributions.');
    }
    if (!this.db.memberships.some(item => item.Group_ID === groupId && item.User_ID === userId && item.Status === 'Active')) {
      throw new Error('You must join the group before paying contributions.');
    }
    if (this.successfulContributions(round.Round_ID).some(item => item.User_ID === userId)) {
      throw new Error('You have already paid for this round.');
    }
    return { group, round };
  }

  private recordContribution(userId: string, groupId: string, method: PaymentMethod): PaymentResult {
    const { group, round } = this.assertContributionReady(userId, groupId);
    const transaction: TransactionRecord = {
      Trans_ID: makeId('txn'),
      User_ID: userId,
      Round_ID: round.Round_ID,
      Amount: group.Amount,
      Type: 'Contribution',
      Payment_Method: method,
      Gateway_Ref: `GW-${Math.floor(100000 + Math.random() * 900000)}`,
      Status: 'Successful',
      Date: nowIso(),
    };
    this.db.transactions.push(transaction);
    this.pushNotification(userId, 'Contribution received', `Your ${method} payment for ${group.Group_Name} was reconciled.`, {
      actionRoute: 'member/group',
      relatedEntityType: 'EqubGroup',
      relatedEntityId: group.Group_ID,
      severity: 'Success',
    });
    return {
      receiptRef: transaction.Gateway_Ref,
      amount: group.Amount,
      method,
      autoDrawTriggered: false,
      payoutAmount: 0,
    };
  }

  private toUssdSessionState(session: UssdSessionRecord): UssdSessionState {
    return {
      sessionId: session.sessionId,
      shortCode: '*127#',
      providerLabel: 'Telebirr',
      stage: session.stage,
      prompt: session.stage === 'Completed' ? 'Payment successful.' : 'Telebirr testing session.',
      inputLabel: session.stage === 'AwaitPin' ? 'PIN' : 'Reply',
      expiresAt: session.expiresAt,
      allowCancel: !['Completed', 'Cancelled', 'Expired'].includes(session.stage),
      expectsMaskedInput: session.stage === 'AwaitPin',
      paymentResult: session.paymentResult,
    };
  }

  private readyPayout(userId: string) {
    return this.db.transactions.filter(item => item.User_ID === userId && item.Type === 'Payout' && item.Status === 'Pending').reduce((sum, item) => sum + item.Amount, 0);
  }

  private pushNotification(userId: string, title: string, body: string, route?: Pick<AppNotification, 'actionRoute' | 'relatedEntityType' | 'relatedEntityId' | 'severity'>) {
    const target = this.db.notifications[userId] ?? [];
    target.unshift({ id: makeId('notification'), title, body, createdAt: nowIso(), unread: true, ...route });
    this.db.notifications[userId] = target;
  }

  private initialsForName(name: string) {
    return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'UE';
  }
}

export const mockBackend = new MockBackend();
