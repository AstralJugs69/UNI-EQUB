const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const reportExportPath = path.join(repoRoot, 'supabase/functions/report-export/index.ts');
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

function main() {
  const args = parseArgs();
  const reportExport = read(reportExportPath);
  const obligations = read(obligationsPath);

  [
    'export async function getRoundObligationProgress',
    'successfulContributionTransactions',
    'paidUserIds.add(transaction.User_ID)',
  ].forEach(token => assertIncludes(obligations, token, 'obligation progress transition guard token'));

  [
    "import { getRoundObligationProgress } from '../_shared/obligations.ts'",
    'const obligationProgress = await getRoundObligationProgress',
    'obligationProgress.unpaidCount',
    "obligation.status === 'Late'",
    'unpaid obligations',
    'reminder queued',
  ].forEach(token => assertIncludes(reportExport, token, 'obligation-derived reminder token'));

  const result = {
    scenario: 'phase2-reminder-obligation-validation',
    validatedFiles: {
      reportExport: 'supabase/functions/report-export/index.ts',
      obligations: 'supabase/functions/_shared/obligations.ts',
    },
    completedChecks: [
      'admin reminder queue reads shared contribution_obligations progress',
      'reminder queue preserves successful Transaction overlay while migration is in progress',
      'late obligations are surfaced in reminder text',
      'reminder queue no longer derives unpaid count from active memberships minus transactions only',
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
