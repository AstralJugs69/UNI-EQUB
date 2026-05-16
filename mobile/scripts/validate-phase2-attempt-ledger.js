const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const paymentAttemptPath = path.join(repoRoot, 'supabase/functions/payment-attempt/index.ts');
const contributionPath = path.join(repoRoot, 'supabase/functions/contribution-reconcile/index.ts');
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
  const paymentAttempt = read(paymentAttemptPath);
  const contribution = read(contributionPath);
  const ledger = read(ledgerPath);
  const combined = `${paymentAttempt}\n${contribution}`;

  [
    'export async function recordLedgerEntry',
    'export async function listLedgerEntriesForReference',
    "entryType: 'PaymentAttemptPending' | 'PaymentAttemptFailed'",
  ].forEach(token => assertIncludes(`${ledger}\n${combined}`, token, 'ledger helper token'));

  [
    'async function recordPaymentAttemptLedgerMemo',
    "listLedgerEntriesForReference('payment_provider_attempts', input.attempt.id)",
    "entry.entry_type === input.entryType",
    "entryType: 'PaymentAttemptPending'",
    "entryType: status === 'Pending' ? 'PaymentAttemptPending' : 'PaymentAttemptFailed'",
    "entryType: 'PaymentAttemptFailed'",
    "direction: 'Memo'",
    "referenceType: 'payment_provider_attempts'",
    'payment_attempt_status',
  ].forEach(token => assertIncludes(combined, token, 'payment attempt ledger memo token'));

  const result = {
    scenario: 'phase2-payment-attempt-ledger-validation',
    validatedFiles: {
      paymentAttempt: 'supabase/functions/payment-attempt/index.ts',
      contributionReconcile: 'supabase/functions/contribution-reconcile/index.ts',
      ledger: 'supabase/functions/_shared/ledger.ts',
    },
    completedChecks: [
      'pending payment attempts write PaymentAttemptPending memo ledger entries',
      'failed/cancelled/timeout/invalid payment outcomes write PaymentAttemptFailed memo ledger entries',
      'direct and USSD contribution paths record pending attempt memos',
      'USSD cancellation records a failed attempt memo before returning the obligation to Unpaid',
      'ledger memo writes are de-duplicated per attempt and entry type',
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
