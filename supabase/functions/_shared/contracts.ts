export interface FunctionEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type RegisterLoginAction = 'register' | 'requestOtp' | 'verifyOtp' | 'beginLogin' | 'completeLogin' | 'login' | 'restore';
export type GroupLifecycleAction = 'listBrowseable' | 'getGroup' | 'getGroupStatus' | 'createRequest' | 'listPending' | 'approve' | 'reject' | 'freeze' | 'join' | 'getDashboard';
export type ContributionAction = 'payContribution' | 'startContributionUssd' | 'submitContributionUssd' | 'listTransactions' | 'getWallet' | 'reconcileProviderCallback';
export type ReportAction = 'getAdminOverview' | 'listReports' | 'exportReport';

export interface LoginRequest {
  phoneNumber: string;
  password: string;
  roleHint?: 'Member' | 'Admin';
}

export interface RegisterRequest {
  fullName: string;
  phoneNumber: string;
  password: string;
  studentIdImage: string;
}

export interface RestoreRequest {
  token: string;
}

export interface OtpRequest {
  phoneNumber: string;
}

export interface OtpVerifyRequest {
  phoneNumber: string;
  otp: string;
}

export interface BeginLoginRequest {
  phoneNumber: string;
  password: string;
  roleHint?: 'Member' | 'Admin';
}

export interface CompleteLoginRequest {
  challengeToken: string;
  otp: string;
}

export interface RegisterLoginPayload {
  action: RegisterLoginAction;
  register?: RegisterRequest;
  login?: LoginRequest;
  requestOtp?: OtpRequest;
  verifyOtp?: OtpVerifyRequest;
  beginLogin?: BeginLoginRequest;
  completeLogin?: CompleteLoginRequest;
  restore?: RestoreRequest;
}

export interface CreateGroupRequest {
  groupName: string;
  amount: number;
  frequency: 'Weekly' | 'Bi-weekly' | 'Monthly';
  maxMembers: number;
  description: string;
}

export interface GroupLifecyclePayload {
  action: GroupLifecycleAction;
  token: string;
  groupId?: string;
  createRequest?: CreateGroupRequest;
}

export interface ContributionPayload {
  action: ContributionAction;
  token: string;
  groupId?: string;
  method?: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
  sessionId?: string;
  input?: string;
  senderPhone?: string;
  gatewayRef?: string;
  amount?: number;
}

export interface PayoutWithdrawPayload {
  action: 'withdraw';
  token: string;
}

export interface ReportExportPayload {
  action: ReportAction;
  token: string;
  title?: string;
  format?: 'PDF' | 'CSV';
}

export function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function fail(message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
