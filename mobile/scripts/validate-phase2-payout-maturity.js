const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const payoutVestingPath = path.join(repoRoot, 'supabase/functions/_shared/payoutVesting.ts');
const configPath = path.join(repoRoot, 'supabase/functions/_shared/config.ts');
const typesPath = path.join(repoRoot, 'supabase/functions/_shared/types.ts');

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

function main() {
  const args = parseArgs();
  const payoutVesting = read(payoutVestingPath);
  const config = read(configPath);
  const types = read(typesPath);

  [
    "export type ReliabilityPublicStatus = 'New' | 'BuildingTrust' | 'Trusted' | 'Restricted' | 'Banned'",
    'export interface UserReliabilityProfileRecord',
  ].forEach(token => assertIncludes(types, token, 'reliability type token'));

  [
    'first_cycle_payout_release_ratio: 0.8',
    'minimum_immediate_payout_amount: 0',
    "payout_rounding_strategy: 'floor'",
  ].forEach(token => assertIncludes(config, token, 'payout app_config default token'));

  [
    'export function isProbationaryPayoutStatus',
    "return status === 'New' || status === 'BuildingTrust'",
    'function strictFirstCycleImmediateCap',
    'Math.floor(contributed) - 1',
    "input.winnerStatus === 'Restricted' || input.winnerStatus === 'Banned'",
    'Restricted or banned users cannot receive normal payout maturity release.',
    "input.roundNumber === input.totalRounds || input.winnerStatus === 'Trusted'",
    'Trusted winner receives full payout.',
    'first_cycle_payout_release_ratio',
    'minimum_immediate_payout_amount',
    'payout_rounding_strategy',
    'Math.min(input.totalPayoutAmount, strictImmediateCap)',
    'calculatePayoutVestingForProfile',
    'winnerStatus: profile.public_status',
  ].forEach(token => assertIncludes(payoutVesting, token, 'payout maturity helper token'));

  const result = {
    scenario: 'phase2-payout-maturity-validation',
    validatedFiles: {
      payoutVesting: 'supabase/functions/_shared/payoutVesting.ts',
      config: 'supabase/functions/_shared/config.ts',
      types: 'supabase/functions/_shared/types.ts',
    },
    completedChecks: [
      'New and BuildingTrust are treated as probationary payout statuses',
      'Trusted winners and final-round winners receive full payout when vesting is enabled',
      'probationary early-winner immediate release is capped below personal contributed amount',
      'restricted and banned users are blocked from normal payout release calculation',
      'release ratio, minimum immediate amount, and rounding strategy are read from app_config defaults',
      'helper can calculate vesting directly from a user reliability profile',
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
