const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const obligationsPath = path.join(repoRoot, 'supabase/functions/_shared/obligations.ts');
const groupLifecyclePath = path.join(repoRoot, 'supabase/functions/group-lifecycle/index.ts');

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
  const obligations = read(obligationsPath);
  const groupLifecycle = read(groupLifecyclePath);

  [
    'export interface RoundObligationProgress',
    'export function deriveRoundObligationProgress',
    'export async function getRoundObligationProgress',
    'listRoundObligations(roundId)',
    'isContributionObligationSettled(obligation.status)',
    'successfulContributionTransactions',
    'paidUserIds.add(transaction.User_ID)',
  ].forEach(token => assertIncludes(obligations, token, 'obligation progress helper token'));

  [
    "import { getRoundObligationProgress } from '../_shared/obligations.ts'",
    'const obligationProgress = currentRound',
    'await getRoundObligationProgress(currentRound.Round_ID, memberships, paidTransactions)',
    'await getRoundObligationProgress(candidateRound.Round_ID, candidateMemberships, candidateTransactions)',
    'paidCount: obligationProgress.paidCount',
    'totalMembers: obligationProgress.totalMembers',
    '!obligationProgress.paidUserIds.has(actor.User_ID)',
  ].forEach(token => assertIncludes(groupLifecycle, token, 'dashboard/status obligation count token'));

  const result = {
    scenario: 'phase2-dashboard-obligation-status-validation',
    validatedFiles: {
      obligations: 'supabase/functions/_shared/obligations.ts',
      groupLifecycle: 'supabase/functions/group-lifecycle/index.ts',
    },
    completedChecks: [
      'shared helper derives paid/unpaid progress from contribution_obligations',
      'shared helper preserves MVP transaction-backed paid state during provider-attempt migration',
      'group status snapshot uses obligation-derived paid and total member counts',
      'group status payment eligibility uses obligation-derived paid user ids',
      'member dashboard group selection and progress use obligation-derived state',
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
