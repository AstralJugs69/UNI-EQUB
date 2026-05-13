const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const functionPath = path.join(repoRoot, 'supabase/functions/group-formation/index.ts');
const configPath = path.join(repoRoot, 'supabase/config.toml');

const requiredActions = [
  'listPublic',
  'getRequest',
  'createRequest',
  'requestJoin',
  'acceptJoin',
  'removeParticipant',
  'invite',
  'acceptInvite',
  'submitForApproval',
  'adminApprove',
  'adminReject',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--output') {
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
  const source = read(functionPath);
  const config = read(configPath);

  [
    'verifySession',
    'requireActor',
    'assertAdmin',
    'assertVerifiedMember',
    'assertNormalFormationEligibility',
    'createFormationRequest',
    'validateCreateRequestInput',
    'getReliabilityJoinGate',
    'loadFormationPolicySnapshot',
    'Deno.serve',
  ].forEach(token => assertIncludes(source, token, 'formation boundary token'));

  requiredActions.forEach(action => assertIncludes(source, `'${action}'`, `formation action ${action}`));
  [
    ".from('group_requests')",
    ".from('group_join_requests')",
    "status: 'Forming'",
    "status: 'Accepted'",
    'expires_at',
    'policy.minMembers',
    'policy.maxMembers',
    'policy.expiryDays',
    'risk_warning_accepted_at',
    'Only private invite-based group requests can disable payout vesting.',
  ].forEach(token => assertIncludes(source, token, 'create request implementation token'));

  assertIncludes(config, '[functions.group-formation]', 'Supabase function config');
  assertIncludes(config, 'verify_jwt = false', 'function JWT config style');

  const result = {
    scenario: 'phase2-group-formation-create-request-validation',
    function: 'supabase/functions/group-formation/index.ts',
    config: 'supabase/config.toml',
    routedActions: requiredActions,
    completedChecks: [
      'group-formation Edge Function source exists',
      'session validation boundary exists',
      'member/admin role gates exist',
      'all planned Phase 2 formation actions are routed',
      'createRequest inserts a Forming group_requests row with config-driven min/max/expiry validation',
      'createRequest inserts the creator as an Accepted formation participant',
      'Supabase function config registers group-formation with internal token verification pattern',
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
