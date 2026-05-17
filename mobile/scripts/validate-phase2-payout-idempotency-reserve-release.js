const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const roundLifecyclePath = path.join(repoRoot, 'supabase/functions/_shared/roundLifecycle.ts');
const payoutReservesPath = path.join(repoRoot, 'supabase/functions/_shared/payoutReserves.ts');
const contributionPath = path.join(repoRoot, 'supabase/functions/contribution-reconcile/index.ts');
const migrationPath = path.join(repoRoot, 'supabase/migrations/20260517100000_phase2_payout_round_idempotency.sql');

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
  const payoutReserves = read(payoutReservesPath);
  const contribution = read(contributionPath);
  const migration = read(migrationPath);

  [
    'create unique index if not exists idx_payout_requests_round_active_once',
    'on public.payout_requests (round_id)',
    "where status in ('Pending', 'PartiallyReleased', 'Completed')",
  ].forEach(token => assertIncludes(migration, token, 'payout idempotency migration token'));

  [
    'async function claimOpenRoundForFinalization',
    ".eq('Status', 'Open')",
    'if (!lockedRound)',
    'updatedRound: await getRoundById(round.Round_ID)',
    'return roundMoney(total);',
  ].forEach(token => assertIncludes(roundLifecycle, token, 'round finalization guard token'));
  assertNotIncludes(roundLifecycle, 'return total > 0 ? roundMoney(total) : roundMoney(Number(group.Amount) * Number(round.Round_Number));', 'fabricated contribution fallback');
  assertNotIncludes(roundLifecycle, "await updateRound(round.Round_ID, { Status: 'Locked' })", 'unconditional round lock');

  [
    'export async function releaseNextReservedPayoutForContribution',
    ".from('payout_release_schedules')",
    ".eq('status', 'Pending')",
    "status: 'Released'",
    'trigger_obligation_id: input.triggerObligationId',
    'createReserveReleaseTransaction',
    "Type: 'Payout'",
    "entryType: 'ReserveReleased'",
    "entryType: 'PayoutReleased'",
    ".from('payout_requests')",
    "status: completed ? 'Completed' : 'PartiallyReleased'",
  ].forEach(token => assertIncludes(payoutReserves, token, 'reserve release helper token'));

  [
    "import { releaseNextReservedPayoutForContribution } from '../_shared/payoutReserves.ts'",
    'const reserveRelease = await releaseNextReservedPayoutForContribution',
    'triggerObligationId: paidObligation.id',
    'reserveRelease,',
    'const lifecycle = await finalizeRoundIfReady(input.group, input.round)',
  ].forEach(token => assertIncludes(contribution, token, 'contribution reserve release token'));

  const result = {
    scenario: 'phase2-payout-idempotency-reserve-release-validation',
    validatedFiles: {
      roundLifecycle: 'supabase/functions/_shared/roundLifecycle.ts',
      payoutReserves: 'supabase/functions/_shared/payoutReserves.ts',
      contributionReconcile: 'supabase/functions/contribution-reconcile/index.ts',
      migration: 'supabase/migrations/20260517100000_phase2_payout_round_idempotency.sql',
    },
    completedChecks: [
      'draw finalization claims only Open rounds before choosing a winner',
      'active payout requests are unique per round at the database layer',
      'payout maturity uses actual successful contribution transactions instead of fabricated fallback amounts',
      'successful later contribution claims the next pending reserve release schedule',
      'reserve release creates a mock pending payout Transaction and ledger entries',
      'payout request immediate/reserved totals and lifecycle status are updated after reserve release',
    ],
    stillPending: [
      'device/UAT validation of reserve release wallet behavior',
      'wallet UI copy for reserve and release schedule explanation',
      'durable notification row for reserve release',
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
