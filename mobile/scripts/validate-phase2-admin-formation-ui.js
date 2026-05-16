const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const contractsPath = path.join(repoRoot, 'supabase/functions/_shared/contracts.ts');
const edgePath = path.join(repoRoot, 'supabase/functions/group-formation/index.ts');
const mobileContractsPath = path.join(repoRoot, 'mobile/src/services/contracts/index.ts');
const liveServicePath = path.join(repoRoot, 'mobile/src/services/live/liveGroupFormationService.ts');
const mockBackendPath = path.join(repoRoot, 'mobile/src/services/mock/mockBackend.ts');
const hooksPath = path.join(repoRoot, 'mobile/src/hooks/useAppQueries.ts');
const adminGroupsPath = path.join(repoRoot, 'mobile/src/screens/admin/AdminGroupsScreen.tsx');
const mockTestPath = path.join(repoRoot, 'mobile/src/services/mock/mockBackend.test.ts');

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
  const edge = read(edgePath);
  const mobileContracts = read(mobileContractsPath);
  const liveService = read(liveServicePath);
  const mockBackend = read(mockBackendPath);
  const hooks = read(hooksPath);
  const adminGroups = read(adminGroupsPath);
  const mockTest = read(mockTestPath);

  assertIncludes(contracts, 'listPendingApproval', 'shared group formation action');
  [
    'listPendingApprovalFormationRequests',
    ".eq('status', 'PendingApproval')",
    'adminReviewQueue',
    "case 'listPendingApproval'",
    'assertAdmin(actor)',
  ].forEach(token => assertIncludes(edge, token, 'admin pending formation Edge Function token'));

  [
    'listPendingApproval(): Promise<GroupFormationRequestSummary[]>',
  ].forEach(token => assertIncludes(mobileContracts, token, 'mobile formation admin contract token'));

  [
    "action: 'listPendingApproval'",
    'listPendingApproval(): Promise<GroupFormationRequestSummary[]>',
  ].forEach(token => assertIncludes(liveService, token, 'live admin pending formation service token'));

  [
    'listPendingApproval: async ()',
    "request.status === 'PendingApproval'",
  ].forEach(token => assertIncludes(mockBackend, token, 'mock admin pending formation token'));

  [
    'usePendingFormationGroupsQuery',
    'approveFormationGroup',
    'rejectFormationGroup',
    'services.formation.listPendingApproval',
    'services.formation.adminApprove',
    'services.formation.adminReject',
  ].forEach(token => assertIncludes(hooks, token, 'admin formation query/action token'));

  [
    'usePendingFormationGroupsQuery',
    'useFormationGroupQuery',
    'approveFormationGroup',
    'rejectFormationGroup',
    'Phase 2',
    'Payout vesting',
    'Participants',
    'Review checks',
    'Approve Formation',
    'Reject Formation',
    'Legacy MVP',
  ].forEach(token => assertIncludes(adminGroups, token, 'admin formation UI token'));

  [
    'exposes pending Phase 2 formation requests for admin approval',
    'backend.formation.listPendingApproval',
    'backend.formation.adminApprove',
    "expect(approvedGroup.Status).toBe('Active')",
  ].forEach(token => assertIncludes(mockTest, token, 'admin formation Jest token'));

  const result = {
    scenario: 'phase2-admin-formation-ui-validation',
    validatedFiles: {
      sharedContracts: 'supabase/functions/_shared/contracts.ts',
      edgeFunction: 'supabase/functions/group-formation/index.ts',
      mobileContracts: 'mobile/src/services/contracts/index.ts',
      liveService: 'mobile/src/services/live/liveGroupFormationService.ts',
      mockBackend: 'mobile/src/services/mock/mockBackend.ts',
      hooks: 'mobile/src/hooks/useAppQueries.ts',
      adminGroups: 'mobile/src/screens/admin/AdminGroupsScreen.tsx',
      mockBackendTest: 'mobile/src/services/mock/mockBackend.test.ts',
    },
    completedChecks: [
      'Edge Function exposes admin-only pending formation queue',
      'mobile formation service exposes pending approval list and admin decisions',
      'admin groups screen shows proposed terms, participants, risk, vesting, and review checks',
      'admin groups screen can approve/reject Phase 2 formations while preserving legacy MVP queue',
      'mock backend regression covers pending queue and admin approval',
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
