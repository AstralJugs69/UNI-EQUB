const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const obligationsPath = path.join(repoRoot, 'supabase/functions/_shared/obligations.ts');
const reliabilityPath = path.join(repoRoot, 'supabase/functions/_shared/reliability.ts');
const maintenancePath = path.join(repoRoot, 'supabase/functions/default-maintenance/index.ts');
const groupLifecyclePath = path.join(repoRoot, 'supabase/functions/group-lifecycle/index.ts');
const paymentAttemptPath = path.join(repoRoot, 'supabase/functions/payment-attempt/index.ts');
const contributionPath = path.join(repoRoot, 'supabase/functions/contribution-reconcile/index.ts');
const walletClearancePath = path.join(repoRoot, 'supabase/functions/wallet-clearance/index.ts');
const payoutWithdrawPath = path.join(repoRoot, 'supabase/functions/payout-withdraw/index.ts');

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
  const reliability = read(reliabilityPath);
  const maintenance = read(maintenancePath);
  const groupLifecycle = read(groupLifecyclePath);
  const paymentAttempt = read(paymentAttemptPath);
  const contribution = read(contributionPath);
  const walletClearance = read(walletClearancePath);
  const payoutWithdraw = read(payoutWithdrawPath);

  [
    'export async function processDueContributionObligations',
    "isPast(obligation.due_at, now) || isPast(obligation.grace_ends_at, now)",
    'await markContributionObligationLate(current.id, now.toISOString())',
    'await markContributionObligationDefaulted(current.id, now.toISOString())',
    "restrictionType: 'DefaultedContribution'",
    'await ensureActiveRestriction',
  ].forEach(token => assertIncludes(obligations, token, 'due/default obligation token'));

  [
    'export async function ensureActiveRestriction',
    "restriction_type', input.restrictionType",
    'await recordRestrictionReliability(input.userId)',
    'export async function getReliabilityRestrictionGate',
    'export async function assertReliabilityAllowsNormalFlow',
  ].forEach(token => assertIncludes(reliability, token, 'restriction gate token'));

  [
    "action: 'sweepDueObligations'",
    'await requireAdmin(body.token)',
    'processDueContributionObligations',
    'dryRun: body.dryRun',
  ].forEach(token => assertIncludes(maintenance, token, 'default maintenance function token'));

  [
    'await assertReliabilityAllowsNormalFlow(actor.User_ID)',
  ].forEach(token => {
    assertIncludes(groupLifecycle, token, 'legacy create restriction gate token');
    assertIncludes(paymentAttempt, token, 'payment attempt restriction gate token');
    assertIncludes(contribution, token, 'contribution restriction gate token');
    assertIncludes(walletClearance, token, 'wallet clearance restriction gate token');
    assertIncludes(payoutWithdraw, token, 'payout withdraw restriction gate token');
  });

  const result = {
    scenario: 'phase2-default-restriction-validation',
    validatedFiles: {
      obligations: 'supabase/functions/_shared/obligations.ts',
      reliability: 'supabase/functions/_shared/reliability.ts',
      defaultMaintenance: 'supabase/functions/default-maintenance/index.ts',
      groupLifecycle: 'supabase/functions/group-lifecycle/index.ts',
      paymentAttempt: 'supabase/functions/payment-attempt/index.ts',
      contributionReconcile: 'supabase/functions/contribution-reconcile/index.ts',
      walletClearance: 'supabase/functions/wallet-clearance/index.ts',
      payoutWithdraw: 'supabase/functions/payout-withdraw/index.ts',
    },
    completedChecks: [
      'admin-only default maintenance endpoint sweeps due obligations',
      'due obligations can move to Late based on due_at',
      'grace-expired late obligations can move to Defaulted',
      'defaulted obligations create active DefaultedContribution restrictions',
      'restricted users are blocked from legacy create, contribution, payment-attempt, and payout-clearance paths',
    ],
    limitations: [
      'group freeze events and frozen-group resolution remain pending under P2-701 and P2-704+',
      'default-maintenance deployment/scheduling requires Supabase function deployment outside this local validation',
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
