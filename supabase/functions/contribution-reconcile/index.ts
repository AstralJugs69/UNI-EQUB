import { fail, json } from '../_shared/contracts.ts';
import type { ContributionPayload } from '../_shared/contracts.ts';
import { signContributionSession, verifyContributionSession, verifySession } from '../_shared/auth.ts';
import { recordLedgerEntry } from '../_shared/ledger.ts';
import { getContributionObligationForUserRound, markContributionObligationPaid, markContributionObligationPendingPayment, markContributionObligationUnpaid } from '../_shared/obligations.ts';
import { buildPaymentAttemptIdempotencyKey, ensurePaymentProviderAttempt, recordPaymentAttemptCallback } from '../_shared/paymentAttempts.ts';
import { initiateSimulatedProvider } from '../_shared/paymentProviders.ts';
import { normalizePhone } from '../_shared/phone.ts';
import { ensureOpenRoundForGroup, getOpenRound } from '../_shared/rounds.ts';
import { finalizeRoundIfReady } from '../_shared/roundLifecycle.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupRecord, MembershipRecord, PaymentProviderAttemptRecord, RoundRecord, TransactionRecord, UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type UssdStage = 'AwaitMenu' | 'AwaitReference' | 'AwaitAmount' | 'AwaitConfirm' | 'AwaitPin' | 'Completed' | 'Cancelled';

interface PaymentResult {
  receiptRef: string;
  amount: number;
  method: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
  autoDrawTriggered: boolean;
  payoutAmount: number;
}

interface UssdSessionState {
  sessionId: string;
  shortCode: string;
  providerLabel: string;
  stage: UssdStage;
  prompt: string;
  inputLabel: string;
  expiresAt: string;
  allowCancel: boolean;
  expectsMaskedInput?: boolean;
  error?: string;
  paymentResult?: PaymentResult;
}

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

async function getMembership(groupId: string, userId: string) {
  const { data, error } = await supabaseAdmin.from('GroupMembers').select('*').eq('Group_ID', groupId).eq('User_ID', userId).maybeSingle();
  if (error) {
    throw error;
  }
  return data as MembershipRecord | null;
}

async function findGroupMemberByPhone(groupId: string, phoneNumber: string) {
  const normalized = normalizePhone(phoneNumber);
  const { data, error } = await supabaseAdmin
    .from('GroupMembers')
    .select('*, User!inner(*)')
    .eq('Group_ID', groupId)
    .eq('Status', 'Active')
    .eq('User.Phone_Number', normalized);
  if (error) {
    throw error;
  }
  const membership = (data ?? [])[0] as (MembershipRecord & { User: UserRecord }) | undefined;
  return membership ? { membership, user: membership.User } : null;
}

async function successfulContribution(roundId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .select('*')
    .eq('Round_ID', roundId)
    .eq('User_ID', userId)
    .eq('Type', 'Contribution')
    .eq('Status', 'Successful')
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as TransactionRecord | null;
}

async function findPaymentAttemptByGatewayReference(gatewayReference: string) {
  const { data, error } = await supabaseAdmin
    .from('payment_provider_attempts')
    .select('*')
    .eq('gateway_reference', gatewayReference)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as PaymentProviderAttemptRecord | null;
}

async function assertContributionReady(actor: UserRecord, groupId: string) {
  const group = await requireGroup(groupId);
  const round = await ensureOpenRoundForGroup(group);
  if (!round) {
    throw new Error('There is no open round for this group.');
  }
  if (group.Status !== 'Active') {
    throw new Error('Only active groups can accept contributions.');
  }
  const membership = await getMembership(groupId, actor.User_ID);
  if (!membership || membership.Status !== 'Active') {
    throw new Error('You must have an active membership before contributing.');
  }
  const existing = await successfulContribution(round.Round_ID, actor.User_ID);
  if (existing) {
    throw new Error('You have already paid for this round.');
  }
  return { group, round };
}

function buildReceipt(prefix: string) {
  return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function requirePayableObligation(roundId: string, group: GroupRecord, userId: string) {
  const obligation = await getContributionObligationForUserRound(roundId, userId);
  if (!obligation) {
    throw new Error('Contribution obligation was not found for this member and round.');
  }
  if (obligation.group_id !== group.Group_ID) {
    throw new Error('Contribution obligation does not belong to this group.');
  }
  if (['Paid', 'Waived', 'RefundPending'].includes(obligation.status)) {
    throw new Error('This contribution obligation is already settled.');
  }
  return obligation;
}

async function createContributionTransactionForAttempt(input: {
  actor: UserRecord;
  group: GroupRecord;
  round: RoundRecord;
  method: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
  gatewayReference: string;
  amount: number;
}) {
  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .insert({
      User_ID: input.actor.User_ID,
      Round_ID: input.round.Round_ID,
      Amount: input.amount,
      Type: 'Contribution',
      Payment_Method: input.method,
      Gateway_Ref: input.gatewayReference,
      Status: 'Successful',
      Date: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return data as TransactionRecord;
}

async function completeSuccessfulContributionAttempt(input: {
  actor: UserRecord;
  group: GroupRecord;
  round: RoundRecord;
  method: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
  amount: number;
  providerLabel: string;
  attempt: PaymentProviderAttemptRecord;
  obligationId: string;
  event: string;
  attemptCreated: boolean;
}) {
  const verifiedAttempt = await recordPaymentAttemptCallback({
    attemptId: input.attempt.id,
    status: 'Successful',
    callbackPayload: {
      provider_label: input.providerLabel,
      gateway_reference: input.attempt.gateway_reference,
      amount: input.amount,
      currency: 'ETB',
      event: input.event,
    },
    verificationResult: `${input.event} verified by Edge Function.`,
  });

  const transaction = await createContributionTransactionForAttempt({
    actor: input.actor,
    group: input.group,
    round: input.round,
    method: input.method,
    gatewayReference: verifiedAttempt.gateway_reference ?? input.attempt.gateway_reference ?? buildReceipt(input.method === 'MockUSSD' ? 'USSD' : input.method === 'ChapaSandbox' ? 'CHAPA' : 'TB'),
    amount: input.amount,
  });
  const paidObligation = await markContributionObligationPaid(input.obligationId, transaction.Trans_ID);
  await recordLedgerEntry({
    userId: input.actor.User_ID,
    groupId: input.group.Group_ID,
    roundId: input.round.Round_ID,
    transactionId: transaction.Trans_ID,
    entryType: 'ContributionReceived',
    direction: 'Credit',
    amount: input.amount,
    currency: 'ETB',
    description: `Contribution received for ${input.group.Group_Name} round ${input.round.Round_Number}.`,
    referenceType: 'payment_provider_attempts',
    referenceId: verifiedAttempt.id,
    metadata: {
      contribution_obligation_id: paidObligation.id,
      idempotency_key: verifiedAttempt.idempotency_key,
      attempt_created: input.attemptCreated,
    },
  });

  const lifecycle = await finalizeRoundIfReady(input.group, input.round);
  return {
    transaction,
    obligation: paidObligation,
    attempt: verifiedAttempt,
    ledgerRecorded: true,
    paymentResult: {
      receiptRef: transaction.Gateway_Ref,
      amount: Number(transaction.Amount),
      method: input.method,
      autoDrawTriggered: lifecycle.autoDrawTriggered,
      payoutAmount: lifecycle.payoutAmount,
    } as PaymentResult,
  };
}

async function payContributionThroughProviderAttempt(actor: UserRecord, groupId: string, method: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox') {
  const { group, round } = await assertContributionReady(actor, groupId);
  const amount = Number(group.Amount);
  const obligation = await requirePayableObligation(round.Round_ID, group, actor.User_ID);
  const provider = initiateSimulatedProvider(method, actor, group);
  const idempotencyKey = buildPaymentAttemptIdempotencyKey([
    'direct-contribution',
    obligation.id,
    method,
    actor.User_ID,
    round.Round_ID,
  ]);
  const { attempt, created } = await ensurePaymentProviderAttempt({
    providerName: method,
    providerMode: method === 'ChapaSandbox' ? 'Sandbox' : 'Mock',
    eventType: 'ContributionPayment',
    userId: actor.User_ID,
    groupId: group.Group_ID,
    roundId: round.Round_ID,
    contributionObligationId: obligation.id,
    amount,
    currency: 'ETB',
    normalizedPhone: provider.senderPhone,
    gatewayReference: provider.gatewayRef,
    idempotencyKey,
    initialStatus: 'Pending',
    requestPayload: {
      source: 'contribution-reconcile.payContribution',
      provider_label: provider.providerLabel,
    },
  });

  await markContributionObligationPendingPayment(obligation.id);
  return await completeSuccessfulContributionAttempt({
    actor,
    group,
    round,
    method,
    amount,
    providerLabel: provider.providerLabel,
    attempt,
    obligationId: obligation.id,
    event: 'direct_mock_success',
    attemptCreated: created,
  });
}

async function initiateUssdContributionAttempt(actor: UserRecord, group: GroupRecord, round: RoundRecord) {
  const amount = Number(group.Amount);
  const obligation = await requirePayableObligation(round.Round_ID, group, actor.User_ID);
  const provider = initiateSimulatedProvider('MockUSSD', actor, group);
  const idempotencyKey = buildPaymentAttemptIdempotencyKey([
    'ussd-contribution',
    obligation.id,
    actor.User_ID,
    round.Round_ID,
  ]);
  const { attempt, created } = await ensurePaymentProviderAttempt({
    providerName: 'MockUSSD',
    providerMode: 'Mock',
    eventType: 'ContributionPayment',
    userId: actor.User_ID,
    groupId: group.Group_ID,
    roundId: round.Round_ID,
    contributionObligationId: obligation.id,
    amount,
    currency: 'ETB',
    normalizedPhone: provider.senderPhone,
    gatewayReference: provider.gatewayRef,
    idempotencyKey,
    initialStatus: 'Pending',
    requestPayload: {
      source: 'contribution-reconcile.startContributionUssd',
      provider_label: provider.providerLabel,
    },
  });
  const pendingObligation = await markContributionObligationPendingPayment(obligation.id);
  return {
    attempt,
    obligation: pendingObligation,
    provider,
    created,
  };
}

async function reconcileContributionByPhone(groupId: string, senderPhone: string, method: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox', gatewayRef?: string, forcedAmount?: number) {
  const match = await findGroupMemberByPhone(groupId, senderPhone);
  if (!match) {
    throw new Error('No active group member matches the sender phone for this contribution.');
  }

  const actor = match.user;
  const { group, round } = await assertContributionReady(actor, groupId);
  const amount = forcedAmount ?? Number(group.Amount);
  if (amount !== Number(group.Amount)) {
    throw new Error(`Contribution amount must match the expected round amount of ${group.Amount} ETB.`);
  }

  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .insert({
      User_ID: actor.User_ID,
      Round_ID: round.Round_ID,
      Amount: amount,
      Type: 'Contribution',
      Payment_Method: method,
      Gateway_Ref: gatewayRef ?? buildReceipt(method === 'MockUSSD' ? 'USSD' : method === 'ChapaSandbox' ? 'CHAPA' : 'TB'),
      Status: 'Successful',
      Date: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }

  const transaction = data as TransactionRecord;
  const lifecycle = await finalizeRoundIfReady(group, round);
  return {
    transaction,
    paymentResult: {
      receiptRef: transaction.Gateway_Ref,
      amount,
      method,
      autoDrawTriggered: lifecycle.autoDrawTriggered,
      payoutAmount: lifecycle.payoutAmount,
    } as PaymentResult,
  };
}

async function reconcileProviderCallbackThroughAttempt(input: {
  groupId: string;
  senderPhone: string;
  method: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
  gatewayRef?: string;
  amount?: number;
}) {
  const match = await findGroupMemberByPhone(input.groupId, input.senderPhone);
  if (!match) {
    throw new Error('No active group member matches the sender phone for this contribution.');
  }

  const actor = match.user;
  const group = await requireGroup(input.groupId);
  if (group.Status !== 'Active') {
    throw new Error('Only active groups can accept contributions.');
  }
  const round = await ensureOpenRoundForGroup(group);
  const amount = input.amount ?? Number(group.Amount);
  if (amount !== Number(group.Amount)) {
    throw new Error(`Contribution amount must match the expected round amount of ${group.Amount} ETB.`);
  }

  const obligation = await getContributionObligationForUserRound(round.Round_ID, actor.User_ID);
  if (!obligation) {
    throw new Error('Contribution obligation was not found for this member and round.');
  }
  if (['Waived', 'RefundPending'].includes(obligation.status)) {
    throw new Error('This contribution obligation is already settled outside the provider callback flow.');
  }

  const existingTransaction = await successfulContribution(round.Round_ID, actor.User_ID);
  const idempotencyKey = buildPaymentAttemptIdempotencyKey([
    'provider-callback',
    input.gatewayRef ?? obligation.id,
    input.method,
    actor.User_ID,
    round.Round_ID,
  ]);
  const provider = initiateSimulatedProvider(input.method, actor, group);
  const existingAttempt = input.gatewayRef ? await findPaymentAttemptByGatewayReference(input.gatewayRef) : null;
  const ensured = existingAttempt
    ? { attempt: existingAttempt, created: false }
    : await ensurePaymentProviderAttempt({
      providerName: input.method,
      providerMode: input.method === 'ChapaSandbox' ? 'Sandbox' : 'Mock',
      eventType: 'ContributionPayment',
      userId: actor.User_ID,
      groupId: group.Group_ID,
      roundId: round.Round_ID,
      contributionObligationId: obligation.id,
      amount,
      currency: 'ETB',
      normalizedPhone: normalizePhone(input.senderPhone),
      gatewayReference: input.gatewayRef ?? provider.gatewayRef,
      idempotencyKey,
      initialStatus: 'Pending',
      requestPayload: {
        source: 'contribution-reconcile.reconcileProviderCallback',
        provider_label: provider.providerLabel,
      },
    });

  if (existingTransaction || ensured.attempt.status === 'Successful') {
    const duplicateAttempt = await recordPaymentAttemptCallback({
      attemptId: ensured.attempt.id,
      status: 'Duplicate',
      callbackPayload: {
        event: 'duplicate_provider_callback',
        gateway_reference: input.gatewayRef ?? ensured.attempt.gateway_reference,
        amount,
        currency: 'ETB',
        existing_transaction_id: existingTransaction?.Trans_ID ?? null,
      },
      verificationResult: 'Duplicate provider callback detected; no transaction was created.',
      failureCode: 'DUPLICATE_CALLBACK',
      failureMessage: 'A successful contribution already exists for this user and round.',
    });
    return {
      duplicate: true,
      transaction: existingTransaction,
      attempt: duplicateAttempt,
      obligation,
      paymentResult: existingTransaction
        ? {
          receiptRef: existingTransaction.Gateway_Ref,
          amount: Number(existingTransaction.Amount),
          method: existingTransaction.Payment_Method,
          autoDrawTriggered: false,
          payoutAmount: 0,
        } as PaymentResult
        : null,
    };
  }

  await markContributionObligationPendingPayment(obligation.id);
  return await completeSuccessfulContributionAttempt({
    actor,
    group,
    round,
    method: input.method,
    amount,
    providerLabel: provider.providerLabel,
    attempt: ensured.attempt,
    obligationId: obligation.id,
    event: 'provider_callback_success',
    attemptCreated: ensured.created,
  });
}

async function listUserTransactions(userId: string) {
  const { data, error } = await supabaseAdmin.from('Transaction').select('*').eq('User_ID', userId).order('Date', { ascending: false });
  if (error) {
    throw error;
  }
  return ((data ?? []) as TransactionRecord[]).map(item => ({
    ...item,
    Amount: Number(item.Amount),
  }));
}

async function getWalletSnapshot(userId: string) {
  const transactions = await listUserTransactions(userId);
  const readyPayout = transactions
    .filter(item => item.Type === 'Payout' && item.Status === 'Pending')
    .reduce((sum, item) => sum + Number(item.Amount), 0);
  return {
    balance: readyPayout,
    readyPayout,
    defaultDestination: 'Internal wallet clearance',
  };
}

async function buildUssdState(input: {
  actor: UserRecord;
  group: GroupRecord;
  round: RoundRecord;
  stage: UssdStage;
  sessionId: string;
  error?: string;
  paymentResult?: PaymentResult;
}) {
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const base = {
    sessionId: input.sessionId,
    shortCode: '*127#',
    providerLabel: 'Telebirr',
    stage: input.stage,
    expiresAt,
    allowCancel: input.stage !== 'Completed' && input.stage !== 'Cancelled',
    error: input.error,
  };

  switch (input.stage) {
    case 'AwaitMenu':
      return {
        ...base,
        prompt: ['Telebirr', '1. Pay merchant', '2. Buy airtime', '3. Check balance', '0. Cancel'].join('\n'),
        inputLabel: 'Reply with a number',
      } satisfies UssdSessionState;
    case 'AwaitReference':
      return {
        ...base,
        prompt: ['Pay merchant', input.group.Group_Name, 'Enter merchant ref', `Use ${input.group.Virtual_Acc_Ref ?? ''}`].join('\n'),
        inputLabel: 'Merchant reference',
      } satisfies UssdSessionState;
    case 'AwaitAmount':
      return {
        ...base,
        prompt: ['Enter amount', `Round contribution: ${input.group.Amount} ETB`, 'Exact amount is required'].join('\n'),
        inputLabel: 'Amount',
      } satisfies UssdSessionState;
    case 'AwaitConfirm':
      return {
        ...base,
        prompt: ['Confirm payment', `Group: ${input.group.Group_Name}`, `Ref: ${input.group.Virtual_Acc_Ref ?? ''}`, `Amount: ${input.group.Amount} ETB`, '1. Confirm', '0. Cancel'].join('\n'),
        inputLabel: 'Reply with a number',
      } satisfies UssdSessionState;
    case 'AwaitPin':
      return {
        ...base,
        prompt: ['Authorize payment', 'Enter your 6-digit Telebirr PIN', `${input.group.Amount} ETB -> ${input.group.Group_Name}`].join('\n'),
        inputLabel: 'PIN',
        expectsMaskedInput: true,
      } satisfies UssdSessionState;
    case 'Completed':
      return {
        ...base,
        allowCancel: false,
        prompt: ['Payment successful', `${input.group.Amount} ETB sent`, `Ref: ${input.paymentResult?.receiptRef ?? '-'}`, 'SMS confirmation will follow shortly.'].join('\n'),
        inputLabel: '',
        paymentResult: input.paymentResult,
      } satisfies UssdSessionState;
    case 'Cancelled':
      return {
        ...base,
        allowCancel: false,
        prompt: 'Session cancelled.\nNo contribution was recorded.',
        inputLabel: '',
      } satisfies UssdSessionState;
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = (await request.json()) as ContributionPayload;
    const actor = await requireActor(body.token);

    switch (body.action) {
      case 'payContribution': {
        if (!body.groupId || !body.method) {
          return fail('Missing direct contribution payload.', 400);
        }
        return json(await payContributionThroughProviderAttempt(actor, body.groupId, body.method));
      }

      case 'listTransactions':
        return json({ transactions: await listUserTransactions(actor.User_ID) });

      case 'getWallet':
        return json(await getWalletSnapshot(actor.User_ID));

      case 'startContributionUssd': {
        if (!body.groupId) {
          return fail('Missing groupId for USSD start.', 400);
        }
        const { group, round } = await assertContributionReady(actor, body.groupId);
        const { attempt, obligation } = await initiateUssdContributionAttempt(actor, group, round);
        const sessionId = await signContributionSession({
          userId: actor.User_ID,
          phoneNumber: actor.Phone_Number,
          groupId: group.Group_ID,
          roundId: round.Round_ID,
          stage: 'AwaitMenu',
          amount: Number(group.Amount),
          merchantRef: group.Virtual_Acc_Ref ?? '',
          attemptId: attempt.id,
          obligationId: obligation.id,
        });
        return json(await buildUssdState({ actor, group, round, stage: 'AwaitMenu', sessionId }));
      }

      case 'submitContributionUssd': {
        if (!body.sessionId) {
          return fail('Missing USSD session id.', 400);
        }
        const payload = await verifyContributionSession(body.sessionId);
        const userId = payload.sub;
        if (!userId || userId !== actor.User_ID) {
          return fail('Contribution session does not belong to the active user.', 403);
        }
        const stage = payload.stage as UssdStage | undefined;
        const groupId = payload.groupId as string | undefined;
        const roundId = payload.roundId as string | undefined;
        const merchantRef = payload.merchantRef as string | undefined;
        const attemptId = payload.attemptId as string | undefined;
        const obligationId = payload.obligationId as string | undefined;
        const amount = Number(payload.amount ?? 0);
        if (!stage || !groupId || !roundId || !merchantRef || !amount || !attemptId || !obligationId) {
          return fail('Contribution session is invalid.', 400);
        }
        const group = await requireGroup(groupId);
        const round = await getOpenRound(groupId);
        if (!round || round.Round_ID !== roundId) {
          return fail('The round changed while this USSD session was open. Start again.', 409);
        }
        const input = body.input?.trim() ?? '';

        if (input === '0') {
          await recordPaymentAttemptCallback({
            attemptId,
            status: 'Cancelled',
            callbackPayload: {
              event: 'ussd_cancelled',
              stage,
            },
            failureCode: 'USSD_CANCELLED',
            failureMessage: 'Member cancelled the USSD contribution session.',
          });
          await markContributionObligationUnpaid(obligationId);
          return json({ ussd: await buildUssdState({ actor, group, round, stage: 'Cancelled', sessionId: body.sessionId }) });
        }

        switch (stage) {
          case 'AwaitMenu': {
            if (input !== '1') {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: 'Reply with 1 to pay the merchant or 0 to cancel.' }) });
            }
            const nextSessionId = await signContributionSession({ userId: actor.User_ID, phoneNumber: actor.Phone_Number, groupId, roundId, stage: 'AwaitReference', amount, merchantRef, attemptId, obligationId });
            return json({ ussd: await buildUssdState({ actor, group, round, stage: 'AwaitReference', sessionId: nextSessionId }) });
          }
          case 'AwaitReference': {
            if (input.toUpperCase() !== merchantRef.toUpperCase()) {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: `Reference must match ${merchantRef}.` }) });
            }
            const nextSessionId = await signContributionSession({ userId: actor.User_ID, phoneNumber: actor.Phone_Number, groupId, roundId, stage: 'AwaitAmount', amount, merchantRef, attemptId, obligationId });
            return json({ ussd: await buildUssdState({ actor, group, round, stage: 'AwaitAmount', sessionId: nextSessionId }) });
          }
          case 'AwaitAmount': {
            if (Number(input) !== amount) {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: `Amount must be exactly ${amount} ETB.` }) });
            }
            const nextSessionId = await signContributionSession({ userId: actor.User_ID, phoneNumber: actor.Phone_Number, groupId, roundId, stage: 'AwaitConfirm', amount, merchantRef, attemptId, obligationId });
            return json({ ussd: await buildUssdState({ actor, group, round, stage: 'AwaitConfirm', sessionId: nextSessionId }) });
          }
          case 'AwaitConfirm': {
            if (input !== '1') {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: 'Reply with 1 to confirm or 0 to cancel.' }) });
            }
            const nextSessionId = await signContributionSession({ userId: actor.User_ID, phoneNumber: actor.Phone_Number, groupId, roundId, stage: 'AwaitPin', amount, merchantRef, attemptId, obligationId });
            return json({ ussd: await buildUssdState({ actor, group, round, stage: 'AwaitPin', sessionId: nextSessionId }) });
          }
          case 'AwaitPin': {
            if (!/^\d{6}$/.test(input)) {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: 'Enter your 6-digit Telebirr PIN.' }) });
            }
            const { data: existingAttempt, error: attemptError } = await supabaseAdmin
              .from('payment_provider_attempts')
              .select('*')
              .eq('id', attemptId)
              .single();
            if (attemptError) {
              throw attemptError;
            }
            const result = await completeSuccessfulContributionAttempt({
              actor,
              group,
              round,
              method: 'MockUSSD',
              amount,
              providerLabel: 'MockUSSD',
              attempt: existingAttempt as PaymentProviderAttemptRecord,
              obligationId,
              event: 'ussd_mock_success',
              attemptCreated: false,
            });
            return json({
              ussd: await buildUssdState({
                actor,
                group,
                round,
                stage: 'Completed',
                sessionId: body.sessionId,
                paymentResult: result.paymentResult,
              }),
              transaction: result.transaction,
            });
          }
          default:
            return fail('Unsupported USSD session stage.', 400);
        }
      }

      case 'reconcileProviderCallback': {
        if (!body.groupId || !body.method || !body.senderPhone) {
          return fail('Missing callback reconciliation payload.', 400);
        }
        return json(await reconcileProviderCallbackThroughAttempt({
          groupId: body.groupId,
          senderPhone: body.senderPhone,
          method: body.method,
          gatewayRef: body.gatewayRef,
          amount: body.amount,
        }));
      }

      default:
        return fail('Unsupported contribution action.', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected contribution error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
