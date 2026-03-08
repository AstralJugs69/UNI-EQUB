import { fail, json } from '../_shared/contracts.ts';
import type { ContributionPayload } from '../_shared/contracts.ts';
import { signContributionSession, verifyContributionSession, verifySession } from '../_shared/auth.ts';
import { initiateSimulatedProvider } from '../_shared/paymentProviders.ts';
import { normalizePhone } from '../_shared/phone.ts';
import { finalizeRoundIfReady } from '../_shared/roundLifecycle.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupRecord, MembershipRecord, RoundRecord, TransactionRecord, UserRecord } from '../_shared/types.ts';

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

async function getCurrentRound(groupId: string) {
  const { data, error } = await supabaseAdmin.from('Round').select('*').eq('Group_ID', groupId).eq('Status', 'Open').order('Round_Number', { ascending: false }).maybeSingle();
  if (error) {
    throw error;
  }
  return data as RoundRecord | null;
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

async function assertContributionReady(actor: UserRecord, groupId: string) {
  const group = await requireGroup(groupId);
  const round = await getCurrentRound(groupId);
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

async function createContributionTransaction(actor: UserRecord, group: GroupRecord, round: RoundRecord, method: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox') {
  const receiptRef = buildReceipt(method === 'MockUSSD' ? 'USSD' : method === 'ChapaSandbox' ? 'CHAPA' : 'TB');
  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .insert({
      User_ID: actor.User_ID,
      Round_ID: round.Round_ID,
      Amount: group.Amount,
      Type: 'Contribution',
      Payment_Method: method,
      Gateway_Ref: receiptRef,
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
      receiptRef,
      amount: Number(transaction.Amount),
      method,
      autoDrawTriggered: lifecycle.autoDrawTriggered,
      payoutAmount: lifecycle.payoutAmount,
    } as PaymentResult,
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
        if (!body.groupId || !body.method || body.method === 'MockUSSD') {
          return fail('Missing direct contribution payload.', 400);
        }
        const group = await requireGroup(body.groupId);
        const provider = initiateSimulatedProvider(body.method, actor, group);
        return json(await reconcileContributionByPhone(body.groupId, provider.senderPhone, body.method, provider.gatewayRef));
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
        const sessionId = await signContributionSession({
          userId: actor.User_ID,
          phoneNumber: actor.Phone_Number,
          groupId: group.Group_ID,
          roundId: round.Round_ID,
          stage: 'AwaitMenu',
          amount: Number(group.Amount),
          merchantRef: group.Virtual_Acc_Ref ?? '',
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
        const amount = Number(payload.amount ?? 0);
        if (!stage || !groupId || !roundId || !merchantRef || !amount) {
          return fail('Contribution session is invalid.', 400);
        }
        const group = await requireGroup(groupId);
        const round = await getCurrentRound(groupId);
        if (!round || round.Round_ID !== roundId) {
          return fail('The round changed while this USSD session was open. Start again.', 409);
        }
        const input = body.input?.trim() ?? '';

        if (input === '0') {
          return json({ ussd: await buildUssdState({ actor, group, round, stage: 'Cancelled', sessionId: body.sessionId }) });
        }

        switch (stage) {
          case 'AwaitMenu': {
            if (input !== '1') {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: 'Reply with 1 to pay the merchant or 0 to cancel.' }) });
            }
            const nextSessionId = await signContributionSession({ userId: actor.User_ID, phoneNumber: actor.Phone_Number, groupId, roundId, stage: 'AwaitReference', amount, merchantRef });
            return json({ ussd: await buildUssdState({ actor, group, round, stage: 'AwaitReference', sessionId: nextSessionId }) });
          }
          case 'AwaitReference': {
            if (input.toUpperCase() !== merchantRef.toUpperCase()) {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: `Reference must match ${merchantRef}.` }) });
            }
            const nextSessionId = await signContributionSession({ userId: actor.User_ID, phoneNumber: actor.Phone_Number, groupId, roundId, stage: 'AwaitAmount', amount, merchantRef });
            return json({ ussd: await buildUssdState({ actor, group, round, stage: 'AwaitAmount', sessionId: nextSessionId }) });
          }
          case 'AwaitAmount': {
            if (Number(input) !== amount) {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: `Amount must be exactly ${amount} ETB.` }) });
            }
            const nextSessionId = await signContributionSession({ userId: actor.User_ID, phoneNumber: actor.Phone_Number, groupId, roundId, stage: 'AwaitConfirm', amount, merchantRef });
            return json({ ussd: await buildUssdState({ actor, group, round, stage: 'AwaitConfirm', sessionId: nextSessionId }) });
          }
          case 'AwaitConfirm': {
            if (input !== '1') {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: 'Reply with 1 to confirm or 0 to cancel.' }) });
            }
            const nextSessionId = await signContributionSession({ userId: actor.User_ID, phoneNumber: actor.Phone_Number, groupId, roundId, stage: 'AwaitPin', amount, merchantRef });
            return json({ ussd: await buildUssdState({ actor, group, round, stage: 'AwaitPin', sessionId: nextSessionId }) });
          }
          case 'AwaitPin': {
            if (!/^\d{6}$/.test(input)) {
              return json({ ussd: await buildUssdState({ actor, group, round, stage, sessionId: body.sessionId, error: 'Enter your 6-digit Telebirr PIN.' }) });
            }
            const provider = initiateSimulatedProvider('MockUSSD', actor, group);
            const result = await reconcileContributionByPhone(group.Group_ID, provider.senderPhone, 'MockUSSD', provider.gatewayRef);
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
        return json(await reconcileContributionByPhone(body.groupId, body.senderPhone, body.method, body.gatewayRef, body.amount));
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
