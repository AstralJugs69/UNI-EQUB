export type UserRole = 'Member' | 'Admin';
export type KycStatus = 'Unverified' | 'Verified' | 'Banned';
export type GroupStatus = 'Pending' | 'Active' | 'Rejected' | 'Frozen' | 'Completed';
export type RoundStatus = 'Open' | 'Locked' | 'Completed';
export type TransactionStatus = 'Pending' | 'Successful' | 'Failed';
export type TransactionType = 'Contribution' | 'Payout';
export type PaymentMethod = 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
export type UssdSessionStage = 'AwaitMenu' | 'AwaitReference' | 'AwaitAmount' | 'AwaitConfirm' | 'AwaitPin' | 'Completed' | 'Cancelled' | 'Expired';

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
  Frequency: 'Weekly' | 'Bi-weekly' | 'Monthly';
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
  currentRound: RoundRecord | null;
  paidCount: number;
  totalMembers: number;
  totalSaved: number;
  readyPayout: number;
  recentTransactions: TransactionRecord[];
}

export interface WalletSnapshot {
  balance: number;
  readyPayout: number;
  defaultDestination: string;
}

export interface GroupStatusSnapshot {
  group: GroupRecord;
  currentRound: RoundRecord | null;
  paidCount: number;
  totalMembers: number;
  winnerHistory: Array<{ roundNumber: number; winnerName: string }>;
  canCurrentUserPay: boolean;
  isFrozen: boolean;
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
}

export interface KycReviewItem {
  user: UserRecord;
  note: string;
}

export interface GroupApprovalItem {
  group: GroupRecord;
  creator: UserRecord;
  note: string;
}
