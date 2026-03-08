import { seedGroups, seedMemberships, seedNotifications, seedRounds, seedTransactions, seedUsers } from '../../data/seed';
import type {
  AdminOverview,
  AppNotification,
  AuthSession,
  DashboardSnapshot,
  ExportedReport,
  GroupApprovalItem,
  GroupRecord,
  GroupStatusSnapshot,
  KycReviewItem,
  MembershipRecord,
  PaymentMethod,
  PaymentResult,
  ReminderBatchResult,
  ReportSummary,
  RoundRecord,
  SessionUser,
  TransactionRecord,
  UssdSessionState,
  UserRecord,
  WalletSnapshot,
} from '../../types/domain';
import type { AppServices, CreateGroupInput, KycSubmissionInput, LoginInput, RegisterInput } from '../contracts';

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
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const hashPassword = (password: string) => `hash:${password}`;
const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();
const plusMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export class MockBackend implements AppServices {
  private db: DatabaseState;

  constructor() {
    this.db = {
      users: clone(seedUsers),
      groups: clone(seedGroups),
      memberships: clone(seedMemberships),
      rounds: clone(seedRounds),
      transactions: clone(seedTransactions),
      notifications: clone(seedNotifications),
      sessions: {},
      otpChallenges: {},
      ussdSessions: {},
      auditLogs: ['KYC approved for Dawit Abebe • 09:15 AM', 'Cycle frozen for suspicious mismatch • 08:47 AM'],
      reminderQueue: ['Dorm A Savings Group • 1 unpaid member • automatic reminder queued', 'AAU Coders Circle • 2 unpaid members • automatic reminder queued'],
      providerLogs: [],
    };
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

    verifyOtp: async (phoneNumber: string, otp: string): Promise<void> => {
      const normalized = this.normalizePhone(phoneNumber);
      const challenge = Object.values(this.db.otpChallenges).find(item => item.phoneNumber === normalized);
      if (!challenge) {
        throw new Error('No OTP challenge is active for this number.');
      }
      if (challenge.expiresAt < nowIso()) {
        throw new Error('OTP challenge expired.');
      }
      if (challenge.otp !== otp.trim()) {
        throw new Error('Invalid OTP code.');
      }
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
      const challengeToken = `login-challenge-${user.User_ID}-${Date.now()}`;
      this.db.sessions[challengeToken] = { userId: user.User_ID, expiresAt: plusMinutes(10) };
      await this.auth.requestOtp(user.Phone_Number);
      return { challengeToken, phoneNumber: user.Phone_Number };
    },

    completeLogin: async (challengeToken: string, otp: string): Promise<AuthSession> => {
      const challenge = this.db.sessions[challengeToken];
      if (!challenge || challenge.expiresAt < nowIso()) {
        throw new Error('Login challenge expired. Start login again.');
      }
      const user = this.requireUser(challenge.userId);
      await this.auth.verifyOtp(user.Phone_Number, otp);
      delete this.db.sessions[challengeToken];
      const token = `session-${user.User_ID}-${Date.now()}`;
      this.db.sessions[token] = { userId: user.User_ID, expiresAt: plusMinutes(60 * 24 * 7) };
      return { token, user: this.toSessionUser(user) };
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
    submitKyc: async (userId: string, input: KycSubmissionInput): Promise<void> => {
      const user = this.requireUser(userId);
      user.Student_ID_Img = `storage://student-ids/${userId}/manifest-${input.documents.length}.json`;
      user.KYC_Status = 'Unverified';
      this.pushNotification(userId, 'KYC submitted', 'Your student ID is waiting for admin review.');
      this.db.auditLogs.unshift(`KYC submitted for ${user.Full_Name}`);
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
        .filter(group => group.Status === 'Pending')
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
      group.Status = 'Rejected';
      this.db.auditLogs.unshift(`Group rejected: ${group.Group_Name}`);
      this.pushNotification(group.Creator_ID, 'Group rejected', 'Your Equb request was rejected during admin review.');
    },

    freeze: async (groupId: string): Promise<void> => {
      const group = this.requireGroup(groupId);
      group.Status = 'Frozen';
      this.db.auditLogs.unshift(`Group frozen for compliance: ${group.Group_Name}`);
      this.pushNotification(group.Creator_ID, 'Group frozen', 'Admin compliance review temporarily paused this group.');
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
      };
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
      pendingGroupCount: this.db.groups.filter(group => group.Status === 'Pending').length,
      activeGroupCount: this.db.groups.filter(group => group.Status === 'Active').length,
      exportsCount: 11,
      logs: clone(this.db.auditLogs),
      reminderQueue: clone(this.db.reminderQueue),
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
