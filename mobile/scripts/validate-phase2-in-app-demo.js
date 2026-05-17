const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');

const files = {
  routes: 'mobile/src/navigation/routes.ts',
  navigator: 'mobile/src/navigation/AppNavigator.tsx',
  splash: 'mobile/src/screens/auth/SplashScreen.tsx',
  demoScreen: 'mobile/src/screens/auth/DemoTourScreen.tsx',
  authProvider: 'mobile/src/providers/AuthProvider.tsx',
  servicesProvider: 'mobile/src/providers/ServicesProvider.tsx',
  banner: 'mobile/src/components/DemoModeBanner.tsx',
  dashboard: 'mobile/src/screens/member/DashboardScreen.tsx',
  adminDashboard: 'mobile/src/screens/admin/AdminDashboardScreen.tsx',
  adminKyc: 'mobile/src/screens/admin/AdminKycScreen.tsx',
  adminGroups: 'mobile/src/screens/admin/AdminGroupsScreen.tsx',
  adminReports: 'mobile/src/screens/admin/AdminReportsScreen.tsx',
  mockBackend: 'mobile/src/services/mock/mockBackend.ts',
  mockTests: 'mobile/src/services/mock/mockBackend.test.ts',
  packageJson: 'package.json',
  demoRunbook: 'Build/delivery/demo/phase2_completed_features_demo.md',
  operatorChecklist: 'Build/delivery/demo/phase2_demo_operator_checklist.md',
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
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
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
  const content = Object.fromEntries(Object.entries(files).map(([key, relativePath]) => [key, read(relativePath)]));

  [
    "demoTour: 'DemoTour'",
  ].forEach(token => assertIncludes(content.routes, token, 'demo route'));

  [
    'DemoTourScreen',
    'routes.demoTour',
  ].forEach(token => assertIncludes(content.navigator, token, 'demo navigator wiring'));

  [
    'Try Demo Mode',
    'routes.demoTour',
  ].forEach(token => assertIncludes(content.splash, token, 'splash demo entry point'));

  [
    'Launch Member Demo',
    'Launch Admin Demo',
    'await startDemo(role)',
    "launch('Member')",
    "launch('Admin')",
    'Same screens, seeded data',
  ].forEach(token => assertIncludes(content.demoScreen, token, 'demo tour screen'));

  [
    'startDemo: (role',
    'mockBackend.reset()',
    'demo1234',
    'admin1234',
    'enableDemoMode()',
    'disableDemoMode()',
  ].forEach(token => assertIncludes(content.authProvider, token, 'auth demo session flow'));

  [
    'DemoModeContext',
    'demoMode ? mockBackend : liveServices',
    'useDemoMode',
    'queryClient.clear()',
  ].forEach(token => assertIncludes(content.servicesProvider, token, 'service demo mode switch'));

  [
    'Demo mode',
    'Seeded data, same screens.',
  ].forEach(token => assertIncludes(content.banner, token, 'demo banner copy'));

  assertIncludes(content.dashboard, 'DemoModeBanner', 'member demo banner');
  assertIncludes(content.adminDashboard, 'DemoModeBanner', 'admin demo banner');
  [
    'Review queues',
    'Provider activity',
  ].forEach(token => assertIncludes(content.adminDashboard, token, 'expanded admin dashboard token'));

  [
    'data.map',
    'Student ID',
    'Review note',
  ].forEach(token => assertIncludes(content.adminKyc, token, 'expanded admin KYC token'));

  [
    'More Phase 2 requests',
    'More legacy requests',
  ].forEach(token => assertIncludes(content.adminGroups, token, 'expanded admin groups token'));

  [
    'Operations snapshot',
    'Provider activity',
    'Audit timeline',
  ].forEach(token => assertIncludes(content.adminReports, token, 'expanded admin reports token'));

  [
    'reset()',
    'createDemoAdminUsers',
    'createDemoAdminGroups',
    'formation-demo-review',
    'formation-demo-public-review-2',
    'formation-demo-public',
    'formation-demo-private',
    'UNI-DEMO',
    "frequency: 'Daily'",
    'vesting_disabled_by_creator: true',
    'Campus Demo Formation',
    'Laptop Repair Rotation',
    'Dorm Coffee Circle',
    'Campus Lab Supplies',
    'Transport Mini Equb',
    'providerLogs',
  ].forEach(token => assertIncludes(content.mockBackend, token, 'seeded mock demo state'));

  [
    'seeds the in-app demo queues',
    'formation-demo-review',
    'formation-demo-private',
    'backend.reset()',
  ].forEach(token => assertIncludes(content.mockTests, token, 'Jest demo regression'));

  assertIncludes(content.packageJson, 'qa:phase2-in-app-demo', 'root npm script');
  assertIncludes(content.demoRunbook, 'In-App Demo Mode', 'demo runbook in-app section');
  assertIncludes(content.operatorChecklist, 'Try Demo Mode', 'operator checklist in-app step');

  const result = {
    scenario: 'phase2-in-app-demo-validation',
    validatedFiles: files,
    completedChecks: [
      'splash screen exposes a phone-ready demo entry point',
      'auth provider can start seeded member and admin demo sessions without persisted live tokens',
      'services provider can switch between live Supabase services and mock demo services',
      'mock backend reset restores repeatable final-draw, public/private formation, invite-code, and public admin formation queues',
      'member and admin dashboards show a visible demo-mode banner',
      'admin demo screens expose richer KYC, group, provider, reminder, and audit states',
      'demo docs and root npm script reference the in-app showcase path',
    ],
    requiresSupabaseCredentials: false,
    requiresDeviceValidation: true,
    limitations: [
      'this validation is static/Jest-backed and does not replace screenshots or on-device UAT',
      'demo mode intentionally uses seeded local mock data and simulated payment rails',
    ],
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
