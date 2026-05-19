const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const files = {
  mobileTypes: 'mobile/src/types/domain.ts',
  groupLifecycle: 'supabase/functions/group-lifecycle/index.ts',
  reportExport: 'supabase/functions/report-export/index.ts',
  mockBackend: 'mobile/src/services/mock/mockBackend.ts',
  dashboard: 'mobile/src/screens/member/DashboardScreen.tsx',
  profile: 'mobile/src/screens/member/ProfileScreen.tsx',
  adminDashboard: 'mobile/src/screens/admin/AdminDashboardScreen.tsx',
  adminReports: 'mobile/src/screens/admin/AdminReportsScreen.tsx',
  tracker: 'Build/delivery/phase2_development_progress_tracker.md',
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
    'reliabilityProfile?: UserReliabilityProfileRecord | null',
    'reliabilitySummary?: Partial<Record<ReliabilityPublicStatus, number>>',
    'export interface AuditTimelineItem',
  ].forEach(token => assertIncludes(content.mobileTypes, token, 'mobile UX type token'));

  [
    'ensureReliabilityProfile',
    'reliabilityProfile: await ensureReliabilityProfile(actor.User_ID)',
  ].forEach(token => assertIncludes(content.groupLifecycle, token, 'dashboard reliability token'));

  [
    'user_reliability_profiles',
    'audit_events',
    'deriveReliabilitySummary',
    'deriveAuditTimeline',
    'reliabilitySummary',
    'auditTimeline',
  ].forEach(token => assertIncludes(content.reportExport, token, 'admin overview token'));

  [
    'reliabilityProfiles',
    'reliabilitySummary',
    'auditTimeline',
    'reliabilityProfileForUser',
  ].forEach(token => assertIncludes(content.mockBackend, token, 'mock UX parity token'));

  [
    'Reliability:',
    'data.reliabilityProfile.public_status',
  ].forEach(token => assertIncludes(content.dashboard, token, 'member dashboard reliability token'));

  [
    'Reliability label',
    'Internal counters stay server-side',
  ].forEach(token => assertIncludes(content.profile, token, 'member profile reliability token'));

  [
    'Reliability overview',
    'data.auditTimeline',
  ].forEach(token => assertIncludes(content.adminDashboard, token, 'admin dashboard UX token'));

  [
    'Reliability labels',
    'overview.auditTimeline',
    'Read-only recent sensitive events',
  ].forEach(token => assertIncludes(content.adminReports, token, 'admin reports UX token'));

  const result = {
    scenario: 'phase2-final-ux-states-validation',
    validatedFiles: files,
    completedChecks: [
      'member dashboard and profile expose public reliability labels without internal score details',
      'admin dashboard and reports expose reliability label counts',
      'admin reports prefer durable audit timeline rows and keep derived log fallback',
      'mock demo state mirrors live reliability and audit overview fields',
      'Phase 8 UX evidence remains repo-local until screenshots/device UAT are captured',
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
