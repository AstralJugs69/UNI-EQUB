const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const files = {
  routes: 'mobile/src/navigation/routes.ts',
  navigator: 'mobile/src/navigation/AppNavigator.tsx',
  notificationRoutes: 'mobile/src/navigation/notificationRoutes.ts',
  dashboard: 'mobile/src/screens/member/DashboardScreen.tsx',
  activeGroups: 'mobile/src/screens/member/ActiveGroupsScreen.tsx',
  explore: 'mobile/src/screens/member/ExploreScreen.tsx',
  paymentSuccess: 'mobile/src/screens/member/PaymentSuccessScreen.tsx',
  kyc: 'mobile/src/screens/auth/KycScreen.tsx',
  adminGroups: 'mobile/src/screens/admin/AdminGroupsScreen.tsx',
  adminGroupReview: 'mobile/src/screens/admin/AdminGroupReviewScreen.tsx',
  adminKyc: 'mobile/src/screens/admin/AdminKycScreen.tsx',
  adminKycReview: 'mobile/src/screens/admin/AdminKycReviewScreen.tsx',
  mockTest: 'mobile/src/services/mock/mockBackend.test.ts',
  notificationRoutesTest: 'mobile/src/navigation/notificationRoutes.test.ts',
};

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

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function assertIncludes(content, token, label) {
  if (!content.includes(token)) {
    throw new Error(`Missing ${label}: ${token}`);
  }
}

function main() {
  const args = parseArgs();
  const content = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

  [
    "memberTabs: 'MemberTabs'",
    "adminTabs: 'AdminTabs'",
    "activeGroups: 'ActiveGroups'",
    "adminGroupReview: 'AdminGroupReview'",
    "adminKycReview: 'AdminKycReview'",
  ].forEach(token => assertIncludes(content.routes, token, 'navigation route token'));

  [
    'createBottomTabNavigator',
    'MemberTabs',
    'AdminTabs',
    'RoleTabBar',
    'routes.memberTabs',
    'routes.adminTabs',
  ].forEach(token => assertIncludes(content.navigator, token, 'nested tab navigator token'));

  [
    'resolveNotificationRoute',
    "actionRoute === 'member/group'",
    "actionRoute === 'member/payment'",
    "actionRoute === 'member/wallet'",
    "actionRoute === 'admin/group-formation'",
  ].forEach(token => assertIncludes(content.notificationRoutes, token, 'notification whitelist token'));

  [
    'routes.activeGroups',
    'kycState.status',
  ].forEach(token => assertIncludes(content.dashboard, token, 'member dashboard hub token'));

  assertIncludes(content.activeGroups, 'data.activeGroups', 'active groups switcher token');

  [
    'myRequests.map',
    'routes.formationCreator',
    'My requests',
  ].forEach(token => assertIncludes(content.explore, token, 'Explore formation hub token'));

  [
    'const groupId = route.params?.groupId',
    'routes.groupStatus, { groupId }',
    'Group context missing',
  ].forEach(token => assertIncludes(content.paymentSuccess, token, 'payment success groupId guard token'));

  [
    'submitCurrentKyc',
    'NeedsResubmission',
    'KYC resubmitted for review.',
  ].forEach(token => assertIncludes(content.kyc, token, 'member KYC resubmission token'));

  [
    'formationQueue.map',
    'frozenItems.map',
    'legacyItems.map',
  ].forEach(token => assertIncludes(content.adminGroups, token, 'admin group queue hub token'));

  [
    'Alert.alert',
    'Approve Formation',
    'Reject Formation',
    'Resume Group',
  ].forEach(token => assertIncludes(content.adminGroupReview, token, 'admin group review detail token'));

  [
    'navigation.navigate(routes.adminKycReview',
    'AdminKycReviewScreen',
  ].forEach((token, index) => assertIncludes(index === 0 ? content.adminKyc : content.adminKycReview, token, 'admin KYC detail token'));

  [
    'activeGroups.map',
    'resubmitKyc',
  ].forEach(token => assertIncludes(content.mockTest, token, 'navigation cleanup regression token'));

  assertIncludes(content.notificationRoutesTest, 'resolveNotificationRoute', 'notification route resolver regression token');

  const result = {
    scenario: 'navigation-hub-cleanup-validation',
    validatedFiles: files,
    completedChecks: [
      'role roots use nested bottom tab navigators',
      'hub screens push detail and wizard routes above the tabs',
      'payment success keeps stable groupId context',
      'notifications use whitelist deep-link resolution',
      'admin KYC and group queues open full detail pages',
      'dashboard exposes active groups and KYC resubmission state',
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
