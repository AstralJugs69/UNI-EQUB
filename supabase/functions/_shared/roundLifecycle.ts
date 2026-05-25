import { supabaseAdmin } from './supabaseAdmin.ts';
import { ensureContributionObligationsForRound, getRoundObligationReadiness, isContributionObligationSettled } from './obligations.ts';
import { recordLedgerEntry } from './ledger.ts';
import { calculatePayoutVestingFromConfig, buildPayoutReleaseScheduleAmounts } from './payoutVesting.ts';
import { releaseNextReservedPayoutForGroupRound } from './payoutReserves.ts';
import { ensureReliabilityProfile } from './reliability.ts';
import { openCycleCompletionVote } from './groupResolution.ts';
import { openWinnerExitWindow } from './winnerExit.ts';
import type {
  GroupRecord,
  MembershipRecord,
  PayoutReleaseScheduleRecord,
  PayoutRequestRecord,
  RoundRecord,
  TransactionRecord,
  UserReliabilityProfileRecord,
} from './types.ts';

interface RoundCompletionResult {
  autoDrawTriggered: boolean;
  payoutAmount: number;
  payoutRequest: PayoutRequestRecord | null;
  payoutTransaction: TransactionRecord | null;
  payoutReleaseSchedules: PayoutReleaseScheduleRecord[];
  nextRound: RoundRecord | null;
  updatedRound: RoundRecord;
  completedGroup: GroupRecord | null;
  reliabilityProfileUpdates: UserReliabilityProfileRecord[];
}

async function listActiveMemberships(groupId: string) {
  const { data, error } = await supabaseAdmin.from('GroupMembers').select('*').eq('Group_ID', groupId).eq('Status', 'Active');
  if (error) {
    throw error;
  }
  return (data ?? []) as MembershipRecord[];
}

async function listPriorWinnerIds(groupId: string, minRoundNumber?: number) {
  let query = supabaseAdmin
    .from('Round')
    .select('Winner_ID')
    .eq('Group_ID', groupId)
    .not('Winner_ID', 'is', null);

  if (typeof minRoundNumber === 'number') {
    query = query.gte('Round_Number', minRoundNumber);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return new Set((data ?? []).map(item => item.Winner_ID as string));
}

async function getCurrentPassStartRoundNumber(groupId: string) {
  const { data: events, error: eventError } = await supabaseAdmin
    .from('group_freeze_events')
    .select('trigger_round_id, resolved_at')
    .eq('group_id', groupId)
    .eq('reason', 'CycleCompletionVote')
    .eq('status', 'ResolvedContinue')
    .order('resolved_at', { ascending: false, nullsFirst: false })
    .limit(1);
  if (eventError) {
    throw eventError;
  }
  const triggerRoundId = (events?.[0] as { trigger_round_id?: string | null } | undefined)?.trigger_round_id;
  if (!triggerRoundId) {
    return 1;
  }
  const { data: round, error: roundError } = await supabaseAdmin
    .from('Round')
    .select('Round_Number')
    .eq('Round_ID', triggerRoundId)
    .maybeSingle();
  if (roundError) {
    throw roundError;
  }
  return Number((round as { Round_Number?: number } | null)?.Round_Number ?? 0) + 1;
}

function chooseWinner(userIds: string[]) {
  if (!userIds.length) {
    return null;
  }
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return userIds[bytes[0] % userIds.length];
}

async function updateRound(roundId: string, changes: Partial<RoundRecord>) {
  const { data, error } = await supabaseAdmin.from('Round').update(changes).eq('Round_ID', roundId).select('*').single();
  if (error) {
    throw error;
  }
  return data as RoundRecord;
}

async function getRoundById(roundId: string) {
  const { data, error } = await supabaseAdmin.from('Round').select('*').eq('Round_ID', roundId).single();
  if (error) {
    throw error;
  }
  return data as RoundRecord;
}

async function claimOpenRoundForFinalization(roundId: string) {
  const { data, error } = await supabaseAdmin
    .from('Round')
    .update({ Status: 'Locked' })
    .eq('Round_ID', roundId)
    .eq('Status', 'Open')
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as RoundRecord | null;
}

async function createPendingPayout(winnerId: string, round: RoundRecord, amount: number) {
  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .insert({
      User_ID: winnerId,
      Round_ID: round.Round_ID,
      Amount: amount,
      Type: 'Payout',
      Payment_Method: 'MockUSSD',
      Gateway_Ref: `PAYOUT-${Math.floor(100000 + Math.random() * 900000)}`,
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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundDeadlineFromObligations(obligations: Array<{ due_at: string | null }>) {
  const dueTimes = obligations
    .map(obligation => obligation.due_at)
    .filter((value): value is string => !!value)
    .map(value => new Date(value).getTime())
    .filter(value => Number.isFinite(value));
  if (!dueTimes.length) {
    return null;
  }
  return new Date(Math.min(...dueTimes));
}

async function loadGroupVestingEnabled(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_requests')
    .select('vesting_enabled')
    .eq('approved_group_id', groupId)
    .eq('status', 'Approved')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  // Legacy MVP groups do not have a Phase 2 formation request, so preserve their full-payout behavior.
  return Boolean((data?.[0] as { vesting_enabled?: boolean } | undefined)?.vesting_enabled);
}

async function sumWinnerContributionsSoFar(group: GroupRecord, round: RoundRecord, winnerId: string) {
  const { data: rounds, error: roundsError } = await supabaseAdmin
    .from('Round')
    .select('Round_ID')
    .eq('Group_ID', group.Group_ID)
    .lte('Round_Number', round.Round_Number);

  if (roundsError) {
    throw roundsError;
  }

  const roundIds = (rounds ?? []).map(item => (item as { Round_ID: string }).Round_ID);
  if (!roundIds.length) {
    return 0;
  }

  const { data: transactions, error: transactionsError } = await supabaseAdmin
    .from('Transaction')
    .select('Amount')
    .eq('User_ID', winnerId)
    .eq('Type', 'Contribution')
    .eq('Status', 'Successful')
    .in('Round_ID', roundIds);

  if (transactionsError) {
    throw transactionsError;
  }

  const total = (transactions ?? []).reduce((sum, item) => sum + Number((item as { Amount: number }).Amount), 0);
  return roundMoney(total);
}

async function createPayoutRequest(input: {
  group: GroupRecord;
  round: RoundRecord;
  winnerId: string;
  totalPayoutAmount: number;
  immediateReleaseAmount: number;
  reservedAmount: number;
}) {
  const { data, error } = await supabaseAdmin
    .from('payout_requests')
    .insert({
      group_id: input.group.Group_ID,
      round_id: input.round.Round_ID,
      winner_user_id: input.winnerId,
      total_payout_amount: input.totalPayoutAmount,
      immediate_release_amount: input.immediateReleaseAmount,
      reserved_amount: input.reservedAmount,
      currency: 'ETB',
      status: input.reservedAmount > 0 && input.immediateReleaseAmount > 0 ? 'PartiallyReleased' : 'Pending',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as PayoutRequestRecord;
}

async function createPayoutReleaseSchedules(input: {
  payoutRequest: PayoutRequestRecord;
  group: GroupRecord;
  round: RoundRecord;
  winnerId: string;
  remainingContributionCount: number;
}) {
  const amounts = buildPayoutReleaseScheduleAmounts(Number(input.payoutRequest.reserved_amount), input.remainingContributionCount);
  if (!amounts.length) {
    return [] as PayoutReleaseScheduleRecord[];
  }

  const { data, error } = await supabaseAdmin
    .from('payout_release_schedules')
    .insert(amounts.map(amount => ({
      payout_request_id: input.payoutRequest.id,
      user_id: input.winnerId,
      group_id: input.group.Group_ID,
      round_id: input.round.Round_ID,
      trigger_obligation_id: null,
      release_amount: roundMoney(amount),
      currency: 'ETB',
      status: 'Pending',
    })))
    .select('*');

  if (error) {
    throw error;
  }
  return (data ?? []) as PayoutReleaseScheduleRecord[];
}

async function recordPayoutRequestLedger(input: {
  payoutRequest: PayoutRequestRecord;
  group: GroupRecord;
  round: RoundRecord;
  winnerId: string;
  payoutTransaction: TransactionRecord | null;
  scheduleCount: number;
  vestingReason: string;
}) {
  const common = {
    userId: input.winnerId,
    groupId: input.group.Group_ID,
    roundId: input.round.Round_ID,
    payoutRequestId: input.payoutRequest.id,
    referenceType: 'payout_requests',
    referenceId: input.payoutRequest.id,
  };

  await recordLedgerEntry({
    ...common,
    entryType: 'PayoutRequestCreated',
    direction: 'Memo',
    amount: Number(input.payoutRequest.total_payout_amount),
    description: 'Phase 2 payout request created after round draw.',
    metadata: {
      immediate_release_amount: input.payoutRequest.immediate_release_amount,
      reserved_amount: input.payoutRequest.reserved_amount,
      status: input.payoutRequest.status,
      vesting_reason: input.vestingReason,
    },
  });

  if (Number(input.payoutRequest.immediate_release_amount) > 0) {
    await recordLedgerEntry({
      ...common,
      transactionId: input.payoutTransaction?.Trans_ID,
      entryType: 'PayoutReleased',
      direction: 'Credit',
      amount: Number(input.payoutRequest.immediate_release_amount),
      description: 'Immediate payout amount released to the MVP pending payout wallet.',
      metadata: {
        transaction_id: input.payoutTransaction?.Trans_ID ?? null,
        gateway_reference: input.payoutTransaction?.Gateway_Ref ?? null,
      },
    });
  }

  if (Number(input.payoutRequest.reserved_amount) > 0) {
    await recordLedgerEntry({
      ...common,
      entryType: 'PayoutReserved',
      direction: 'Memo',
      amount: Number(input.payoutRequest.reserved_amount),
      description: 'Reserved payout amount withheld for future maturity releases.',
      metadata: {
        schedule_count: input.scheduleCount,
        vesting_reason: input.vestingReason,
      },
    });
  }
}

async function releaseExitedWinnerReserves(group: GroupRecord, triggerRound: RoundRecord) {
  const { data, error } = await supabaseAdmin
    .from('payout_release_schedules')
    .select('user_id')
    .eq('group_id', group.Group_ID)
    .eq('status', 'Pending');
  if (error) {
    throw error;
  }
  const candidateUserIds = [...new Set((data ?? []).map(item => (item as { user_id: string }).user_id))];
  if (!candidateUserIds.length) {
    return [];
  }
  const { data: activeMemberships, error: membershipError } = await supabaseAdmin
    .from('GroupMembers')
    .select('User_ID')
    .eq('Group_ID', group.Group_ID)
    .eq('Status', 'Active')
    .in('User_ID', candidateUserIds);
  if (membershipError) {
    throw membershipError;
  }
  const activeUserIds = new Set((activeMemberships ?? []).map(item => (item as { User_ID: string }).User_ID));
  const exitedUserIds = candidateUserIds.filter(userId => !activeUserIds.has(userId));
  const releases = await Promise.all(exitedUserIds.map(userId => releaseNextReservedPayoutForGroupRound({
    userId,
    groupId: group.Group_ID,
    triggerRound,
    reason: 'Reserved payout released on a later completed round after winner exit.',
  })));
  return releases.filter(Boolean);
}

export async function finalizeRoundIfReady(group: GroupRecord, round: RoundRecord): Promise<RoundCompletionResult> {
  const memberships = await listActiveMemberships(group.Group_ID);
  await ensureContributionObligationsForRound(group, round);
  const readiness = await getRoundObligationReadiness(round.Round_ID);
  const activeMemberIds = new Set(memberships.map(item => item.User_ID));
  const settledObligationUserIds = new Set(
    readiness.obligations
      .filter(obligation => activeMemberIds.has(obligation.user_id))
      .filter(obligation => isContributionObligationSettled(obligation.status))
      .map(obligation => obligation.user_id),
  );
  const allActiveMembersSettled = memberships.length > 0 && memberships.every(membership => settledObligationUserIds.has(membership.User_ID));

  if (!allActiveMembersSettled) {
    return {
      autoDrawTriggered: false,
      payoutAmount: 0,
      payoutRequest: null,
      payoutTransaction: null,
      payoutReleaseSchedules: [],
      nextRound: null,
      updatedRound: round,
      completedGroup: null,
      reliabilityProfileUpdates: [],
    };
  }

  const roundDeadline = roundDeadlineFromObligations(readiness.obligations);
  if (roundDeadline && roundDeadline.getTime() > Date.now()) {
    return {
      autoDrawTriggered: false,
      payoutAmount: 0,
      payoutRequest: null,
      payoutTransaction: null,
      payoutReleaseSchedules: [],
      nextRound: null,
      updatedRound: round,
      completedGroup: null,
      reliabilityProfileUpdates: [],
    };
  }

  const lockedRound = await claimOpenRoundForFinalization(round.Round_ID);
  if (!lockedRound) {
    return {
      autoDrawTriggered: false,
      payoutAmount: 0,
      payoutRequest: null,
      payoutTransaction: null,
      payoutReleaseSchedules: [],
      nextRound: null,
      updatedRound: await getRoundById(round.Round_ID),
      completedGroup: null,
      reliabilityProfileUpdates: [],
    };
  }
  const currentPassStartRound = await getCurrentPassStartRoundNumber(group.Group_ID);
  const priorWinnerIds = await listPriorWinnerIds(group.Group_ID, currentPassStartRound);
  const firstPassEligibleUserIds = memberships
    .map(item => item.User_ID)
    .filter(userId => settledObligationUserIds.has(userId))
    .filter(userId => !priorWinnerIds.has(userId));
  const eligibleUserIds = firstPassEligibleUserIds.length
    ? firstPassEligibleUserIds
    : memberships
      .map(item => item.User_ID)
      .filter(userId => settledObligationUserIds.has(userId));

  const winnerId = chooseWinner(eligibleUserIds);
  if (!winnerId) {
    throw new Error('No eligible winner could be derived for this completed round.');
  }

  const payoutAmount = roundMoney(Number(group.Amount) * memberships.length);
  const vestingEnabled = await loadGroupVestingEnabled(group.Group_ID);
  const vestingRoundCount = memberships.length;
  const currentPassWinnerCount = memberships.filter(membership => priorWinnerIds.has(membership.User_ID)).length;
  const vestingRoundNumber = firstPassEligibleUserIds.length
    ? Math.min(vestingRoundCount, currentPassWinnerCount + 1)
    : vestingRoundCount;
  const remainingCurrentPassWinners = firstPassEligibleUserIds.length
    ? firstPassEligibleUserIds.filter(userId => userId !== winnerId).length
    : Math.max(vestingRoundCount - vestingRoundNumber, 0);
  const winnerProfile = await ensureReliabilityProfile(winnerId);
  const personalContributedSoFar = await sumWinnerContributionsSoFar(group, round, winnerId);
  const payoutVesting = await calculatePayoutVestingFromConfig({
    winnerStatus: winnerProfile.public_status,
    roundNumber: vestingRoundNumber,
    totalRounds: vestingRoundCount,
    totalPayoutAmount: payoutAmount,
    personalContributedSoFar,
    vestingEnabled,
  });

  const completedRound = await updateRound(round.Round_ID, {
    Winner_ID: winnerId,
    Draw_Date: new Date().toISOString(),
    Status: 'Completed',
  });

  const cycleComplete = firstPassEligibleUserIds.length <= 1 && firstPassEligibleUserIds.includes(winnerId);
  const payoutRequest = await createPayoutRequest({
    group,
    round: completedRound,
    winnerId,
    totalPayoutAmount: roundMoney(payoutVesting.totalPayoutAmount),
    immediateReleaseAmount: roundMoney(payoutVesting.immediateReleaseAmount),
    reservedAmount: roundMoney(payoutVesting.reservedAmount),
  });
  const payoutTransaction = payoutVesting.immediateReleaseAmount > 0
    ? await createPendingPayout(winnerId, completedRound, roundMoney(payoutVesting.immediateReleaseAmount))
    : null;
  const payoutReleaseSchedules = await createPayoutReleaseSchedules({
    payoutRequest,
    group,
    round: completedRound,
    winnerId,
    remainingContributionCount: remainingCurrentPassWinners,
  });
  await recordPayoutRequestLedger({
    payoutRequest,
    group,
    round: completedRound,
    winnerId,
    payoutTransaction,
    scheduleCount: payoutReleaseSchedules.length,
    vestingReason: payoutVesting.reason,
  });
  await releaseExitedWinnerReserves(group, completedRound);

  if (cycleComplete) {
    await openCycleCompletionVote({
      group,
      roundId: completedRound.Round_ID,
      activeMemberIds: [...activeMemberIds],
    });
    return {
      autoDrawTriggered: true,
      payoutAmount,
      payoutRequest,
      payoutTransaction,
      payoutReleaseSchedules,
      nextRound: null,
      updatedRound: completedRound,
      completedGroup: null,
      reliabilityProfileUpdates: [],
    };
  }

  await openWinnerExitWindow({
    group,
    round: completedRound,
    winnerId,
    payoutRequest,
  });
  return {
    autoDrawTriggered: true,
    payoutAmount,
    payoutRequest,
    payoutTransaction,
    payoutReleaseSchedules,
    nextRound: null,
    updatedRound: completedRound,
    completedGroup: null,
    reliabilityProfileUpdates: [],
  };
}
