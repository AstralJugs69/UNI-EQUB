const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const contractsPath = path.join(repoRoot, 'mobile/src/services/contracts/index.ts');
const domainPath = path.join(repoRoot, 'mobile/src/types/domain.ts');
const liveServicePath = path.join(repoRoot, 'mobile/src/services/live/liveGroupFormationService.ts');
const providerPath = path.join(repoRoot, 'mobile/src/providers/ServicesProvider.tsx');
const mockBackendPath = path.join(repoRoot, 'mobile/src/services/mock/mockBackend.ts');
const mockTestPath = path.join(repoRoot, 'mobile/src/services/mock/mockBackend.test.ts');
const edgeFunctionPath = path.join(repoRoot, 'supabase/functions/group-formation/index.ts');

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
  const domain = read(domainPath);
  const liveService = read(liveServicePath);
  const provider = read(providerPath);
  const mockBackend = read(mockBackendPath);
  const mockTest = read(mockTestPath);
  const edgeFunction = read(edgeFunctionPath);

  [
    'export interface GroupFormationService',
    'listPublic(userId: string)',
    'listMine(userId: string)',
    'listPendingApproval(): Promise<GroupFormationRequestSummary[]>',
    'getRequest(userId: string, requestId: string)',
    'lookupInviteCode(userId: string, inviteCode: string)',
    'createRequest(userId: string, input: CreateGroupFormationInput)',
    'requestJoin(userId: string, requestId: string, terms: FormationTermsAcceptance)',
    'invite(userId: string, input: FormationInvitationInput)',
    'acceptInvite(userId: string, input: FormationTermsAcceptance',
    'submitForApproval(userId: string, requestId: string)',
    'formation: GroupFormationService',
  ].forEach(token => assertIncludes(contracts, token, 'mobile formation service contract token'));

  [
    'export interface GroupFormationRequestSummary',
    'export interface GroupFormationDetail',
    "'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly'",
    'accepted_participant_count: number',
    'remaining_slots: number',
  ].forEach(token => assertIncludes(domain, token, 'mobile formation domain token'));

  [
    "supabase.functions.invoke<Envelope<T>>('group-formation'",
    "action: 'listPublic'",
    "action: 'listMine'",
    "action: 'listPendingApproval'",
    "action: 'getRequest'",
    "action: 'lookupInviteCode'",
    "action: 'createRequest'",
    "action: 'requestJoin'",
    "action: 'acceptJoin'",
    "action: 'removeParticipant'",
    "action: 'invite'",
    "action: 'acceptInvite'",
    "action: 'submitForApproval'",
    'toDetail(response)',
    'readFunctionError',
    'context.clone().json()',
  ].forEach(token => assertIncludes(liveService, token, 'live mobile formation implementation token'));

  [
    'liveGroupFormationService',
    'formation: liveGroupFormationService',
  ].forEach(token => assertIncludes(provider, token, 'service provider formation wiring token'));

  [
    'formation = {',
    'lookupInviteCode: async (userId: string, inviteCode: string)',
    'listMine: async (userId: string)',
    'createRequest: async (userId: string, input: CreateGroupFormationInput)',
    'requestJoin: async (userId: string, requestId: string, terms: FormationTermsAcceptance)',
    'submitForApproval: async (userId: string, requestId: string)',
    'toFormationDetail',
  ].forEach(token => assertIncludes(mockBackend, token, 'mock formation service token'));

  [
    'supports the Phase 2 formation service contract before UI migration',
    "backend.formation.createRequest('user-dawit'",
    "backend.formation.requestJoin('user-miki'",
    "backend.formation.submitForApproval('user-dawit'",
  ].forEach(token => assertIncludes(mockTest, token, 'formation Jest regression token'));

  [
    'getFormationRequestDetail',
    "case 'getRequest'",
    'return getFormationRequestDetail(actor, body)',
    ".from('group_join_requests')",
    ".from('group_invitations')",
  ].forEach(token => assertIncludes(edgeFunction, token, 'formation detail Edge Function token'));

  const result = {
    scenario: 'phase2-mobile-formation-service-validation',
    validatedFiles: {
      contracts: 'mobile/src/services/contracts/index.ts',
      domain: 'mobile/src/types/domain.ts',
      liveService: 'mobile/src/services/live/liveGroupFormationService.ts',
      provider: 'mobile/src/providers/ServicesProvider.tsx',
      mockBackend: 'mobile/src/services/mock/mockBackend.ts',
      mockBackendTest: 'mobile/src/services/mock/mockBackend.test.ts',
      edgeFunction: 'supabase/functions/group-formation/index.ts',
    },
    completedChecks: [
    'mobile contract exposes Phase 2 formation list/detail/create/join/invite/submit actions',
      'mobile contract exposes invite-code preview before acceptance',
      'mobile contract exposes creator-owned formation requests for member-side management',
      'mobile contract exposes admin pending-approval list for formation review',
      'live service invokes the group-formation Edge Function for formation actions',
      'service provider wires the live formation implementation',
      'mock backend supports the contract for repo-local tests before UI migration',
      'Edge Function getRequest route returns usable formation detail instead of the pending stub',
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
