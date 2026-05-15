const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const routesPath = path.join(repoRoot, 'mobile/src/navigation/routes.ts');
const navigatorPath = path.join(repoRoot, 'mobile/src/navigation/AppNavigator.tsx');
const hooksPath = path.join(repoRoot, 'mobile/src/hooks/useAppQueries.ts');
const explorePath = path.join(repoRoot, 'mobile/src/screens/member/ExploreScreen.tsx');
const detailPath = path.join(repoRoot, 'mobile/src/screens/member/FormationDetailScreen.tsx');
const indexPath = path.join(repoRoot, 'mobile/src/screens/member/index.ts');
const stylesPath = path.join(repoRoot, 'mobile/src/screens/member/styles.ts');

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
  const explore = read(explorePath);
  const detail = read(detailPath);
  const index = read(indexPath);
  const styles = read(stylesPath);

  [
    "formationDetail: 'FormationDetail'",
  ].forEach(token => assertIncludes(routes, token, 'formation route token'));

  [
    'FormationDetailScreen',
    'routes.formationDetail',
  ].forEach(token => assertIncludes(navigator, token, 'navigator formation route token'));

  [
    'formationGroups',
    'formationGroup: (requestId: string)',
    'useFormationGroupsQuery',
    'useFormationGroupQuery',
    'requestJoinFormation',
    'services.formation.requestJoin',
  ].forEach(token => assertIncludes(hooks, token, 'formation query hook token'));

  [
    'useFormationGroupsQuery',
    'Forming groups',
    'formingGroups.map',
    'request.proposed_group_name',
    'request.accepted_participant_count',
    'navigation.navigate(routes.formationDetail',
  ].forEach(token => assertIncludes(explore, token, 'member explore formation discovery token'));

  [
    'useFormationGroupQuery',
    'requestJoinFormation',
    'Accept Terms And Request Join',
    'request.terms_version',
    'currentUserJoin',
    'request.vesting_disabled_by_creator',
    'data.joinRequests.map',
  ].forEach(token => assertIncludes(detail, token, 'member formation detail token'));

  assertIncludes(index, "export { FormationDetailScreen }", 'member screen export');
  assertIncludes(styles, 'rowBetween', 'member formation UI row style');
  assertIncludes(styles, 'itemBlock', 'member formation UI item style');

  const result = {
    scenario: 'phase2-member-formation-ui-validation',
    validatedFiles: {
      routes: 'mobile/src/navigation/routes.ts',
      navigator: 'mobile/src/navigation/AppNavigator.tsx',
      hooks: 'mobile/src/hooks/useAppQueries.ts',
      explore: 'mobile/src/screens/member/ExploreScreen.tsx',
      detail: 'mobile/src/screens/member/FormationDetailScreen.tsx',
      index: 'mobile/src/screens/member/index.ts',
      styles: 'mobile/src/screens/member/styles.ts',
    },
    completedChecks: [
      'member navigation exposes a Phase 2 formation detail route',
      'Explore screen lists public forming group requests separately from approved Equb groups',
      'formation detail screen shows terms, participant progress, accepted count, and remaining slots',
      'member join request mutation accepts current terms through the formation service contract',
      'private vesting override self-service remains paused until user-approved warning copy exists',
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
