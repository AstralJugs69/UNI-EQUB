import { recordLedgerEntry } from './ledger.ts';
import { supabaseAdmin } from './supabaseAdmin.ts';
import type { PayoutReleaseScheduleRecord, PayoutRequestRecord, RoundRecord, TransactionRecord } from './types.ts';

export interface ReservedPayoutReleaseResult {
  payoutRequest: PayoutRequestRecord;
  releaseSchedule: PayoutReleaseScheduleRecord;
  payoutTransaction: TransactionRecord;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildReserveReleaseGatewayRef() {
  return `RESERVE-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function createReserveReleaseTransaction(input: {
  userId: string;
  triggerRoundId: string;
  amount: number;
}) {
  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .insert({
      User_ID: input.userId,
      Round_ID: input.triggerRoundId,
      Amount: input.amount,
      Type: 'Payout',
      Payment_Method: 'MockUSSD',
      Gateway_Ref: buildReserveReleaseGatewayRef(),
      Status: 'Pending',
      Date: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as TransactionRecord;
}

async function getPayoutRequest(payoutRequestId: string) {
  const { data, error } = await supabaseAdmin
    .from('payout_requests')
    .select('*')
    .eq('id', payoutRequestId)
    .single();

  if (error) {
    throw error;
  }
  return data as PayoutRequestRecord;
}

async function countPendingReleaseSchedules(payoutRequestId: string) {
  const { count, error } = await supabaseAdmin
    .from('payout_release_schedules')
    .select('id', { count: 'exact', head: true })
    .eq('payout_request_id', payoutRequestId)
    .eq('status', 'Pending');

  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function updatePayoutRequestAfterReserveRelease(input: {
  payoutRequest: PayoutRequestRecord;
  releaseAmount: number;
  pendingScheduleCount: number;
}) {
  const totalPayoutAmount = Number(input.payoutRequest.total_payout_amount);
  const immediateReleaseAmount = roundMoney(Number(input.payoutRequest.immediate_release_amount) + input.releaseAmount);
  const cappedImmediateReleaseAmount = Math.min(immediateReleaseAmount, totalPayoutAmount);
  const reservedAmount = roundMoney(Math.max(totalPayoutAmount - cappedImmediateReleaseAmount, 0));
  const completed = input.pendingScheduleCount === 0 || reservedAmount <= 0;

  const { data, error } = await supabaseAdmin
    .from('payout_requests')
    .update({
      immediate_release_amount: cappedImmediateReleaseAmount,
      reserved_amount: reservedAmount,
      status: completed ? 'Completed' : 'PartiallyReleased',
      processed_at: completed ? new Date().toISOString() : input.payoutRequest.processed_at,
    })
    .eq('id', input.payoutRequest.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as PayoutRequestRecord;
}

export async function releaseNextReservedPayoutForContribution(input: {
  userId: string;
  groupId: string;
  triggerRound: RoundRecord;
  triggerObligationId: string;
}) {
  const { data: schedules, error: scheduleError } = await supabaseAdmin
    .from('payout_release_schedules')
    .select('*')
    .eq('user_id', input.userId)
    .eq('group_id', input.groupId)
    .eq('status', 'Pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (scheduleError) {
    throw scheduleError;
  }

  const pendingSchedule = (schedules?.[0] ?? null) as PayoutReleaseScheduleRecord | null;
  if (!pendingSchedule) {
    return null;
  }

  const releasedAt = new Date().toISOString();
  const { data: claimedSchedule, error: claimError } = await supabaseAdmin
    .from('payout_release_schedules')
    .update({
      status: 'Released',
      trigger_obligation_id: input.triggerObligationId,
      released_at: releasedAt,
    })
    .eq('id', pendingSchedule.id)
    .eq('status', 'Pending')
    .select('*')
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }
  if (!claimedSchedule) {
    return null;
  }

  const releaseSchedule = claimedSchedule as PayoutReleaseScheduleRecord;
  const payoutRequest = await getPayoutRequest(releaseSchedule.payout_request_id);
  const releaseAmount = roundMoney(Number(releaseSchedule.release_amount));
  const payoutTransaction = await createReserveReleaseTransaction({
    userId: input.userId,
    triggerRoundId: input.triggerRound.Round_ID,
    amount: releaseAmount,
  });
  const pendingScheduleCount = await countPendingReleaseSchedules(payoutRequest.id);
  const updatedPayoutRequest = await updatePayoutRequestAfterReserveRelease({
    payoutRequest,
    releaseAmount,
    pendingScheduleCount,
  });

  await recordLedgerEntry({
    userId: input.userId,
    groupId: input.groupId,
    roundId: input.triggerRound.Round_ID,
    transactionId: payoutTransaction.Trans_ID,
    payoutRequestId: payoutRequest.id,
    entryType: 'ReserveReleased',
    direction: 'Memo',
    amount: releaseAmount,
    currency: releaseSchedule.currency,
    description: 'Reserved payout amount released after a later successful contribution.',
    referenceType: 'payout_release_schedules',
    referenceId: releaseSchedule.id,
    metadata: {
      trigger_obligation_id: input.triggerObligationId,
      original_payout_round_id: releaseSchedule.round_id,
      payout_request_status: updatedPayoutRequest.status,
    },
  });

  await recordLedgerEntry({
    userId: input.userId,
    groupId: input.groupId,
    roundId: input.triggerRound.Round_ID,
    transactionId: payoutTransaction.Trans_ID,
    payoutRequestId: payoutRequest.id,
    entryType: 'PayoutReleased',
    direction: 'Credit',
    amount: releaseAmount,
    currency: releaseSchedule.currency,
    description: 'Reserve release is now available in the simulated payout wallet.',
    referenceType: 'payout_release_schedules',
    referenceId: releaseSchedule.id,
    metadata: {
      trigger_obligation_id: input.triggerObligationId,
      original_payout_round_id: releaseSchedule.round_id,
      gateway_reference: payoutTransaction.Gateway_Ref,
    },
  });

  return {
    payoutRequest: updatedPayoutRequest,
    releaseSchedule,
    payoutTransaction,
  } satisfies ReservedPayoutReleaseResult;
}

export async function releaseNextReservedPayoutForGroupRound(input: {
  userId: string;
  groupId: string;
  triggerRound: RoundRecord;
  reason: string;
}) {
  const { data: schedules, error: scheduleError } = await supabaseAdmin
    .from('payout_release_schedules')
    .select('*')
    .eq('user_id', input.userId)
    .eq('group_id', input.groupId)
    .eq('status', 'Pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (scheduleError) {
    throw scheduleError;
  }

  const pendingSchedule = (schedules?.[0] ?? null) as PayoutReleaseScheduleRecord | null;
  if (!pendingSchedule) {
    return null;
  }

  const releasedAt = new Date().toISOString();
  const { data: claimedSchedule, error: claimError } = await supabaseAdmin
    .from('payout_release_schedules')
    .update({
      status: 'Released',
      released_at: releasedAt,
    })
    .eq('id', pendingSchedule.id)
    .eq('status', 'Pending')
    .select('*')
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }
  if (!claimedSchedule) {
    return null;
  }

  const releaseSchedule = claimedSchedule as PayoutReleaseScheduleRecord;
  const payoutRequest = await getPayoutRequest(releaseSchedule.payout_request_id);
  const releaseAmount = roundMoney(Number(releaseSchedule.release_amount));
  const payoutTransaction = await createReserveReleaseTransaction({
    userId: input.userId,
    triggerRoundId: input.triggerRound.Round_ID,
    amount: releaseAmount,
  });
  const pendingScheduleCount = await countPendingReleaseSchedules(payoutRequest.id);
  const updatedPayoutRequest = await updatePayoutRequestAfterReserveRelease({
    payoutRequest,
    releaseAmount,
    pendingScheduleCount,
  });

  await recordLedgerEntry({
    userId: input.userId,
    groupId: input.groupId,
    roundId: input.triggerRound.Round_ID,
    transactionId: payoutTransaction.Trans_ID,
    payoutRequestId: payoutRequest.id,
    entryType: 'ReserveReleased',
    direction: 'Memo',
    amount: releaseAmount,
    currency: releaseSchedule.currency,
    description: input.reason,
    referenceType: 'payout_release_schedules',
    referenceId: releaseSchedule.id,
    metadata: {
      original_payout_round_id: releaseSchedule.round_id,
      payout_request_status: updatedPayoutRequest.status,
      release_source: 'group_round_after_winner_exit',
    },
  });

  await recordLedgerEntry({
    userId: input.userId,
    groupId: input.groupId,
    roundId: input.triggerRound.Round_ID,
    transactionId: payoutTransaction.Trans_ID,
    payoutRequestId: payoutRequest.id,
    entryType: 'PayoutReleased',
    direction: 'Credit',
    amount: releaseAmount,
    currency: releaseSchedule.currency,
    description: 'Reserve release is now available in the simulated payout wallet.',
    referenceType: 'payout_release_schedules',
    referenceId: releaseSchedule.id,
    metadata: {
      original_payout_round_id: releaseSchedule.round_id,
      gateway_reference: payoutTransaction.Gateway_Ref,
      release_source: 'group_round_after_winner_exit',
    },
  });

  return {
    payoutRequest: updatedPayoutRequest,
    releaseSchedule,
    payoutTransaction,
  } satisfies ReservedPayoutReleaseResult;
}
