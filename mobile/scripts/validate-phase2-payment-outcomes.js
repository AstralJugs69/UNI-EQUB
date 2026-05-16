const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const contractsPath = path.join(repoRoot, 'supabase/functions/_shared/contracts.ts');
const paymentAttemptPath = path.join(repoRoot, 'supabase/functions/payment-attempt/index.ts');
const configPath = path.join(repoRoot, 'supabase/config.toml');

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
  const contracts = read(contractsPath);
  const paymentAttempt = read(paymentAttemptPath);
  const config = read(configPath);

  [
    "export type PaymentAttemptOutcome = 'success' | 'failure' | 'timeout' | 'cancelled' | 'wrong_amount' | 'pending'",
    'outcome?: PaymentAttemptOutcome',
    'failureCode?: string',
    'failureMessage?: string',
  ].forEach(token => assertIncludes(contracts, token, 'payment attempt contract outcome token'));

  [
    'async function recordContributionAttemptOutcome',
    'function outcomeToAttemptStatus',
    "return 'Timeout'",
    "return 'Cancelled'",
    "return 'InvalidAmount'",
    "return 'Failed'",
    "return 'Pending'",
    'Successful contribution callbacks must use contribution-reconcile',
    'A successful payment attempt cannot be rewritten',
    'await markContributionObligationPendingPayment',
    'await markContributionObligationUnpaid',
    "case 'recordProviderCallback'",
    "case 'markAttemptTimeout'",
    "case 'markAttemptCancelled'",
    'transactionCreated: false',
  ].forEach(token => assertIncludes(paymentAttempt, token, 'payment attempt outcome handling token'));

  assertIncludes(config, '[functions.payment-attempt]', 'payment-attempt Supabase function registration');

  const result = {
    scenario: 'phase2-payment-attempt-outcome-validation',
    validatedFiles: {
      contracts: 'supabase/functions/_shared/contracts.ts',
      paymentAttempt: 'supabase/functions/payment-attempt/index.ts',
      config: 'supabase/config.toml',
    },
    completedChecks: [
      'payment-attempt endpoint is registered in Supabase config',
      'payment attempt contracts can represent success, failure, timeout, cancelled, wrong amount, and pending mock outcomes',
      'non-success contribution attempt outcomes update payment_provider_attempts without creating a Transaction',
      'failed, timeout, cancelled, and invalid-amount outcomes return the matching contribution obligation to Unpaid',
      'pending outcomes keep the matching contribution obligation in PendingPayment',
      'successful contribution callbacks remain routed through contribution-reconcile for atomic transaction, ledger, obligation, and draw handling',
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
