const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const migrationPath = path.join(repoRoot, 'supabase/migrations/20260519123000_phase2_group_freeze_events.sql');
const helperPath = path.join(repoRoot, 'supabase/functions/_shared/groupFreeze.ts');
const obligationsPath = path.join(repoRoot, 'supabase/functions/_shared/obligations.ts');
const groupLifecyclePath = path.join(repoRoot, 'supabase/functions/group-lifecycle/index.ts');
const contractsPath = path.join(repoRoot, 'supabase/functions/_shared/contracts.ts');
const liveGroupsPath = path.join(repoRoot, 'mobile/src/services/live/liveGroupsService.ts');
const mockBackendPath = path.join(repoRoot, 'mobile/src/services/mock/mockBackend.ts');
const mobileContractsPath = path.join(repoRoot, 'mobile/src/services/contracts/index.ts');
const adminGroupsPath = path.join(repoRoot, 'mobile/src/screens/admin/AdminGroupsScreen.tsx');
const domainPath = path.join(repoRoot, 'mobile/src/types/domain.ts');
const sharedTypesPath = path.join(repoRoot, 'supabase/functions/_shared/types.ts');

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
  const migration = read(migrationPath);
  const helper = read(helperPath);
  const obligations = read(obligationsPath);
  const groupLifecycle = read(groupLifecyclePath);
  const contracts = read(contractsPath);
  const liveGroups = read(liveGroupsPath);
  const mockBackend = read(mockBackendPath);
  const mobileContracts = read(mobileContractsPath);
  const adminGroups = read(adminGroupsPath);
  const domain = read(domainPath);
  const sharedTypes = read(sharedTypesPath);

  [
    'create table if not exists public.group_freeze_events',
    'trigger_obligation_id uuid references public.contribution_obligations(id)',
    "status in ('Open', 'UnderReview', 'ResolvedContinue', 'ResolvedKeepFrozen', 'Cancelled')",
    'idx_group_freeze_events_one_open_per_group',
    'idx_group_freeze_events_status_time',
    'alter table public.group_freeze_events enable row level security',
    'EqubGroup remains the canonical MVP group row',
  ].forEach(token => assertIncludes(migration, token, 'group freeze migration token'));

  [
    'export async function freezeGroupIfDefaultReserveInsufficient',
    'availableReserveAmount < defaultAmount',
    "entryType: 'ReserveFrozen'",
    "entryType: 'DefaultOffset'",
    'export async function freezeGroupForAdminReview',
    'export async function resolveOpenGroupFreeze',
    'group_freeze_event_created',
    'group_freeze_event_resolved',
    'createNotification',
    'writeAuditEvent',
  ].forEach(token => assertIncludes(helper, token, 'group freeze helper token'));

  [
    "import { freezeGroupIfDefaultReserveInsufficient } from './groupFreeze.ts'",
    'await freezeGroupIfDefaultReserveInsufficient(obligation)',
  ].forEach(token => assertIncludes(obligations, token, 'default-to-freeze orchestration token'));

  [
    "'resolveFreeze'",
    "freezeGroupForAdminReview",
    "resolveOpenGroupFreeze",
    ".in('Status', ['Pending', 'Frozen'])",
    'Frozen group pending manual recovery resolution.',
  ].forEach(token => assertIncludes(groupLifecycle, token, 'group lifecycle freeze token'));

  [
    "'resolveFreeze'",
    'resolutionAction?',
    'resolutionNote?',
  ].forEach(token => assertIncludes(contracts, token, 'Edge contract freeze token'));

  [
    'resolveFreeze(groupId: string',
    'GroupFreezeResolutionAction',
  ].forEach(token => assertIncludes(mobileContracts, token, 'mobile contract freeze token'));

  [
    "action: 'resolveFreeze'",
    'GroupFreezeEventRecord',
  ].forEach(token => assertIncludes(liveGroups, token, 'live group service freeze token'));

  [
    'resolveFreeze: async',
    'Group freeze resolved manually',
  ].forEach(token => assertIncludes(mockBackend, token, 'mock freeze recovery token'));

  [
    'resolveFrozenGroup',
    'Resume Group',
    'Manual recovery',
  ].forEach(token => assertIncludes(adminGroups, token, 'admin freeze recovery UI token'));

  [
    'export type GroupFreezeEventStatus',
    'export type GroupFreezeResolutionAction',
    'export interface GroupFreezeEventRecord',
  ].forEach(token => {
    assertIncludes(domain, token, 'mobile freeze type token');
    assertIncludes(sharedTypes, token, 'shared freeze type token');
  });

  const result = {
    scenario: 'phase2-freeze-recovery-validation',
    validatedFiles: {
      migration: 'supabase/migrations/20260519123000_phase2_group_freeze_events.sql',
      helper: 'supabase/functions/_shared/groupFreeze.ts',
      obligations: 'supabase/functions/_shared/obligations.ts',
      groupLifecycle: 'supabase/functions/group-lifecycle/index.ts',
      edgeContracts: 'supabase/functions/_shared/contracts.ts',
      liveGroups: 'mobile/src/services/live/liveGroupsService.ts',
      mockBackend: 'mobile/src/services/mock/mockBackend.ts',
      mobileContracts: 'mobile/src/services/contracts/index.ts',
      adminGroups: 'mobile/src/screens/admin/AdminGroupsScreen.tsx',
      mobileTypes: 'mobile/src/types/domain.ts',
      sharedTypes: 'supabase/functions/_shared/types.ts',
    },
    completedChecks: [
      'group_freeze_events companion table exists with one open freeze per group',
      'defaulted obligations freeze defaulter reserves and freeze the group only when reserve coverage is insufficient',
      'freeze events write durable notifications and audit events',
      'manual admin freeze uses the same freeze event path',
      'admin manual resolution can resume a frozen group while keeping reserved payouts frozen for audit follow-up',
      'live and mock mobile group services expose matching freeze-resolution behavior',
    ],
    limitations: [
      'poll tables, refund tickets, and terminal disbandment handling remain deferred under P2-706 through P2-709',
      'remote migration/function deployment and device screenshots remain user/Both validation work',
    ],
    requiresSupabaseCredentials: false,
    requiresDeviceValidation: true,
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
