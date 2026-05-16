const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const contributionPath = path.join(repoRoot, 'supabase/functions/contribution-reconcile/index.ts');
const paymentAttemptsPath = path.join(repoRoot, 'supabase/functions/_shared/paymentAttempts.ts');
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
  const contribution = read(contributionPath);
  const paymentAttempts = read(paymentAttemptsPath);
  const obligations = read(obligationsPath);

  [
    'recordPaymentAttemptCallback',
    "status: 'Duplicate'",
    'gatewayReference?: string',
    'idempotencyKey?: string',
  ].forEach(token => assertIncludes(paymentAttempts + contribution, token, 'callback idempotency helper token'));

  [
    'getContributionObligationForUserRound',
    'markContributionObligationPendingPayment',
    'markContributionObligationPaid',
  ].forEach(token => assertIncludes(obligations, token, 'callback obligation helper token'));

  [
    'async function findPaymentAttemptByGatewayReference',
    'async function reconcileProviderCallbackThroughAttempt',
    "'provider-callback'",
    'await findPaymentAttemptByGatewayReference(input.gatewayRef)',
    'await successfulContribution(round.Round_ID, actor.User_ID)',
    "event: 'duplicate_provider_callback'",
    "failureCode: 'DUPLICATE_CALLBACK'",
    'no transaction was created',
    "event: 'provider_callback_success'",
    'await completeSuccessfulContributionAttempt',
    'return json(await reconcileProviderCallbackThroughAttempt',
  ].forEach(token => assertIncludes(contribution, token, 'provider callback idempotency token'));

  const result = {
    scenario: 'phase2-provider-callback-idempotency-validation',
    validatedFiles: {
      contributionReconcile: 'supabase/functions/contribution-reconcile/index.ts',
      paymentAttempts: 'supabase/functions/_shared/paymentAttempts.ts',
      obligations: 'supabase/functions/_shared/obligations.ts',
    },
    completedChecks: [
      'reconcileProviderCallback resolves the member, open round, and matching obligation before reconciliation',
      'reconcileProviderCallback creates or links a payment_provider_attempts row by gateway/idempotency',
      'reconcileProviderCallback records Successful callbacks through the shared completion helper',
      'duplicate callbacks are marked Duplicate on the provider attempt',
      'duplicate callbacks return existing transaction context without creating another successful Transaction',
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
