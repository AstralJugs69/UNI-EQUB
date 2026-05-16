import { fail, json } from '../_shared/contracts.ts';
import type { PaymentAttemptOutcome, PaymentAttemptPayload } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { getContributionObligationForUserRound, markContributionObligationPendingPayment, markContributionObligationUnpaid } from '../_shared/obligations.ts';
import { buildPaymentAttemptIdempotencyKey, ensurePaymentProviderAttempt, recordPaymentAttemptCallback } from '../_shared/paymentAttempts.ts';
import { initiateSimulatedProvider } from '../_shared/paymentProviders.ts';
import { ensureOpenRoundForGroup } from '../_shared/rounds.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { ContributionObligationRecord, GroupRecord, MembershipRecord, PaymentProviderAttemptRecord, PaymentProviderAttemptStatus, UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function requireActor(token: string) {
  const payload = await verifySession(token);
  const userId = payload.sub;
  if (!userId) {
    throw new Error('Invalid session token.');
  }
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw error;
  }
  const user = data as UserRecord;
  if (user.KYC_Status === 'Banned') {
    throw new Error('This account has been banned.');
  }
  return user;
}

async function requireGroup(groupId: string) {
  const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Group_ID', groupId).single();
  if (error) {
    throw error;
  }
  return data as GroupRecord;
}

async function requireActiveMembership(groupId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('GroupMembers')
    .select('*')
    .eq('Group_ID', groupId)
    .eq('User_ID', userId)
    .eq('Status', 'Active')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('You must have an active membership before contributing.');
  }
  return data as MembershipRecord;
}

async function requireContributionObligation(input: {
  actor: UserRecord;
  group: GroupRecord;
  roundId: string;
  obligationId?: string;
}) {
  const obligation = await getContributionObligationForUserRound(input.roundId, input.actor.User_ID);
  if (!obligation) {
    throw new Error('Contribution obligation was not found for this member and round.');
  }
  if (input.obligationId && obligation.id !== input.obligationId) {
    throw new Error('Contribution obligation does not match the active member round.');
  }
  if (obligation.group_id !== input.group.Group_ID) {
    throw new Error('Contribution obligation does not belong to this group.');
  }
  if (['Paid', 'Waived', 'RefundPending'].includes(obligation.status)) {
    throw new Error('This contribution obligation is already settled.');
  }
  return obligation;
}

async function initiateContributionAttempt(actor: UserRecord, body: PaymentAttemptPayload) {
  if (!body.groupId) {
    throw new Error('Missing groupId for contribution attempt initiation.');
  }
  const providerName = body.providerName ?? 'MockUSSD';
  const group = await requireGroup(body.groupId);
  if (group.Status !== 'Active') {
    throw new Error('Only active groups can accept contributions.');
  }
  await requireActiveMembership(group.Group_ID, actor.User_ID);
  const round = await ensureOpenRoundForGroup(group);
  if (body.roundId && body.roundId !== round.Round_ID) {
    throw new Error('The requested round is not the current open round.');
  }
  const amount = body.amount ?? Number(group.Amount);
  if (amount !== Number(group.Amount)) {
    throw new Error(`Contribution amount must match the expected round amount of ${group.Amount} ETB.`);
  }

  const obligation = await requireContributionObligation({
    actor,
    group,
    roundId: round.Round_ID,
    obligationId: body.obligationId,
  });
  const provider = initiateSimulatedProvider(providerName, actor, group);
  const idempotencyKey = body.idempotencyKey ?? buildPaymentAttemptIdempotencyKey([
    'contribution',
    obligation.id,
    providerName,
    actor.User_ID,
    round.Round_ID,
  ]);
  const { attempt, created } = await ensurePaymentProviderAttempt({
    providerName,
    providerMode: body.providerMode ?? (providerName === 'ChapaSandbox' ? 'Sandbox' : 'Mock'),
    eventType: 'ContributionPayment',
    userId: actor.User_ID,
    groupId: group.Group_ID,
    roundId: round.Round_ID,
    contributionObligationId: obligation.id,
    amount,
    currency: 'ETB',
    normalizedPhone: body.senderPhone ?? provider.senderPhone,
    gatewayReference: body.gatewayReference ?? provider.gatewayRef,
    idempotencyKey,
    initialStatus: 'Pending',
    requestPayload: {
      source: 'payment-attempt.initiateContributionAttempt',
      provider_label: provider.providerLabel,
      requested_round_id: body.roundId ?? null,
      requested_obligation_id: body.obligationId ?? null,
    },
  });
  const updatedObligation = await markContributionObligationPendingPayment(obligation.id);

  return {
    group,
    round,
    obligation: updatedObligation as ContributionObligationRecord,
    attempt,
    created,
    provider: {
      label: provider.providerLabel,
      gatewayReference: attempt.gateway_reference,
      senderPhone: attempt.normalized_phone,
    },
    transactionCreated: false,
  };
}

async function findAttemptForOutcome(actor: UserRecord, body: PaymentAttemptPayload) {
  let query = supabaseAdmin.from('payment_provider_attempts').select('*');
  if (body.attemptId) {
    query = query.eq('id', body.attemptId);
  } else if (body.idempotencyKey) {
    query = query.eq('idempotency_key', body.idempotencyKey);
  } else if (body.gatewayReference) {
    query = query.eq('gateway_reference', body.gatewayReference);
  } else {
    throw new Error('A payment attempt id, idempotency key, or gateway reference is required.');
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('Payment provider attempt was not found.');
  }

  const attempt = data as PaymentProviderAttemptRecord;
  if (attempt.user_id !== actor.User_ID && actor.Role !== 'Admin') {
    throw new Error('You can only update your own payment attempt outcome.');
  }
  if (attempt.event_type !== 'ContributionPayment') {
    throw new Error('Only contribution payment attempts are supported by this outcome endpoint.');
  }
  if (!attempt.contribution_obligation_id) {
    throw new Error('Contribution payment attempt is missing its obligation link.');
  }
  return attempt;
}

function outcomeToAttemptStatus(input: {
  action: PaymentAttemptPayload['action'];
  outcome?: PaymentAttemptOutcome;
  attemptedAmount?: number;
  expectedAmount?: number | null;
}): PaymentProviderAttemptStatus {
  if (input.action === 'markAttemptTimeout') {
    return 'Timeout';
  }
  if (input.action === 'markAttemptCancelled') {
    return 'Cancelled';
  }
  if (
    input.outcome === 'wrong_amount' ||
    (typeof input.attemptedAmount === 'number' &&
      typeof input.expectedAmount === 'number' &&
      input.attemptedAmount !== input.expectedAmount)
  ) {
    return 'InvalidAmount';
  }
  switch (input.outcome) {
    case 'failure':
      return 'Failed';
    case 'timeout':
      return 'Timeout';
    case 'cancelled':
      return 'Cancelled';
    case 'pending':
    case undefined:
      return 'Pending';
    case 'success':
      throw new Error('Successful contribution callbacks must use contribution-reconcile so the Transaction, obligation, ledger, and draw checks stay atomic.');
  }
}

async function recordContributionAttemptOutcome(actor: UserRecord, body: PaymentAttemptPayload) {
  const attempt = await findAttemptForOutcome(actor, body);
  const status = outcomeToAttemptStatus({
    action: body.action,
    outcome: body.outcome,
    attemptedAmount: body.amount,
    expectedAmount: attempt.amount,
  });
  if (attempt.status === 'Successful') {
    throw new Error('A successful payment attempt cannot be rewritten by a later non-success mock outcome.');
  }
  const event = status === 'InvalidAmount' ? 'wrong_amount' : body.outcome ?? status.toLowerCase();

  const updatedAttempt = await recordPaymentAttemptCallback({
    attemptId: attempt.id,
    status,
    callbackPayload: {
      event,
      action: body.action,
      expected_amount: attempt.amount,
      attempted_amount: body.amount ?? null,
      gateway_reference: body.gatewayReference ?? attempt.gateway_reference,
      ...(body.callbackPayload ?? {}),
    },
    verificationResult: status === 'Pending' ? undefined : `${event} mock provider event recorded by Edge Function.`,
    failureCode: body.failureCode ?? (status === 'Pending' ? undefined : status.toUpperCase()),
    failureMessage: body.failureMessage ?? (status === 'Pending' ? undefined : `Mock provider attempt ended with ${status}.`),
  });

  const updatedObligation = status === 'Pending'
    ? await markContributionObligationPendingPayment(attempt.contribution_obligation_id)
    : await markContributionObligationUnpaid(attempt.contribution_obligation_id);

  return {
    attempt: updatedAttempt,
    obligation: updatedObligation,
    transactionCreated: false,
  };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = (await request.json()) as PaymentAttemptPayload;
    const actor = await requireActor(body.token);

    switch (body.action) {
      case 'initiateContributionAttempt':
        return json(await initiateContributionAttempt(actor, body));
      case 'recordProviderCallback':
      case 'markAttemptTimeout':
      case 'markAttemptCancelled':
        return json(await recordContributionAttemptOutcome(actor, body));
      default:
        return fail('Unsupported payment attempt action.', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected payment attempt error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
