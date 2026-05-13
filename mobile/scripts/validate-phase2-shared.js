const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');

const files = {
  mobileDomain: 'mobile/src/types/domain.ts',
  sharedTypes: 'supabase/functions/_shared/types.ts',
  sharedContracts: 'supabase/functions/_shared/contracts.ts',
  config: 'supabase/functions/_shared/config.ts',
  audit: 'supabase/functions/_shared/audit.ts',
  notifications: 'supabase/functions/_shared/notifications.ts',
  reliability: 'supabase/functions/_shared/reliability.ts',
  obligations: 'supabase/functions/_shared/obligations.ts',
  paymentAttempts: 'supabase/functions/_shared/paymentAttempts.ts',
  ledger: 'supabase/functions/_shared/ledger.ts',
  payoutVesting: 'supabase/functions/_shared/payoutVesting.ts',
  mockBackend: 'mobile/src/services/mock/mockBackend.ts',
};

const requiredExports = {
  mobileDomain: [
    'EqubGroupStatus',
    'GroupRequestStatus',
    'AppConfigRecord',
    'AuditEventRecord',
    'DurableNotificationRecord',
    'GroupRequestRecord',
    'ContributionObligationRecord',
    'PaymentProviderAttemptRecord',
    'LedgerEntryRecord',
    'PayoutRequestRecord',
    'UserReliabilityProfileRecord',
    'UserRestrictionRecord',
  ],
  sharedTypes: [
    'EqubGroupStatus',
    'GroupRequestStatus',
    'AppConfigRecord',
    'AuditEventRecord',
    'DurableNotificationRecord',
    'GroupRequestRecord',
    'ContributionObligationRecord',
    'PaymentProviderAttemptRecord',
    'LedgerEntryRecord',
    'PayoutRequestRecord',
    'UserReliabilityProfileRecord',
    'UserRestrictionRecord',
  ],
  sharedContracts: ['GroupFormationAction', 'CreateGroupFormationRequest', 'GroupFormationPayload', 'PaymentAttemptAction', 'PaymentAttemptPayload', 'PayoutAction', 'PayoutPayload'],
  config: ['PHASE2_DEFAULT_APP_CONFIG', 'loadAppConfig', 'loadConfigValue', 'readPositiveIntegerConfig'],
  audit: ['AuditEventInput', 'writeAuditEvent', 'auditMetadata'],
  notifications: ['CreateNotificationInput', 'createNotification', 'markUserNotificationsRead'],
  reliability: ['getReliabilityProfile', 'ensureReliabilityProfile', 'listActiveRestrictions', 'getReliabilityJoinGate'],
  obligations: ['ensureContributionObligationsForRound', 'getRoundObligationReadiness', 'isContributionObligationSettled'],
  paymentAttempts: ['CreatePaymentAttemptInput', 'buildPaymentAttemptIdempotencyKey', 'ensurePaymentProviderAttempt', 'recordPaymentAttemptCallback'],
  ledger: ['LedgerEntryInput', 'recordLedgerEntry', 'listLedgerEntriesForReference', 'ledgerMemo'],
  payoutVesting: ['PayoutVestingInput', 'calculatePayoutVesting', 'calculatePayoutVestingFromConfig', 'buildPayoutReleaseScheduleAmounts'],
};

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--output') {
      parsed.output = args[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function read(key) {
  const filePath = path.join(repoRoot, files[key]);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${files[key]}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, token, label) {
  if (!content.includes(token)) {
    throw new Error(`Missing ${label}: ${token}`);
  }
}

function assertNoCanonicalRejectedGroupStatus(content, label) {
  const rejectedCanonicalStatus = /EqubGroupStatus\s*=\s*[^;]*'Rejected'|Status:\s*'Rejected'|Status\s*=\s*'Rejected'/;
  if (rejectedCanonicalStatus.test(content)) {
    throw new Error(`${label} models Rejected as a canonical EqubGroup status.`);
  }
}

function main() {
  const args = parseArgs();
  const validatedFiles = {};

  for (const key of Object.keys(files)) {
    const content = read(key);
    validatedFiles[key] = files[key];

    for (const exportName of requiredExports[key] ?? []) {
      assertIncludes(content, exportName, `${key} export`);
    }
  }

  assertNoCanonicalRejectedGroupStatus(read('mobileDomain'), 'mobile domain');
  assertNoCanonicalRejectedGroupStatus(read('sharedTypes'), 'shared edge types');
  assertNoCanonicalRejectedGroupStatus(read('mockBackend'), 'mock backend');

  const result = {
    scenario: 'phase2-shared-helper-static-validation',
    validatedFiles,
    completedChecks: [
      'EqubGroupStatus and GroupRequestStatus are split',
      'Phase 2 companion record types exist in mobile and shared Edge Function types',
      'Config, audit, notifications, reliability, obligations, payment attempts, ledger, and payout vesting helper scaffolds exist',
      'Group formation, payment attempt, and payout backend command payload scaffolds exist',
      'Rejected is not modeled as canonical EqubGroup.Status',
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
