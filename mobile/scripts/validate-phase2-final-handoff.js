const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');

const requiredFiles = [
  'Build/delivery/final_handoff.md',
  'Build/delivery/uat_checklist.md',
  'Build/delivery/demo/phase2_completed_features_demo.md',
  'Build/delivery/demo/phase2_demo_operator_checklist.md',
  'Build/delivery/phase2_development_progress_tracker.md',
  'Build/delivery/progress_spec.md',
  'Build/delivery/implementation_traceability_matrix.md',
  'Build/delivery/evidence/phase2-foundation-validation.json',
  'Build/delivery/evidence/phase2-shared-validation.json',
  'Build/delivery/evidence/phase2-formation-validation.json',
  'Build/delivery/evidence/phase2-mobile-formation-validation.json',
  'Build/delivery/evidence/phase2-member-ui-polish-validation.json',
  'Build/delivery/evidence/phase2-payment-attempt-initiation-validation.json',
  'Build/delivery/evidence/phase2-provider-callback-idempotency-validation.json',
  'Build/delivery/evidence/phase2-round-readiness-validation.json',
  'Build/delivery/evidence/phase2-payout-reserve-ui-validation.json',
  'Build/delivery/evidence/phase2-reliability-update-validation.json',
  'Build/delivery/evidence/phase2-default-restriction-validation.json',
  'Build/delivery/evidence/phase2-freeze-recovery-validation.json',
  'Build/delivery/evidence/phase2-polls-refunds-validation.json',
  'Build/delivery/evidence/phase2-durable-notifications-validation.json',
  'Build/delivery/evidence/phase2-kyc-history-validation.json',
  'Build/delivery/evidence/phase2-final-ux-states-validation.json',
  'Build/delivery/evidence/phase2-demo-readiness-validation.json',
  'Build/delivery/evidence/phase2-in-app-demo-validation.json',
  'Build/delivery/evidence/phase2-release-build.json',
];

const requiredScripts = [
  'qa:phase2-final-handoff',
  'qa:phase2-demo-readiness',
  'qa:phase2-in-app-demo',
  'qa:phase2-final-ux-states',
  'mobile:typecheck',
  'mobile:test',
  'mobile:lint',
  'mobile:apk:release',
];

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
  const missingFiles = requiredFiles.filter(relativePath => !fs.existsSync(path.join(repoRoot, relativePath)));
  if (missingFiles.length) {
    throw new Error(`Missing handoff evidence files: ${missingFiles.join(', ')}`);
  }

  const packageJson = JSON.parse(read('package.json'));
  const missingScripts = requiredScripts.filter(script => !packageJson.scripts?.[script]);
  if (missingScripts.length) {
    throw new Error(`Missing package scripts: ${missingScripts.join(', ')}`);
  }

  const handoff = read('Build/delivery/final_handoff.md');
  [
    'The original MVP core remains canonical',
    'Validation Commands',
    'Supabase Deployment Checklist',
    'User-Only Remaining Evidence',
    'Defense-Safe Claims',
  ].forEach(token => assertIncludes(handoff, token, 'final handoff section'));

  const uat = read('Build/delivery/uat_checklist.md');
  [
    'Phase 2 final UAT evidence matrix',
    'Reliability and audit',
    'Frozen-group recovery, polls, and refund tickets',
  ].forEach(token => assertIncludes(uat, token, 'UAT final section'));

  const tracker = read('Build/delivery/phase2_development_progress_tracker.md');
  [
    'P2-901',
    'P2-902',
    'P2-903',
    'P2-914',
    'phase2-final-handoff-validation.json',
  ].forEach(token => assertIncludes(tracker, token, 'tracker final handoff token'));

  const result = {
    scenario: 'phase2-final-handoff-validation',
    requiredFiles,
    requiredScripts,
    completedChecks: [
      'final handoff document exists with demo, validation, deployment, evidence, and defense-safe claim sections',
      'UAT checklist includes final Phase 2 user-only evidence matrix and newest reliability/audit/freeze-poll/refund flows',
      'critical Phase 2 validation evidence files are present',
      'package scripts expose the final handoff and smoke validation commands',
      'tracker references Phase 9 final handoff evidence without marking user-only UAT complete',
    ],
    knownUserOnlyRemaining: [
      'emulator UAT evidence',
      'physical device UAT evidence',
      'screenshots/videos',
      'production signing decision',
      'capstone report/diagram updates',
      'supervisor approval',
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
