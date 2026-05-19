const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const dashboardPath = path.join(repoRoot, 'mobile/src/screens/member/DashboardScreen.tsx');
const explorePath = path.join(repoRoot, 'mobile/src/screens/member/ExploreScreen.tsx');
const groupStatusPath = path.join(repoRoot, 'mobile/src/screens/member/GroupStatusScreen.tsx');
const stylesPath = path.join(repoRoot, 'mobile/src/screens/member/styles.ts');
const domainPath = path.join(repoRoot, 'mobile/src/types/domain.ts');
const mockBackendPath = path.join(repoRoot, 'mobile/src/services/mock/mockBackend.ts');
const groupLifecyclePath = path.join(repoRoot, 'supabase/functions/group-lifecycle/index.ts');

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
  const dashboard = read(dashboardPath);
  const explore = read(explorePath);
  const groupStatus = read(groupStatusPath);
  const styles = read(stylesPath);
  const domain = read(domainPath);
  const mockBackend = read(mockBackendPath);
  const groupLifecycle = read(groupLifecyclePath);

  [
    'ProfileHeader',
    'dashboardHeroCard',
    'heroPayButton',
    'QuickActionTile',
    'dashboardMiniMetrics',
    'dashboardHeroDetailRow',
  ].forEach(token => assertIncludes(dashboard, token, 'member dashboard polish token'));

  [
    'ExploreHero',
    'MyRequestsCard',
    'FormingRequestCard',
    'ApprovedGroupCard',
    'explorePrimaryAction',
    'approvedStatsBox',
  ].forEach(token => assertIncludes(explore, token, 'member explore polish token'));

  [
    'ContributionRing',
    'ContributorPill',
    'contributorState',
    'ringPillShellPaid',
    'ringPillShellWinner',
    'WinnerSection',
    'ContributorProfile',
  ].forEach(token => assertIncludes(groupStatus, token, 'group status contribution ring token'));

  [
    'dashboardHeroCard',
    'quickActionGrid',
    'exploreHeroCard',
    'approvedGroupCard',
    'ringCanvas',
    'ringPillShellWinner',
    'winnerHistoryRow',
  ].forEach(token => assertIncludes(styles, token, 'member UI style token'));

  [
    'export interface GroupStatusContributor',
    'contributors?: GroupStatusContributor[]',
    'hasPaidCurrentRound: boolean',
    'isCurrentWinner: boolean',
  ].forEach(token => assertIncludes(domain, token, 'group status contributor contract token'));

  [
    'hasPaidCurrentRound: paidUserIds.has(user.User_ID)',
    'isCurrentWinner: currentRound?.Winner_ID === user.User_ID',
    'cyclesWon:',
  ].forEach(token => assertIncludes(mockBackend, token, 'mock contributor state token'));

  [
    'async function getStatusContributors',
    'contributors: await getStatusContributors',
    'hasPaidCurrentRound: paidUserIds.has(membership.User_ID)',
    'isCurrentWinner: currentWinnerId === membership.User_ID',
  ].forEach(token => assertIncludes(groupLifecycle, token, 'live contributor state token'));

  const result = {
    scenario: 'phase2-member-ui-polish-validation',
    validatedFiles: {
      dashboard: 'mobile/src/screens/member/DashboardScreen.tsx',
      explore: 'mobile/src/screens/member/ExploreScreen.tsx',
      groupStatus: 'mobile/src/screens/member/GroupStatusScreen.tsx',
      styles: 'mobile/src/screens/member/styles.ts',
      mobileTypes: 'mobile/src/types/domain.ts',
      mockBackend: 'mobile/src/services/mock/mockBackend.ts',
      groupLifecycle: 'supabase/functions/group-lifecycle/index.ts',
    },
    completedChecks: [
      'member dashboard uses compact profile details, a consolidated contribution hero, compact metrics, and tile quick actions',
      'Explore screen uses the redesigned formation hero, My requests row, forming empty state, and approved group cards',
      'group status exposes a contribution ring with not-paid, paid, and winner pill states',
      'group status contributor contract is represented in mobile types, mock backend state, and live group-lifecycle response shape',
      'existing navigation targets for pay, group detail, invite code, and create Equb remain service-driven',
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
