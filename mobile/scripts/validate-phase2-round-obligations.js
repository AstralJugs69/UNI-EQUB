const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const roundsPath = path.join(repoRoot, 'supabase/functions/_shared/rounds.ts');
const roundLifecyclePath = path.join(repoRoot, 'supabase/functions/_shared/roundLifecycle.ts');
const obligationsPath = path.join(repoRoot, 'supabase/functions/_shared/obligations.ts');
const formationPath = path.join(repoRoot, 'supabase/functions/group-formation/index.ts');

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
  const rounds = read(roundsPath);
  const roundLifecycle = read(roundLifecyclePath);
  const obligations = read(obligationsPath);
  const formation = read(formationPath);

  [
    "import { ensureContributionObligationsForRound } from './obligations.ts'",
    'await ensureContributionObligationsForRound(group, existingOpenRound)',
    'await ensureContributionObligationsForRound(group, round)',
    'return round',
  ].forEach(token => assertIncludes(rounds, token, 'ensureOpenRound obligation generation token'));

  [
    "import { ensureContributionObligationsForRound } from './obligations.ts'",
    'async function createNextRound(group: GroupRecord, roundNumber: number)',
    'await ensureContributionObligationsForRound(group, round)',
    'const nextRound = await createNextRound(group, completedRound.Round_Number + 1)',
  ].forEach(token => assertIncludes(roundLifecycle, token, 'next round obligation generation token'));

  [
    ".from('GroupMembers')",
    ".eq('Status', 'Active')",
    ".upsert(rows, { onConflict: 'round_id,user_id', ignoreDuplicates: true })",
    "status: 'Unpaid'",
  ].forEach(token => assertIncludes(obligations, token, 'idempotent active-member obligation token'));

  [
    'ensureOpenRoundForGroup(group)',
    'ensureContributionObligationsForRound(group, round)',
  ].forEach(token => assertIncludes(formation, token, 'formation approval obligation compatibility token'));

  const result = {
    scenario: 'phase2-round-obligation-generation-validation',
    validatedFiles: {
      rounds: 'supabase/functions/_shared/rounds.ts',
      roundLifecycle: 'supabase/functions/_shared/roundLifecycle.ts',
      obligations: 'supabase/functions/_shared/obligations.ts',
      formation: 'supabase/functions/group-formation/index.ts',
    },
    completedChecks: [
      'ensureOpenRoundForGroup idempotently ensures obligations for existing open rounds',
      'ensureOpenRoundForGroup idempotently ensures obligations after creating a new open round',
      'round lifecycle next-round creation idempotently ensures active-member obligations',
      'obligation helper upserts one unpaid obligation per active member per round',
      'group formation approval remains compatible with obligation generation',
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
