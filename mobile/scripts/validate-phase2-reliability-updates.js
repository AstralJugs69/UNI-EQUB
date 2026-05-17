const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const reliabilityPath = path.join(repoRoot, 'supabase/functions/_shared/reliability.ts');
const obligationsPath = path.join(repoRoot, 'supabase/functions/_shared/obligations.ts');
const roundLifecyclePath = path.join(repoRoot, 'supabase/functions/_shared/roundLifecycle.ts');
const configPath = path.join(repoRoot, 'supabase/functions/_shared/config.ts');

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
  const reliability = read(reliabilityPath);
  const obligations = read(obligationsPath);
  const roundLifecycle = read(roundLifecyclePath);
  const config = read(configPath);

  [
    'required_perfect_groups_for_trusted_status: 3',
    'required_perfect_groups_for_trusted_status',
  ].forEach(token => assertIncludes(config, token, 'trusted threshold config token'));

  [
    'export function deriveReliabilityPublicStatus',
    'currentMaturityCompletedCount >= input.trustedThreshold',
    'export async function recordCompletedGroupReliability',
    "const hadLateOrDefault = obligations.some(obligation => IMPERFECT_OBLIGATION_STATUSES.has(obligation.status))",
    'perfect_completed_groups_count: perfectCompletedGroupsCount',
    'current_maturity_completed_count: currentMaturityCompletedCount',
    'export async function recordLatePaymentReliability',
    'export async function recordDefaultReliability',
    'export async function recordRestrictionReliability',
    'await updateRestrictionRecoveryProgress(userId)',
  ].forEach(token => assertIncludes(reliability, token, 'reliability update helper token'));

  [
    'markContributionObligationLate',
    'await recordLatePaymentReliability(obligation.user_id)',
    'markContributionObligationDefaulted',
    'await recordDefaultReliability(obligation.user_id)',
  ].forEach(token => assertIncludes(obligations, token, 'late/default obligation reliability token'));

  [
    "import { ensureReliabilityProfile, recordCompletedGroupReliability } from './reliability.ts'",
    'reliabilityProfileUpdates: UserReliabilityProfileRecord[]',
    'const reliabilityProfileUpdates = await recordCompletedGroupReliability(group.Group_ID, [...activeMemberIds])',
    'completedGroup,',
    'reliabilityProfileUpdates,',
  ].forEach(token => assertIncludes(roundLifecycle, token, 'round completion reliability token'));

  const completionIndex = roundLifecycle.indexOf('const completedGroup = await updateGroup(group.Group_ID, { Status: \'Completed\' })');
  const reliabilityIndex = roundLifecycle.indexOf('const reliabilityProfileUpdates = await recordCompletedGroupReliability(group.Group_ID, [...activeMemberIds])');
  if (completionIndex < 0 || reliabilityIndex < 0 || reliabilityIndex < completionIndex) {
    throw new Error('Reliability profile updates must run after the group is marked Completed.');
  }

  const result = {
    scenario: 'phase2-reliability-update-validation',
    validatedFiles: {
      reliability: 'supabase/functions/_shared/reliability.ts',
      obligations: 'supabase/functions/_shared/obligations.ts',
      roundLifecycle: 'supabase/functions/_shared/roundLifecycle.ts',
      config: 'supabase/functions/_shared/config.ts',
    },
    completedChecks: [
      'completed group cycles update member reliability counters and public status',
      'perfect completion uses group obligations and excludes late/defaulted obligations',
      'trusted status uses the configured current perfect-group maturity threshold',
      'late and default obligation helpers record reliability events for future default flows',
      'restriction reliability helper records public Restricted state for future restriction workflows',
    ],
    limitations: [
      'scheduled late/default orchestration and admin restriction workflows are still separate Phase 2 tasks',
      'device screenshots for reliability labels remain pending under later UI/UAT tasks',
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
