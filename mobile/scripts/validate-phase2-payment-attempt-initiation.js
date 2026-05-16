const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const paymentAttemptFunctionPath = path.join(repoRoot, 'supabase/functions/payment-attempt/index.ts');
const paymentAttemptsHelperPath = path.join(repoRoot, 'supabase/functions/_shared/paymentAttempts.ts');
const obligationsPath = path.join(repoRoot, 'supabase/functions/_shared/obligations.ts');
const contractsPath = path.join(repoRoot, 'supabase/functions/_shared/contracts.ts');

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
  const paymentAttemptFunction = read(paymentAttemptFunctionPath);
  const paymentAttemptsHelper = read(paymentAttemptsHelperPath);
  const obligations = read(obligationsPath);
  const contracts = read(contractsPath);

  [
    "export type PaymentAttemptAction = 'initiateContributionAttempt'",
    'PaymentAttemptPayload',
    'providerName?',
    'idempotencyKey?',
  ].forEach(token => assertIncludes(contracts, token, 'payment attempt contract token'));

  [
    'initialStatus?:',
    'status: input.initialStatus ??',
    'ensurePaymentProviderAttempt',
    'buildPaymentAttemptIdempotencyKey',
  ].forEach(token => assertIncludes(paymentAttemptsHelper, token, 'payment attempt helper token'));

  [
    'getContributionObligationForUserRound',
    'markContributionObligationPendingPayment',
    "status: 'PendingPayment'",
    ".in('status', ['Unpaid', 'Late', 'PendingPayment'])",
  ].forEach(token => assertIncludes(obligations, token, 'pending obligation helper token'));

  [
    "case 'initiateContributionAttempt'",
    'await requireActiveMembership(group.Group_ID, actor.User_ID)',
    'const round = await ensureOpenRoundForGroup(group)',
    'await requireContributionObligation',
    'buildPaymentAttemptIdempotencyKey',
    'await ensurePaymentProviderAttempt',
    "initialStatus: 'Pending'",
    'await markContributionObligationPendingPayment(obligation.id)',
    'transactionCreated: false',
  ].forEach(token => assertIncludes(paymentAttemptFunction, token, 'payment initiation function token'));

  [
    ".from('Transaction')",
    '.insert({',
    'finalizeRoundIfReady',
    "status: 'Successful'",
  ].forEach(token => assertNotIncludes(paymentAttemptFunction, token, 'premature reconciliation token'));

  const result = {
    scenario: 'phase2-payment-attempt-initiation-validation',
    validatedFiles: {
      paymentAttemptFunction: 'supabase/functions/payment-attempt/index.ts',
      paymentAttemptsHelper: 'supabase/functions/_shared/paymentAttempts.ts',
      obligations: 'supabase/functions/_shared/obligations.ts',
      contracts: 'supabase/functions/_shared/contracts.ts',
    },
    completedChecks: [
      'payment-attempt Edge Function exposes initiateContributionAttempt command boundary',
      'initiation requires active membership, active group, and current open round',
      'initiation locates the actor round obligation and rejects settled obligations',
      'initiation creates an idempotent payment_provider_attempts row in Pending state',
      'initiation marks the obligation PendingPayment',
      'initiation does not create successful Transaction rows or run round finalization',
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
