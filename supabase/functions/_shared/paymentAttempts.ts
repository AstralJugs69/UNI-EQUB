import { supabaseAdmin } from './supabaseAdmin.ts';
import type { PaymentProviderAttemptRecord, PaymentProviderAttemptStatus } from './types.ts';

export interface CreatePaymentAttemptInput {
  providerName: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox' | string;
  providerMode?: 'Mock' | 'Sandbox';
  eventType?: 'ContributionPayment' | 'PayoutProcessing' | 'RefundTicket';
  userId: string;
  groupId?: string;
  roundId?: string;
  contributionObligationId?: string;
  payoutRequestId?: string;
  amount?: number;
  currency?: string;
  normalizedPhone?: string;
  gatewayReference?: string;
  idempotencyKey: string;
  requestPayload?: Record<string, unknown>;
  initialStatus?: 'Initiated' | 'Pending';
}

export interface RecordAttemptCallbackInput {
  attemptId?: string;
  idempotencyKey?: string;
  gatewayReference?: string;
  status: PaymentProviderAttemptStatus;
  callbackPayload?: Record<string, unknown>;
  verificationResult?: string;
  failureCode?: string;
  failureMessage?: string;
}

export function buildPaymentAttemptIdempotencyKey(parts: Array<string | number | null | undefined>) {
  return parts
    .filter(part => part !== null && part !== undefined && String(part).trim().length > 0)
    .map(part => String(part).trim())
    .join(':');
}

export async function findPaymentAttemptByIdempotencyKey(idempotencyKey: string) {
  const { data, error } = await supabaseAdmin
    .from('payment_provider_attempts')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as PaymentProviderAttemptRecord | null;
}

export async function ensurePaymentProviderAttempt(input: CreatePaymentAttemptInput) {
  const existing = await findPaymentAttemptByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { attempt: existing, created: false };
  }

  const { data, error } = await supabaseAdmin
    .from('payment_provider_attempts')
    .insert({
      provider_name: input.providerName,
      provider_mode: input.providerMode ?? 'Mock',
      event_type: input.eventType ?? 'ContributionPayment',
      user_id: input.userId,
      group_id: input.groupId ?? null,
      round_id: input.roundId ?? null,
      contribution_obligation_id: input.contributionObligationId ?? null,
      payout_request_id: input.payoutRequestId ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? 'ETB',
      normalized_phone: input.normalizedPhone ?? null,
      gateway_reference: input.gatewayReference ?? null,
      idempotency_key: input.idempotencyKey,
      request_payload: input.requestPayload ?? {},
      status: input.initialStatus ?? 'Initiated',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return { attempt: data as PaymentProviderAttemptRecord, created: true };
}

export async function recordPaymentAttemptCallback(input: RecordAttemptCallbackInput) {
  let query = supabaseAdmin.from('payment_provider_attempts').select('*');
  if (input.attemptId) {
    query = query.eq('id', input.attemptId);
  } else if (input.idempotencyKey) {
    query = query.eq('idempotency_key', input.idempotencyKey);
  } else if (input.gatewayReference) {
    query = query.eq('gateway_reference', input.gatewayReference);
  } else {
    throw new Error('A payment attempt identifier is required.');
  }

  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError) {
    throw findError;
  }
  if (!existing) {
    throw new Error('Payment provider attempt was not found.');
  }

  const { data, error } = await supabaseAdmin
    .from('payment_provider_attempts')
    .update({
      status: input.status,
      callback_payload: input.callbackPayload ?? {},
      callback_received_at: new Date().toISOString(),
      verification_result: input.verificationResult ?? null,
      verified_at: input.verificationResult ? new Date().toISOString() : null,
      verified_by_system: Boolean(input.verificationResult),
      failure_code: input.failureCode ?? null,
      failure_message: input.failureMessage ?? null,
    })
    .eq('id', (existing as PaymentProviderAttemptRecord).id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as PaymentProviderAttemptRecord;
}

export function isSuccessfulAttemptStatus(status: PaymentProviderAttemptStatus) {
  return status === 'Successful';
}
