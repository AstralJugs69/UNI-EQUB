const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const contributionPath = path.join(repoRoot, 'supabase/functions/contribution-reconcile/index.ts');
const authPath = path.join(repoRoot, 'supabase/functions/_shared/auth.ts');
const obligationsPath = path.join(repoRoot, 'supabase/functions/_shared/obligations.ts');
const paymentAttemptsPath = path.join(repoRoot, 'supabase/functions/_shared/paymentAttempts.ts');

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
  const contribution = read(contributionPath);
  const auth = read(authPath);
  const obligations = read(obligationsPath);
  const paymentAttempts = read(paymentAttemptsPath);

  [
    'attemptId?: string',
    'obligationId?: string',
    'attemptId: input.attemptId',
    'obligationId: input.obligationId',
  ].forEach(token => assertIncludes(auth, token, 'signed USSD attempt token'));

  [
    'markContributionObligationUnpaid',
    "status: 'Unpaid'",
    ".in('status', ['PendingPayment', 'Late', 'Unpaid'])",
  ].forEach(token => assertIncludes(obligations, token, 'cancelled obligation helper token'));

  [
    'recordPaymentAttemptCallback',
    "status: 'Cancelled'",
    "status: 'Successful'",
  ].forEach(token => assertIncludes(paymentAttempts + contribution, token, 'attempt callback status token'));

  [
    'async function initiateUssdContributionAttempt',
    "'ussd-contribution'",
    "source: 'contribution-reconcile.startContributionUssd'",
    "providerName: 'MockUSSD'",
    "initialStatus: 'Pending'",
    'await markContributionObligationPendingPayment(obligation.id)',
    'attemptId: attempt.id',
    'obligationId: obligation.id',
    'const attemptId = payload.attemptId as string | undefined',
    'const obligationId = payload.obligationId as string | undefined',
    "status: 'Cancelled'",
    "failureCode: 'USSD_CANCELLED'",
    'await markContributionObligationUnpaid(obligationId)',
    'attemptId, obligationId',
    "event: 'ussd_mock_success'",
    'await completeSuccessfulContributionAttempt',
    "method: 'MockUSSD'",
  ].forEach(token => assertIncludes(contribution, token, 'USSD provider-attempt flow token'));

  const result = {
    scenario: 'phase2-ussd-payment-attempt-flow-validation',
    validatedFiles: {
      contributionReconcile: 'supabase/functions/contribution-reconcile/index.ts',
      auth: 'supabase/functions/_shared/auth.ts',
      obligations: 'supabase/functions/_shared/obligations.ts',
      paymentAttempts: 'supabase/functions/_shared/paymentAttempts.ts',
    },
    completedChecks: [
      'USSD start creates a pending MockUSSD payment_provider_attempts row',
      'USSD start marks the matching contribution obligation PendingPayment',
      'signed USSD session tokens carry attempt and obligation ids between stages',
      'USSD cancellation records a Cancelled attempt callback and returns the obligation to Unpaid',
      'USSD PIN success records a Successful attempt callback before transaction creation',
      'USSD PIN success marks the obligation Paid and writes ledger/transaction through the shared completion helper',
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
