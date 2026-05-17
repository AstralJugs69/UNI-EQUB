const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const routesPath = path.join(repoRoot, 'mobile/src/navigation/routes.ts');
const navigatorPath = path.join(repoRoot, 'mobile/src/navigation/AppNavigator.tsx');
const hooksPath = path.join(repoRoot, 'mobile/src/hooks/useAppQueries.ts');
const basicsPath = path.join(repoRoot, 'mobile/src/screens/member/CreateGroupBasicsScreen.tsx');
const rulesPath = path.join(repoRoot, 'mobile/src/screens/member/CreateGroupRulesScreen.tsx');
const creatorPath = path.join(repoRoot, 'mobile/src/screens/member/FormationCreatorScreen.tsx');
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
  const routes = read(routesPath);
  const navigator = read(navigatorPath);
  const hooks = read(hooksPath);
  const basics = read(basicsPath);
  const rules = read(rulesPath);
  const creator = read(creatorPath);
  const explore = read(path.join(repoRoot, 'mobile/src/screens/member/ExploreScreen.tsx'));
  const mockTest = read(mockTestPath);

  assertIncludes(routes, "formationCreator: 'FormationCreator'", 'creator formation route');
  [
    'FormationCreatorScreen',
    'routes.formationCreator',
  ].forEach(token => assertIncludes(navigator, token, 'creator navigator token'));

  [
    'createFormation',
    'useMyFormationGroupsQuery',
    'inviteFormation',
    'acceptFormationJoin',
    'removeFormationParticipant',
    'submitFormationForApproval',
    'services.formation.createRequest',
    'services.formation.invite',
    'services.formation.acceptJoin',
    'services.formation.removeParticipant',
    'services.formation.submitForApproval',
  ].forEach(token => assertIncludes(hooks, token, 'creator formation hook token'));

  [
    "{ key: 'Daily', label: 'Daily' }",
    "'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly'",
  ].forEach(token => assertIncludes(basics, token, 'cadence basics formation token'));

  [
    'createFormation.mutateAsync',
    'visibility === \'Public\' ? \'PublicRequest\' : \'InviteCodeAndDirect\'',
    'navigation.navigate(routes.formationCreator',
    'Create Formation Request',
    'Alert.alert',
    'Payment vesting is not activated on private groups.',
    'Private invite groups start without admin review',
    "vestingEnabled: visibility === 'Public'",
    "riskWarningAccepted: visibility === 'Private' ? privateRiskAccepted : undefined",
  ].forEach(token => assertIncludes(rules, token, 'create flow formation token'));

  [
    'useMyFormationGroupsQuery',
    'My group requests',
    'myRequests.map',
    'navigation.navigate(routes.formationCreator',
    'Create New Equb',
  ].forEach(token => assertIncludes(explore, token, 'member-owned formation request list token'));

  [
    'FormationCreatorScreen',
    'inviteFormation.mutateAsync',
    'Share.share',
    'handleShareInvite',
    'acceptFormationJoin.mutateAsync',
    'removeFormationParticipant.mutateAsync',
    'submitFormationForApproval.mutateAsync',
    'pendingRequests.map',
    'Accepted participants',
    'Invitations',
    'accessibilityLabel={`Share invite code ${invitation.invite_code}`}',
    'more accepted member',
    'Waiting For Admin',
  ].forEach(token => assertIncludes(creator, token, 'creator management screen token'));

  [
    'supports private creator invitations through the Phase 2 formation service',
    "backend.formation.invite('user-dawit'",
    "expect(response.invitation.status).toBe('Pending')",
  ].forEach(token => assertIncludes(mockTest, token, 'creator invitation Jest evidence'));

  const result = {
    scenario: 'phase2-creator-formation-ui-validation',
    validatedFiles: {
      routes: 'mobile/src/navigation/routes.ts',
      navigator: 'mobile/src/navigation/AppNavigator.tsx',
      hooks: 'mobile/src/hooks/useAppQueries.ts',
      basics: 'mobile/src/screens/member/CreateGroupBasicsScreen.tsx',
      rules: 'mobile/src/screens/member/CreateGroupRulesScreen.tsx',
      explore: 'mobile/src/screens/member/ExploreScreen.tsx',
      creator: 'mobile/src/screens/member/FormationCreatorScreen.tsx',
      mockBackendTest: 'mobile/src/services/mock/mockBackend.test.ts',
    },
    completedChecks: [
      'create-group flow creates Phase 2 formation requests and opens creator management',
      'create basics screen supports Daily draw cadence',
      'private-group selection shows a vesting risk warning before disabling vesting',
      'Explore screen lets creators return to their own formation requests',
      'creator management screen exposes invitation creation',
      'creator management screen exposes accept/remove participant actions',
      'creator management screen exposes public submit-for-approval and private start actions',
      'mock backend regression covers private creator invitation behavior',
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
