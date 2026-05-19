export interface FunctionEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  errorId?: string;
  status?: number;
}

export type RegisterLoginAction = 'register' | 'requestOtp' | 'verifyOtp' | 'beginLogin' | 'completeLogin' | 'login' | 'restore';
export type GroupLifecycleAction = 'listBrowseable' | 'getGroup' | 'getGroupStatus' | 'createRequest' | 'listPending' | 'approve' | 'reject' | 'freeze' | 'resolveFreeze' | 'createResolutionPoll' | 'voteResolutionPoll' | 'closeResolutionPoll' | 'join' | 'getDashboard';
export type GroupFormationAction = 'listPublic' | 'listMine' | 'listPendingApproval' | 'getRequest' | 'lookupInviteCode' | 'createRequest' | 'requestJoin' | 'acceptJoin' | 'removeParticipant' | 'invite' | 'acceptInvite' | 'submitForApproval' | 'adminApprove' | 'adminReject';
export type ContributionAction = 'payContribution' | 'startContributionUssd' | 'submitContributionUssd' | 'listTransactions' | 'getWallet' | 'reconcileProviderCallback';
export type PaymentAttemptAction = 'initiateContributionAttempt' | 'recordProviderCallback' | 'markAttemptTimeout' | 'markAttemptCancelled';
export type PaymentAttemptOutcome = 'success' | 'failure' | 'timeout' | 'cancelled' | 'wrong_amount' | 'pending';
export type PayoutAction = 'createPayoutRequest' | 'processImmediateRelease' | 'releaseReservedPayout' | 'freezePayoutRequest' | 'cancelPayoutRequest';
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
  frequency: 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly';
  maxMembers: number;
  description: string;
}

export interface GroupLifecyclePayload {
  action: GroupLifecycleAction;
  token: string;
  groupId?: string;
  createRequest?: CreateGroupRequest;
  resolutionAction?: 'ContinueWithReserveFrozen' | 'KeepFrozenForReview' | 'CreateRefundTickets';
  resolutionNote?: string;
  pollId?: string;
  optionId?: string;
}

export interface CreateGroupFormationRequest {
  groupName: string;
  description?: string;
  amount: number;
  frequency: 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly';
  minMembers?: number;
  maxMembers: number;
  visibility: 'Public' | 'Private';
  inviteMode?: 'PublicRequest' | 'InviteCode' | 'DirectInvite' | 'InviteCodeAndDirect';
  vestingEnabled?: boolean;
  riskWarningAccepted?: boolean;
  termsVersion?: string;
}

export interface GroupFormationPayload {
  action: GroupFormationAction;
  token: string;
  requestId?: string;
  joinRequestId?: string;
  invitationId?: string;
  inviteCode?: string;
  targetUserId?: string;
  invitedPhoneOrStudentId?: string;
  decisionReason?: string;
  acceptedTermsVersion?: string;
  groupTermsAccepted?: boolean;
  createRequest?: CreateGroupFormationRequest;
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

export interface PaymentAttemptPayload {
  action: PaymentAttemptAction;
  token: string;
  groupId?: string;
  roundId?: string;
  obligationId?: string;
  attemptId?: string;
  idempotencyKey?: string;
  gatewayReference?: string;
  providerName?: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
  providerMode?: 'Mock' | 'Sandbox';
  amount?: number;
  senderPhone?: string;
  outcome?: PaymentAttemptOutcome;
  callbackPayload?: Record<string, unknown>;
  failureCode?: string;
  failureMessage?: string;
}

export interface PayoutPayload {
  action: PayoutAction;
  token: string;
  payoutRequestId?: string;
  groupId?: string;
  roundId?: string;
  winnerUserId?: string;
  totalPayoutAmount?: number;
  immediateReleaseAmount?: number;
  reservedAmount?: number;
  triggerObligationId?: string;
  decisionReason?: string;
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

type EdgeErrorContext = Record<string, unknown>;

function errorText(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}

function errorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return undefined;
}

function errorDetails(error: unknown) {
  if (typeof error !== 'object' || !error) {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    details: typeof record.details === 'string' ? record.details : undefined,
    hint: typeof record.hint === 'string' ? record.hint : undefined,
    name: typeof record.name === 'string' ? record.name : undefined,
    stack: typeof record.stack === 'string' ? record.stack : undefined,
  };
}

export function fail(message: string, status = 400, context?: EdgeErrorContext): Response {
  const errorId = crypto.randomUUID();
  const payload = {
    ok: false,
    error: message,
    errorId,
    status,
    ...(context?.errorCode && typeof context.errorCode === 'string' ? { errorCode: context.errorCode } : {}),
  };
  const logPayload = {
    level: status >= 500 ? 'error' : 'warn',
    errorId,
    status,
    message,
    ...context,
  };
  const logLine = `[uniequb-edge-error] ${JSON.stringify(logPayload)}`;
  if (status >= 500) {
    console.error(logLine);
  } else {
    console.warn(logLine);
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
      'X-UniEqub-Error-Id': errorId,
      'X-UniEqub-Error': message.slice(0, 220),
    },
  });
}

export function failFromError(error: unknown, fallback: string, status = 500, context?: EdgeErrorContext): Response {
  return fail(errorText(error, fallback), status, {
    ...context,
    errorCode: errorCode(error),
    error: errorDetails(error),
  });
}
