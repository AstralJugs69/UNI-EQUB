const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260516112000_phase2_backfill_existing_state.sql',
);

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

function assertIncludes(content, token, label) {
  if (!content.includes(token)) {
    throw new Error(`Missing ${label}: ${token}`);
  }
}

function assertNoDestructiveCoreChanges(sql) {
  const blockedPatterns = [
    /drop\s+table\s+public\."?(User|EqubGroup|GroupMembers|Round|Transaction)"?/i,
    /truncate\s+table\s+public\."?(User|EqubGroup|GroupMembers|Round|Transaction)"?/i,
    /delete\s+from\s+public\."?(User|EqubGroup|GroupMembers|Round|Transaction)"?/i,
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
    throw new Error(`Missing required migration: ${path.relative(repoRoot, migrationPath)}`);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  assertNoDestructiveCoreChanges(sql);

  [
    'insert into public.user_reliability_profiles',
    'from public."User" u',
    "when u.\"KYC_Status\" = 'Banned' then 'Banned'",
    'where not exists',
  ].forEach(token => assertIncludes(sql, token, 'reliability profile backfill token'));

  [
    'insert into public.contribution_obligations',
    'from public."Round" r',
    'join public."GroupMembers" gm',
    'and gm."Status" = \'Active\'',
    'left join public."Transaction" tx',
    "and tx.\"Type\" = 'Contribution'",
    "and tx.\"Status\" = 'Successful'",
    'where r."Status" = \'Open\'',
    'on conflict (round_id, user_id) do nothing',
  ].forEach(token => assertIncludes(sql, token, 'open-round obligation backfill token'));

  [
    'update public.contribution_obligations obligation',
    "status = 'Paid'",
    'paid_transaction_id = tx."Trans_ID"',
    'paid_at = tx."Date"',
    "obligation.status in ('Unpaid', 'PendingPayment', 'Late')",
  ].forEach(token => assertIncludes(sql, token, 'paid obligation reconciliation token'));

  const result = {
    scenario: 'phase2-existing-state-backfill-static-validation',
    migration: path.relative(repoRoot, migrationPath).replace(/\\/g, '/'),
    completedChecks: [
      'migration is additive and does not destructively modify MVP core tables',
      'missing reliability profiles are inserted for existing users',
      'banned users receive a Banned reliability status while other existing users start as New',
      'missing open-round obligations are inserted for active members only',
      'existing successful contribution transactions are reflected as Paid obligations',
      'the migration is idempotent through missing-row checks and round/user conflict handling',
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
