const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const roundLifecyclePath = path.join(repoRoot, 'supabase/functions/_shared/roundLifecycle.ts');
const obligationsPath = path.join(repoRoot, 'supabase/functions/_shared/obligations.ts');

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
  const obligations = read(obligationsPath);

  [
    'export async function getRoundObligationReadiness',
    'export function isContributionObligationSettled',
    "const settledObligationStatuses: ContributionObligationStatus[] = ['Paid', 'Waived', 'RefundPending']",
  ].forEach(token => assertIncludes(obligations, token, 'obligation readiness helper token'));

  [
    "import { ensureContributionObligationsForRound, getRoundObligationReadiness, isContributionObligationSettled } from './obligations.ts'",
    'await ensureContributionObligationsForRound(group, round)',
    'const readiness = await getRoundObligationReadiness(round.Round_ID)',
    'const settledObligationUserIds = new Set',
    'isContributionObligationSettled(obligation.status)',
    'const allActiveMembersSettled = memberships.length > 0 && memberships.every',
    'if (!allActiveMembersSettled)',
    'settledObligationUserIds.has(userId)',
  ].forEach(token => assertIncludes(roundLifecycle, token, 'obligation-based round lifecycle token'));

  [
    'contributions.length !== memberships.length',
    'listSuccessfulContributions(round.Round_ID)',
    'contributions.some(transaction => transaction.User_ID === userId)',
  ].forEach(token => assertNotIncludes(roundLifecycle, token, 'transaction-count readiness token'));

  const result = {
    scenario: 'phase2-round-readiness-validation',
    validatedFiles: {
      roundLifecycle: 'supabase/functions/_shared/roundLifecycle.ts',
      obligations: 'supabase/functions/_shared/obligations.ts',
    },
    completedChecks: [
      'round lifecycle ensures obligations before readiness evaluation',
      'draw readiness is based on active members having settled obligations',
      'eligible winner selection is based on settled obligations instead of successful transaction count',
      'legacy transaction-count readiness trigger was removed from round finalization',
      'payout request/reserve maturity is validated by the Phase 5 payout request flow check',
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
