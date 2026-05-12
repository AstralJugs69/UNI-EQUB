const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260513090000_phase2_foundation_companion_tables.sql',
);

const requiredTables = [
  'app_config',
  'audit_events',
  'notifications',
  'group_requests',
  'group_join_requests',
  'group_invitations',
  'contribution_obligations',
  'payment_provider_attempts',
  'ledger_entries',
  'payout_requests',
  'payout_release_schedules',
  'user_reliability_profiles',
  'user_restrictions',
];

const requiredConfigKeys = [
  'min_group_members',
  'max_group_members',
  'group_formation_expiry_days',
  'frozen_group_poll_hours',
  'required_perfect_groups_for_trusted_status',
  'new_user_active_group_limit',
  'low_risk_recovery_group_max_payout',
  'default_grace_period_hours',
  'mock_payment_timeout_minutes',
  'first_cycle_payout_release_ratio',
  'minimum_immediate_payout_amount',
  'payout_rounding_strategy',
  'enable_private_vesting_override',
];

const requiredGuardrails = [
  'idx_transaction_successful_contribution_once',
  'idx_transaction_active_payout_once',
  'idx_equbgroup_virtual_acc_ref_unique',
  'contribution_obligations_round_user_unique',
  'payment_provider_attempts_idempotency_key_unique',
  'idx_payment_provider_attempts_gateway_reference_unique',
  'payout_requests_round_winner_unique',
  'idx_user_restrictions_active_type_unique',
];

const appendOnlyTriggers = [
  'audit_events_prevent_update_delete',
  'ledger_entries_prevent_update_delete',
];

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertIncludes(sql, token, label) {
  if (!sql.includes(token)) {
    throw new Error(`Missing ${label}: ${token}`);
  }
}

function assertRegex(sql, regex, label) {
  if (!regex.test(sql)) {
    throw new Error(`Missing ${label}: ${regex}`);
  }
}

function assertNoDestructiveCoreChanges(sql) {
  const blockedPatterns = [
    /drop\s+table\s+public\."?(User|EqubGroup|GroupMembers|Round|Transaction)"?/i,
    /truncate\s+table\s+public\."?(User|EqubGroup|GroupMembers|Round|Transaction)"?/i,
    /alter\s+table\s+public\."?(User|EqubGroup|GroupMembers|Round|Transaction)"?\s+drop\s+column/i,
    /alter\s+table\s+public\."?(User|EqubGroup|GroupMembers|Round|Transaction)"?\s+rename/i,
  ];

  blockedPatterns.forEach(pattern => {
    if (pattern.test(sql)) {
      throw new Error(`Destructive core-table operation detected: ${pattern}`);
    }
  });
}

function main() {
  const args = parseArgs();
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Phase 2 foundation migration not found at ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  assertNoDestructiveCoreChanges(sql);

  requiredTables.forEach(table => {
    assertRegex(
      sql,
      new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${escapeRegExp(table)}\\b`, 'i'),
      `create table for ${table}`,
    );
    assertRegex(
      sql,
      new RegExp(`comment\\s+on\\s+table\\s+public\\.${escapeRegExp(table)}\\s+is`, 'i'),
      `table comment for ${table}`,
    );
    assertRegex(
      sql,
      new RegExp(`alter\\s+table\\s+public\\.${escapeRegExp(table)}\\s+enable\\s+row\\s+level\\s+security`, 'i'),
      `RLS enablement for ${table}`,
    );
  });

  requiredConfigKeys.forEach(key => {
    assertRegex(sql, new RegExp(`\\('${escapeRegExp(key)}'`, 'i'), `app_config seed ${key}`);
  });

  requiredGuardrails.forEach(guardrail => {
    assertIncludes(sql, guardrail, `guardrail ${guardrail}`);
  });

  appendOnlyTriggers.forEach(triggerName => {
    assertIncludes(sql, triggerName, `append-only trigger ${triggerName}`);
  });

  const result = {
    scenario: 'phase2-foundation-static-validation',
    migration: path.relative(repoRoot, migrationPath).replace(/\\/g, '/'),
    companionTables: requiredTables,
    appConfigKeys: requiredConfigKeys,
    guardrails: requiredGuardrails,
    appendOnlyTriggers,
    destructiveCoreTableCheck: 'passed',
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
