import { fail, json } from '../_shared/contracts.ts';
import type { PaymentAttemptPayload } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { getContributionObligationForUserRound, markContributionObligationPendingPayment } from '../_shared/obligations.ts';
import { buildPaymentAttemptIdempotencyKey, ensurePaymentProviderAttempt } from '../_shared/paymentAttempts.ts';
import { initiateSimulatedProvider } from '../_shared/paymentProviders.ts';
import { ensureOpenRoundForGroup } from '../_shared/rounds.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { ContributionObligationRecord, GroupRecord, MembershipRecord, UserRecord } from '../_shared/types.ts';

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
