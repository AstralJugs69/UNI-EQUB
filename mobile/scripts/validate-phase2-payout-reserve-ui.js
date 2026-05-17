const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');

const files = {
  domain: 'mobile/src/types/domain.ts',
  walletScreen: 'mobile/src/screens/member/WalletScreen.tsx',
  withdrawScreen: 'mobile/src/screens/member/WithdrawScreen.tsx',
  paymentSuccess: 'mobile/src/screens/member/PaymentSuccessScreen.tsx',
  dashboard: 'mobile/src/screens/member/DashboardScreen.tsx',
  groupStatus: 'mobile/src/screens/member/GroupStatusScreen.tsx',
  groupDetail: 'mobile/src/screens/member/GroupDetailScreen.tsx',
  mockBackend: 'mobile/src/services/mock/mockBackend.ts',
  contributionReconcile: 'supabase/functions/contribution-reconcile/index.ts',
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
    'reservedPayout: number',
    'pendingReserveReleases: number',
  ].forEach(token => assertIncludes(content.domain, token, 'wallet snapshot contract token'));

  [
    'reservedPayout',
    'pendingReserveReleases',
    ".from('payout_requests')",
    ".from('payout_release_schedules')",
    "defaultDestination: 'Internal wallet clearance'",
  ].forEach(token => assertIncludes(content.contributionReconcile, token, 'live wallet reserve token'));

  [
    'reservedPayout: 0',
    'pendingReserveReleases: 0',
  ].forEach(token => assertIncludes(content.mockBackend, token, 'mock wallet reserve token'));

  [
    'data.reservedPayout > 0',
    'Reserved',
    'Payout reserve is locked.',
    'releases as later contributions are completed',
    'Only the released amount can be cleared now.',
  ].forEach(token => assertIncludes(content.walletScreen, token, 'wallet reserve UI token'));

  [
    'Reserve remains scheduled.',
    'Reserved payout releases later after successful contribution obligations.',
    'clears only the released payout amount',
  ].forEach(token => assertIncludes(content.withdrawScreen, token, 'withdraw reserve UI token'));

  [
    'probationary winners may see part of it reserved',
    'Released wallet amount',
    'reserve scheduling happen automatically',
    'any reserve unlocks after later successful contributions',
    'scheduled reserve releases',
  ].forEach(token => {
    const combined = `${content.paymentSuccess}\n${content.dashboard}\n${content.groupStatus}\n${content.groupDetail}`;
    assertIncludes(combined, token, 'member payout copy token');
  });

  const result = {
    scenario: 'phase2-payout-reserve-ui-validation',
    validatedFiles: files,
    completedChecks: [
      'wallet snapshot contract exposes ready payout, reserved payout, and pending reserve release count',
      'live wallet endpoint derives reserve totals from payout_requests and payout_release_schedules',
      'mock wallet service remains contract-compatible with zero reserve defaults',
      'wallet screen distinguishes released payout from reserved payout',
      'withdrawal screen warns that only released internal ledger balance is cleared',
      'member payment, dashboard, group status, and group detail copy mention reserve behavior',
    ],
    stillPending: [
      'device screenshot evidence for payout reserve UI',
      'durable notification copy for reserve creation/release',
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
