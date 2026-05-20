type SeedTarget = 'local' | 'linked' | 'staging';

interface SeedScenarioManifest {
  name: string;
  description: string;
  dependencies: string[];
  deterministic: boolean;
  destructive: boolean;
}

interface Env {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  target: SeedTarget;
}

const scenarios: SeedScenarioManifest[] = [
  { name: 'empty', description: 'Wipe every UniEqub app table.', dependencies: [], deterministic: true, destructive: true },
  { name: 'bootstrap-admin', description: 'Create one explicitly requested admin account.', dependencies: ['empty'], deterministic: true, destructive: false },
  { name: 'onboarding-member', description: 'One member ready for OTP/KYC onboarding demos.', dependencies: ['empty'], deterministic: true, destructive: true },
  { name: 'kyc-queue', description: 'Admin plus three pending KYC submissions.', dependencies: ['bootstrap-admin'], deterministic: true, destructive: true },
  { name: 'forming-public', description: 'Public forming request with accepted and requested participants.', dependencies: ['bootstrap-admin'], deterministic: true, destructive: true },
  { name: 'forming-private', description: 'Private invite-code forming request.', dependencies: ['bootstrap-admin'], deterministic: true, destructive: true },
  { name: 'active-cycle', description: 'Approved active group with an open round.', dependencies: ['bootstrap-admin'], deterministic: true, destructive: true },
  { name: 'final-draw', description: 'Active group ready for final contribution and draw simulation.', dependencies: ['active-cycle'], deterministic: true, destructive: true },
  { name: 'frozen-recovery', description: 'Frozen group with recovery context.', dependencies: ['active-cycle'], deterministic: true, destructive: true },
  { name: 'announcements', description: 'Active/forming groups with pinned announcement board items.', dependencies: ['active-cycle'], deterministic: true, destructive: true },
  { name: 'account-switching', description: 'Admin and two member accounts for device account switching.', dependencies: ['bootstrap-admin'], deterministic: true, destructive: true },
];

const tables = [
  ['simulation_events', 'id'],
  ['simulation_clock', 'id'],
  ['group_announcements', 'id'],
  ['user_profiles', 'user_id'],
  ['refund_tickets', 'id'],
  ['group_resolution_votes', 'id'],
  ['group_resolution_poll_options', 'id'],
  ['group_resolution_polls', 'id'],
  ['group_freeze_events', 'id'],
  ['kyc_documents', 'id'],
  ['kyc_submissions', 'id'],
  ['user_restrictions', 'id'],
  ['user_reliability_profiles', 'user_id'],
  ['payout_release_schedules', 'id'],
  ['payout_requests', 'id'],
  ['ledger_entries', 'id'],
  ['payment_provider_attempts', 'id'],
  ['contribution_obligations', 'id'],
  ['group_invitations', 'id'],
  ['group_join_requests', 'id'],
  ['group_requests', 'id'],
  ['notifications', 'id'],
  ['audit_events', 'id'],
  ['app_config', 'key'],
  ['Transaction', 'Trans_ID'],
  ['Round', 'Round_ID'],
  ['GroupMembers', 'Membership_ID'],
  ['EqubGroup', 'Group_ID'],
  ['User', 'User_ID'],
] as const;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function getEnv(): Env {
  return {
    url: requiredEnv('UNIEQUB_SUPABASE_URL').replace(/\/$/, ''),
    anonKey: requiredEnv('UNIEQUB_SUPABASE_ANON_KEY'),
    serviceRoleKey: requiredEnv('UNIEQUB_SUPABASE_SERVICE_ROLE_KEY'),
    target: (process.env.UNIEQUB_SEED_TARGET ?? 'local') as SeedTarget,
  };
}

async function rest(env: Env, table: string, method: string, query = '', body?: unknown) {
  const response = await fetch(`${env.url}/rest/v1/${encodeURIComponent(table)}${query}`, {
    method,
    headers: {
      apikey: env.serviceRoleKey,
      authorization: `Bearer ${env.serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${method} ${table}${query} failed: ${response.status} ${await response.text()}`);
  }
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function invoke(env: Env, functionName: string, body: unknown, serviceRole = false) {
  const key = serviceRole ? env.serviceRoleKey : env.anonKey;
  const response = await fetch(`${env.url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(serviceRole && process.env.UNIEQUB_CONTROLLER_SECRET ? { 'x-uniequb-controller-secret': process.env.UNIEQUB_CONTROLLER_SECRET } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error ?? `${functionName} failed with ${response.status}`);
  }
  return payload.data;
}

function assertTargetAllowed(env: Env, command: string) {
  if (env.target !== 'local' && process.env.UNIEQUB_SEED_CONFIRM !== `${env.target}:${command}`) {
    throw new Error(`Refusing ${command} against ${env.target}. Set UNIEQUB_SEED_CONFIRM=${env.target}:${command} to continue.`);
  }
}

async function wipe(env: Env) {
  assertTargetAllowed(env, 'wipe');
  const wipedTables: string[] = [];
  for (const [table, pk] of tables) {
    await rest(env, table, 'DELETE', `?${pk}=not.is.null`);
    wipedTables.push(table);
  }
  return { wipedTables };
}

async function register(env: Env, fullName: string, phoneNumber: string, password: string) {
  const data = await invoke(env, 'register-login', {
    action: 'register',
    register: {
      fullName,
      phoneNumber,
      password,
      studentIdImage: 'seed://pending-kyc',
    },
  });
  return data.user as { userId: string; fullName: string; phoneNumber: string };
}

async function patchUser(env: Env, userId: string, patch: Record<string, unknown>) {
  const rows = await rest(env, 'User', 'PATCH', `?User_ID=eq.${userId}`, patch);
  return Array.isArray(rows) ? rows[0] : rows;
}

async function bootstrapAdmin(env: Env) {
  assertTargetAllowed(env, 'bootstrap-admin');
  const phone = process.env.UNIEQUB_BOOTSTRAP_ADMIN_PHONE ?? '0999000000';
  const password = process.env.UNIEQUB_BOOTSTRAP_ADMIN_PASSWORD ?? 'admin1234';
  const fullName = process.env.UNIEQUB_BOOTSTRAP_ADMIN_NAME ?? 'UniEqub Admin';
  const existing = await rest(env, 'User', 'GET', `?Phone_Number=eq.${encodeURIComponent(phone)}&limit=1`);
  const user = Array.isArray(existing) && existing.length ? existing[0] : await register(env, fullName, phone, password);
  const userId = user.User_ID ?? user.userId;
  await patchUser(env, userId, {
    Role: 'Admin',
    KYC_Status: 'Verified',
    Student_ID_Img: 'seed://admin-bootstrap',
  });
  await rest(env, 'user_profiles', 'POST', '', {
    user_id: userId,
    university: 'UniEqub Operations',
    academic_year: 'Admin',
    avatar_seed: `admin:${phone}`,
    avatar_style: 'Geometric',
    avatar_palette: 'blue',
  }).catch(() => undefined);
  return { userId };
}

async function createVerifiedMember(env: Env, name: string, phone: string, password = 'member1234') {
  const user = await register(env, name, phone, password);
  await patchUser(env, user.userId, {
    KYC_Status: 'Verified',
    Student_ID_Img: 'seed://verified-student-id',
  });
  await rest(env, 'user_profiles', 'POST', '', {
    user_id: user.userId,
    university: 'Addis Ababa University',
    academic_year: '3rd Year',
    avatar_seed: `member:${phone}`,
    avatar_style: 'Geometric',
    avatar_palette: 'blue',
  }).catch(() => undefined);
  return user;
}

async function createActiveCycle(env: Env) {
  const admin = await bootstrapAdmin(env);
  const members = [
    await createVerifiedMember(env, 'Yabsra Melaku', '0911000001'),
    await createVerifiedMember(env, 'Meri Alemu', '0911000002'),
    await createVerifiedMember(env, 'Hana Bekele', '0911000003'),
    await createVerifiedMember(env, 'Yared Mekonnen', '0911000004'),
    await createVerifiedMember(env, 'Noah Girma', '0911000005'),
  ];
  const [group] = await rest(env, 'EqubGroup', 'POST', '', {
    Creator_ID: members[0].userId,
    Group_Name: 'Seeded Active Cycle',
    Amount: 650,
    Max_Members: 5,
    Frequency: 'Weekly',
    Virtual_Acc_Ref: 'UEQ-SEED-ACTIVE',
    Status: 'Active',
    Start_Date: new Date().toISOString().slice(0, 10),
  });
  await rest(env, 'Round', 'POST', '', {
    Group_ID: group.Group_ID,
    Round_Number: 1,
    Winner_ID: null,
    Draw_Date: null,
    Status: 'Open',
  });
  for (const member of members) {
    await rest(env, 'GroupMembers', 'POST', '', {
      Group_ID: group.Group_ID,
      User_ID: member.userId,
      Joined_At: new Date().toISOString(),
      Status: 'Active',
    });
  }
  return { admin, groupId: group.Group_ID, members };
}

async function runScenario(env: Env, name: string) {
  const manifest = scenarios.find(item => item.name === name);
  if (!manifest) {
    throw new Error(`Unknown scenario "${name}". Run seed:catalog.`);
  }
  if (manifest.destructive) {
    await wipe(env);
  }
  const created: Record<string, number> = {};
  switch (name) {
    case 'empty':
      break;
    case 'bootstrap-admin':
      await bootstrapAdmin(env);
      created.admins = 1;
      break;
    case 'kyc-queue':
      await bootstrapAdmin(env);
      await register(env, 'Meron Alemu', '0911000101', 'member1234');
      await register(env, 'Hana Bekele', '0911000102', 'member1234');
      await register(env, 'Yared Mekonnen', '0911000103', 'member1234');
      created.pendingKyc = 3;
      break;
    case 'active-cycle':
    case 'final-draw':
    case 'frozen-recovery':
    case 'announcements': {
      const active = await createActiveCycle(env);
      created.groups = 1;
      created.members = active.members.length;
      if (name === 'frozen-recovery') {
        await rest(env, 'EqubGroup', 'PATCH', `?Group_ID=eq.${active.groupId}`, { Status: 'Frozen' });
      }
      if (name === 'announcements') {
        await rest(env, 'group_announcements', 'POST', '', {
          group_id: active.groupId,
          group_request_id: null,
          created_by: active.admin.userId,
          title: 'Round checkpoint',
          body: 'This cycle is ready for contribution testing.',
          priority: 'High',
          pinned: true,
          target_scope: 'ApprovedGroup',
        });
        created.announcements = 1;
      }
      break;
    }
    case 'account-switching':
      await bootstrapAdmin(env);
      await createVerifiedMember(env, 'Yabsra Melaku', '0911000201');
      await createVerifiedMember(env, 'Meri Alemu', '0911000202');
      created.accounts = 3;
      break;
    default:
      await bootstrapAdmin(env);
      created.placeholders = 1;
  }
  return {
    scenario: name,
    target: env.target,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    created,
    wipedTables: manifest.destructive ? tables.map(([table]) => table) : [],
    warnings: manifest.name === 'forming-private' || manifest.name === 'forming-public' ? ['Scenario placeholder creates bootstrap data only in this first engine version.'] : [],
  };
}

async function validate() {
  const fs = await import('node:fs');
  const failures: string[] = [];
  if (fs.existsSync('mobile/src/data/seed.ts')) {
    failures.push('mobile/src/data/seed.ts still exists.');
  }
  if (fs.existsSync('supabase/sql/002_seed_minimal.sql')) {
    failures.push('supabase/sql/002_seed_minimal.sql still exists.');
  }
  if (!fs.existsSync('supabase/migrations/20260520120000_seedless_baseline_truncate.sql')) {
    failures.push('Seedless truncate migration is missing.');
  }
  if (!scenarios.length || !scenarios.every(item => item.deterministic)) {
    failures.push('Scenario catalog must be deterministic.');
  }
  return { ok: failures.length === 0, failures, scenarios: scenarios.map(item => item.name) };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'catalog') {
    console.log(JSON.stringify({ scenarios }, null, 2));
    return;
  }
  if (command === 'validate') {
    const result = await validate();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const env = getEnv();
  if (command === 'wipe') {
    console.log(JSON.stringify(await wipe(env), null, 2));
    return;
  }
  if (command === 'bootstrap-admin') {
    console.log(JSON.stringify(await bootstrapAdmin(env), null, 2));
    return;
  }
  if (command === 'scenario') {
    console.log(JSON.stringify(await runScenario(env, args[0] ?? 'empty'), null, 2));
    return;
  }

  console.error('Usage: seed <wipe|bootstrap-admin|scenario|catalog|validate>');
  process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
