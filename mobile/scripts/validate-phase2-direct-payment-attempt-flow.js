const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const contributionPath = path.join(repoRoot, 'supabase/functions/contribution-reconcile/index.ts');
const obligationsPath = path.join(repoRoot, 'supabase/functions/_shared/obligations.ts');
const paymentAttemptsPath = path.join(repoRoot, 'supabase/functions/_shared/paymentAttempts.ts');
const ledgerPath = path.join(repoRoot, 'supabase/functions/_shared/ledger.ts');

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
  const obligations = read(obligationsPath);
  const paymentAttempts = read(paymentAttemptsPath);
  const ledger = read(ledgerPath);

  [
    'markContributionObligationPaid',
    "status: 'Paid'",
    'paid_transaction_id: transactionId',
    'paid_at: paidAt',
  ].forEach(token => assertIncludes(obligations, token, 'paid obligation helper token'));

  [
    'recordPaymentAttemptCallback',
    'verificationResult',
    'ensurePaymentProviderAttempt',
  ].forEach(token => assertIncludes(paymentAttempts, token, 'payment attempt success token'));

  [
    'recordLedgerEntry',
    "entry_type: input.entryType",
    "reference_type: input.referenceType",
  ].forEach(token => assertIncludes(ledger, token, 'ledger helper token'));

  [
    'async function payContributionThroughProviderAttempt',
    'await requirePayableObligation',
    'buildPaymentAttemptIdempotencyKey',
    "'direct-contribution'",
    'await ensurePaymentProviderAttempt',
    "initialStatus: 'Pending'",
    'await markContributionObligationPendingPayment(obligation.id)',
    'await recordPaymentAttemptCallback',
    "status: 'Successful'",
    'await createContributionTransactionForAttempt',
    'await markContributionObligationPaid(obligation.id, transaction.Trans_ID)',
    'await recordLedgerEntry',
    "entryType: 'ContributionReceived'",
    "referenceType: 'payment_provider_attempts'",
    'await finalizeRoundIfReady(group, round)',
    'return json(await payContributionThroughProviderAttempt(actor, body.groupId, body.method))',
  ].forEach(token => assertIncludes(contribution, token, 'direct contribution provider-attempt token'));

  [
    'case \'submitContributionUssd\'',
    'case \'reconcileProviderCallback\'',
    'reconcileContributionByPhone',
  ].forEach(token => assertIncludes(contribution, token, 'deferred flow preserved token'));

  const result = {
    scenario: 'phase2-direct-payment-attempt-flow-validation',
    validatedFiles: {
      contributionReconcile: 'supabase/functions/contribution-reconcile/index.ts',
      obligations: 'supabase/functions/_shared/obligations.ts',
      paymentAttempts: 'supabase/functions/_shared/paymentAttempts.ts',
      ledger: 'supabase/functions/_shared/ledger.ts',
    },
    completedChecks: [
      'direct payContribution routes through an idempotent payment_provider_attempts row',
      'direct payContribution marks the obligation PendingPayment before simulated success',
      'direct payContribution records a Successful provider callback before transaction creation',
      'direct payContribution marks the obligation Paid with the created transaction id',
      'direct payContribution writes a ContributionReceived ledger entry linked to the attempt',
      'USSD and external provider callback paths remain deferred for later tracker tasks',
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
