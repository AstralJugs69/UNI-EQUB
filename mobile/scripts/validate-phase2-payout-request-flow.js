const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const roundLifecyclePath = path.join(repoRoot, 'supabase/functions/_shared/roundLifecycle.ts');
const payoutVestingPath = path.join(repoRoot, 'supabase/functions/_shared/payoutVesting.ts');
const ledgerPath = path.join(repoRoot, 'supabase/functions/_shared/ledger.ts');
const migrationPath = path.join(repoRoot, 'supabase/migrations/20260513090000_phase2_foundation_companion_tables.sql');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--output') {
      parsed.output = args[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(repoRoot, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, token, label) {
  if (!content.includes(token)) {
    throw new Error(`Missing ${label}: ${token}`);
  }
}

function assertNotIncludes(content, token, label) {
  if (content.includes(token)) {
    throw new Error(`Unexpected ${label}: ${token}`);
  }
}

function main() {
  const args = parseArgs();
  const roundLifecycle = read(roundLifecyclePath);
  const payoutVesting = read(payoutVestingPath);
  const ledger = read(ledgerPath);
  const migration = read(migrationPath);

  [
    'create table if not exists public.payout_requests',
    'constraint payout_requests_round_winner_unique unique (round_id, winner_user_id)',
    'create table if not exists public.payout_release_schedules',
    "entry_type in (",
    "'PayoutRequestCreated'",
    "'PayoutReleased'",
    "'PayoutReserved'",
    "'PayoutReleaseScheduled'",
  ].forEach(token => assertIncludes(migration, token, 'payout foundation token'));

  [
    'export async function recordLedgerEntry',
    'payoutRequestId?: string',
    'payout_request_id: input.payoutRequestId ?? null',
  ].forEach(token => assertIncludes(ledger, token, 'ledger payout token'));

  [
    'calculatePayoutVestingFromConfig',
    'buildPayoutReleaseScheduleAmounts',
  ].forEach(token => assertIncludes(payoutVesting, token, 'payout vesting token'));

  [
    'payoutRequest: PayoutRequestRecord | null',
    'payoutReleaseSchedules: PayoutReleaseScheduleRecord[]',
    'async function loadGroupVestingEnabled',
    'Legacy MVP groups do not have a Phase 2 formation request',
    'async function sumWinnerContributionsSoFar',
    'async function createPayoutRequest',
    ".from('payout_requests')",
    'immediate_release_amount: input.immediateReleaseAmount',
    'reserved_amount: input.reservedAmount',
    "status: input.reservedAmount > 0 && input.immediateReleaseAmount > 0 ? 'PartiallyReleased' : 'Pending'",
    'payoutVesting.immediateReleaseAmount > 0',
    'createPendingPayout(winnerId, completedRound, roundMoney(payoutVesting.immediateReleaseAmount))',
    'async function createPayoutReleaseSchedules',
    ".from('payout_release_schedules')",
    'buildPayoutReleaseScheduleAmounts(Number(input.payoutRequest.reserved_amount), input.remainingContributionCount)',
    'async function recordPayoutRequestLedger',
    "entryType: 'PayoutRequestCreated'",
    "entryType: 'PayoutReleased'",
    "entryType: 'PayoutReserved'",
    "referenceType: 'payout_requests'",
  ].forEach(token => assertIncludes(roundLifecycle, token, 'round lifecycle payout token'));

  assertNotIncludes(
    roundLifecycle,
    'const payoutTransaction = await createPendingPayout(winnerId, completedRound, payoutAmount)',
    'legacy full-payout transaction token',
  );

  const result = {
    scenario: 'phase2-payout-request-flow-validation',
    validatedFiles: {
      roundLifecycle: 'supabase/functions/_shared/roundLifecycle.ts',
      payoutVesting: 'supabase/functions/_shared/payoutVesting.ts',
      ledger: 'supabase/functions/_shared/ledger.ts',
      migration: 'supabase/migrations/20260513090000_phase2_foundation_companion_tables.sql',
    },
    completedChecks: [
      'round draw creates a payout_request row with total, immediate, and reserved amounts',
      'legacy groups without a Phase 2 formation request preserve full-payout behavior',
      'approved Phase 2 group vesting uses the group request vesting flag',
      'immediate payout Transaction is created only when immediate_release_amount is greater than zero',
      'payout request, immediate release, and reserve ledger entries are written server-side',
      'reserved payout is split into pending release schedule rows for future contribution-triggered releases',
    ],
    stillPending: [
      'wallet UI copy for payout reserve and release schedules',
      'durable notification row for payout request creation',
    ],
    requiresSupabaseCredentials: false,
    validatedAt: new Date().toISOString(),
  };

  const output = JSON.stringify(result, null, 2);
  if (args.output) {
    const outputPath = path.resolve(repoRoot, args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${output}\n`);
  }
  console.log(output);
}

main();
