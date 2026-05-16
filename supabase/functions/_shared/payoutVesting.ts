import { loadAppConfig } from './config.ts';
import type { ReliabilityPublicStatus, UserReliabilityProfileRecord } from './types.ts';

export interface PayoutVestingInput {
  winnerStatus: ReliabilityPublicStatus;
  roundNumber: number;
  totalRounds: number;
  totalPayoutAmount: number;
  personalContributedSoFar: number;
  vestingEnabled: boolean;
  firstCycleReleaseRatio?: number;
  minimumImmediatePayoutAmount?: number;
  roundingStrategy?: 'floor' | 'round' | 'ceil';
}

export interface PayoutVestingResult {
  totalPayoutAmount: number;
  immediateReleaseAmount: number;
  reservedAmount: number;
  vestingApplied: boolean;
  reason: string;
}

function roundAmount(value: number, strategy: 'floor' | 'round' | 'ceil') {
  switch (strategy) {
    case 'ceil':
      return Math.ceil(value);
    case 'round':
      return Math.round(value);
    case 'floor':
    default:
      return Math.floor(value);
  }
}

function clampMoney(value: number, max: number) {
  return Math.max(0, Math.min(value, max));
}

export function isProbationaryPayoutStatus(status: ReliabilityPublicStatus) {
  return status === 'New' || status === 'BuildingTrust';
}

function strictFirstCycleImmediateCap(personalContributedSoFar: number) {
  const contributed = Math.max(0, personalContributedSoFar);
  if (contributed <= 0) {
    return 0;
  }
  return Math.max(0, Math.floor(contributed) - 1);
}

export function calculatePayoutVesting(input: PayoutVestingInput): PayoutVestingResult {
  if (input.totalPayoutAmount <= 0) {
    throw new Error('Total payout amount must be positive.');
  }
  if (input.roundNumber <= 0 || input.totalRounds <= 0) {
    throw new Error('Round numbers must be positive.');
  }
  if (input.roundNumber > input.totalRounds) {
    throw new Error('Round number cannot exceed total rounds.');
  }

  if (!input.vestingEnabled) {
    return {
      totalPayoutAmount: input.totalPayoutAmount,
      immediateReleaseAmount: input.totalPayoutAmount,
      reservedAmount: 0,
      vestingApplied: false,
      reason: 'Vesting disabled for this approved group.',
    };
  }

  if (input.winnerStatus === 'Restricted' || input.winnerStatus === 'Banned') {
    throw new Error('Restricted or banned users cannot receive normal payout maturity release.');
  }

  if (input.roundNumber === input.totalRounds || input.winnerStatus === 'Trusted') {
    return {
      totalPayoutAmount: input.totalPayoutAmount,
      immediateReleaseAmount: input.totalPayoutAmount,
      reservedAmount: 0,
      vestingApplied: false,
      reason: input.roundNumber === input.totalRounds ? 'Final-round winner receives full payout.' : 'Trusted winner receives full payout.',
    };
  }

  const releaseRatio = input.firstCycleReleaseRatio ?? 0.8;
  if (releaseRatio <= 0 || releaseRatio >= 1) {
    throw new Error('First-cycle payout release ratio must be greater than 0 and less than 1.');
  }

  const strategy = input.roundingStrategy ?? 'floor';
  const minimumImmediate = input.minimumImmediatePayoutAmount ?? 0;
  const personalContributionCap = Math.max(0, input.personalContributedSoFar);
  const releaseFromContribution = roundAmount(personalContributionCap * releaseRatio, strategy);
  const strictImmediateCap = isProbationaryPayoutStatus(input.winnerStatus)
    ? strictFirstCycleImmediateCap(personalContributionCap)
    : personalContributionCap;
  const immediateReleaseAmount = clampMoney(
    Math.max(minimumImmediate, releaseFromContribution),
    Math.min(input.totalPayoutAmount, strictImmediateCap),
  );

  return {
    totalPayoutAmount: input.totalPayoutAmount,
    immediateReleaseAmount,
    reservedAmount: input.totalPayoutAmount - immediateReleaseAmount,
    vestingApplied: immediateReleaseAmount < input.totalPayoutAmount,
    reason: `${input.winnerStatus} early winner payout is split into immediate release plus reserve.`,
  };
}

export function calculatePayoutVestingForProfile(
  profile: UserReliabilityProfileRecord,
  input: Omit<PayoutVestingInput, 'winnerStatus'>,
) {
  return calculatePayoutVesting({
    ...input,
    winnerStatus: profile.public_status,
  });
}

export async function calculatePayoutVestingFromConfig(input: Omit<PayoutVestingInput, 'firstCycleReleaseRatio' | 'minimumImmediatePayoutAmount' | 'roundingStrategy'>) {
  const config = await loadAppConfig();
  const ratio = typeof config.first_cycle_payout_release_ratio === 'number'
    ? config.first_cycle_payout_release_ratio
    : 0.8;
  const minimum = typeof config.minimum_immediate_payout_amount === 'number'
    ? config.minimum_immediate_payout_amount
    : 0;
  const rounding = config.payout_rounding_strategy === 'ceil' || config.payout_rounding_strategy === 'round'
    ? config.payout_rounding_strategy
    : 'floor';

  return calculatePayoutVesting({
    ...input,
    firstCycleReleaseRatio: ratio,
    minimumImmediatePayoutAmount: minimum,
    roundingStrategy: rounding,
  });
}

export function buildPayoutReleaseScheduleAmounts(reservedAmount: number, remainingContributionCount: number) {
  if (reservedAmount <= 0 || remainingContributionCount <= 0) {
    return [];
  }

  const baseAmount = Math.floor(reservedAmount / remainingContributionCount);
  const remainder = reservedAmount - baseAmount * remainingContributionCount;
  return Array.from({ length: remainingContributionCount }, (_unused, index) => (
    index === remainingContributionCount - 1 ? baseAmount + remainder : baseAmount
  )).filter(amount => amount > 0);
}
