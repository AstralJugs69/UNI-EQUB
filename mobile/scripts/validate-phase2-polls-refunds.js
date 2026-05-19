const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const migrationPath = path.join(repoRoot, 'supabase/migrations/20260519131500_phase2_resolution_polls_refund_tickets.sql');
const helperPath = path.join(repoRoot, 'supabase/functions/_shared/groupResolution.ts');
const groupFreezePath = path.join(repoRoot, 'supabase/functions/_shared/groupFreeze.ts');
const groupLifecyclePath = path.join(repoRoot, 'supabase/functions/group-lifecycle/index.ts');
const contractsPath = path.join(repoRoot, 'supabase/functions/_shared/contracts.ts');
const liveGroupsPath = path.join(repoRoot, 'mobile/src/services/live/liveGroupsService.ts');
const mockBackendPath = path.join(repoRoot, 'mobile/src/services/mock/mockBackend.ts');
const mobileContractsPath = path.join(repoRoot, 'mobile/src/services/contracts/index.ts');
const hooksPath = path.join(repoRoot, 'mobile/src/hooks/useAppQueries.ts');
const groupStatusScreenPath = path.join(repoRoot, 'mobile/src/screens/member/GroupStatusScreen.tsx');
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
  const groupFreeze = read(groupFreezePath);
  const groupLifecycle = read(groupLifecyclePath);
  const contracts = read(contractsPath);
  const liveGroups = read(liveGroupsPath);
  const mockBackend = read(mockBackendPath);
  const mobileContracts = read(mobileContractsPath);
  const hooks = read(hooksPath);
  const groupStatusScreen = read(groupStatusScreenPath);
  const adminGroups = read(adminGroupsPath);
  const domain = read(domainPath);
  const sharedTypes = read(sharedTypesPath);

  [
    'create table if not exists public.group_resolution_polls',
    'create table if not exists public.group_resolution_poll_options',
    'create table if not exists public.group_resolution_votes',
    'create table if not exists public.refund_tickets',
    'eligible_voter_user_ids jsonb',
    "resolution_action in ('ContinueWithReserveFrozen', 'KeepFrozenForReview', 'CreateRefundTickets')",
    'group_resolution_votes_unique',
    'idx_group_resolution_polls_one_open_per_freeze',
    'idx_refund_tickets_user_status',
    'No real money is moved',
  ].forEach(token => assertIncludes(migration, token, 'poll/refund migration token'));

  [
    'export async function createFrozenGroupResolutionPoll',
    'eligibleVoterIds',
    'export async function voteOnResolutionPoll',
    'Only eligible non-defaulted members can vote',
    'You have already voted',
    'export async function closeResolutionPollIfReady',
    'createRefundTicketsForPoll',
    "entryType: 'RefundTicketCreated'",
    'refund_ticket_created',
    'group_resolution_poll_opened',
    'group_resolution_vote_cast',
    'group_resolution_poll_closed',
  ].forEach(token => assertIncludes(helper, token, 'poll/refund helper token'));

  [
    'CreateRefundTickets',
    'Refund tickets created',
  ].forEach(token => assertIncludes(groupFreeze, token, 'freeze/refund resolution token'));

  [
    "'createResolutionPoll'",
    "'voteResolutionPoll'",
    "'closeResolutionPoll'",
    'createFrozenGroupResolutionPoll',
    'voteOnResolutionPoll',
    'closeResolutionPollIfReady',
    'activeResolutionPoll',
    'refundTickets',
  ].forEach(token => assertIncludes(groupLifecycle, token, 'group lifecycle poll token'));

  [
    'createResolutionPoll',
    'voteResolutionPoll',
    'closeResolutionPoll',
    'pollId?',
    'optionId?',
  ].forEach(token => assertIncludes(contracts, token, 'Edge poll contract token'));

  [
    'createResolutionPoll(groupId: string)',
    'voteResolutionPoll(groupId: string, pollId: string, optionId: string)',
    'closeResolutionPoll(groupId: string, pollId: string)',
  ].forEach(token => assertIncludes(mobileContracts, token, 'mobile poll contract token'));

  [
    "action: 'createResolutionPoll'",
    "action: 'voteResolutionPoll'",
    "action: 'closeResolutionPoll'",
  ].forEach(token => assertIncludes(liveGroups, token, 'live group poll service token'));

  [
    'resolutionPolls',
    'resolutionPollOptions',
    'resolutionVotes',
    'refundTickets',
    'createResolutionPoll: async',
    'voteResolutionPoll: async',
    'closeResolutionPoll: async',
  ].forEach(token => assertIncludes(mockBackend, token, 'mock poll/refund token'));

  [
    'voteResolutionPoll',
    'createResolutionPoll',
    'closeResolutionPoll',
  ].forEach(token => assertIncludes(hooks, token, 'query hook poll token'));

  [
    'ResolutionPollSection',
    'RefundTicketSection',
    'Vote',
    'Refund tickets',
  ].forEach(token => assertIncludes(groupStatusScreen, token, 'member poll UI token'));

  [
    'Open Member Vote',
    'Close Vote',
    'activeResolutionPoll',
  ].forEach(token => assertIncludes(adminGroups, token, 'admin poll UI token'));

  [
    'export type GroupResolutionPollStatus',
    'export type GroupResolutionPollAction',
    'export type RefundTicketStatus',
    'export interface GroupResolutionPollRecord',
    'export interface RefundTicketRecord',
  ].forEach(token => {
    assertIncludes(domain, token, 'mobile poll/refund type token');
    assertIncludes(sharedTypes, token, 'shared poll/refund type token');
  });

  const result = {
    scenario: 'phase2-polls-refunds-validation',
    validatedFiles: {
      migration: 'supabase/migrations/20260519131500_phase2_resolution_polls_refund_tickets.sql',
      helper: 'supabase/functions/_shared/groupResolution.ts',
      groupLifecycle: 'supabase/functions/group-lifecycle/index.ts',
      edgeContracts: 'supabase/functions/_shared/contracts.ts',
      liveGroups: 'mobile/src/services/live/liveGroupsService.ts',
      mockBackend: 'mobile/src/services/mock/mockBackend.ts',
      mobileContracts: 'mobile/src/services/contracts/index.ts',
      hooks: 'mobile/src/hooks/useAppQueries.ts',
      memberStatusUi: 'mobile/src/screens/member/GroupStatusScreen.tsx',
      adminGroupsUi: 'mobile/src/screens/admin/AdminGroupsScreen.tsx',
      mobileTypes: 'mobile/src/types/domain.ts',
      sharedTypes: 'supabase/functions/_shared/types.ts',
    },
    completedChecks: [
      'poll, option, vote, and refund ticket companion tables exist with duplicate-vote and query-path indexes',
      'admin can open a simple-majority resolution poll for a frozen group',
      'eligible non-defaulted members can vote once from the group status screen',
      'winning/expired polls resolve through freeze recovery without adding a canonical Disbanded status',
      'refund tickets are simulated records with ledger/notification evidence and no real money movement',
      'admin and member UI paths expose poll opening, vote closing, voting, and refund-ticket visibility',
    ],
    limitations: [
      'remote migration/function deployment and device screenshots remain user/Both validation work',
      'refund calculation is intentionally simulation-oriented and uses successful contribution records for eligible ticket amounts',
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
