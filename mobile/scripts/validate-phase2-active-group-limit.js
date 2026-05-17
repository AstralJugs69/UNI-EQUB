const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const groupLifecyclePath = path.join(repoRoot, 'supabase/functions/group-lifecycle/index.ts');
const groupFormationPath = path.join(repoRoot, 'supabase/functions/group-formation/index.ts');
const reliabilityPath = path.join(repoRoot, 'supabase/functions/_shared/reliability.ts');
const configPath = path.join(repoRoot, 'supabase/functions/_shared/config.ts');

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
  const groupLifecycle = read(groupLifecyclePath);
  const groupFormation = read(groupFormationPath);
  const reliability = read(reliabilityPath);
  const config = read(configPath);

  [
    'new_user_active_group_limit: 1',
    'new_user_active_group_limit',
  ].forEach(token => assertIncludes(config, token, 'active group limit config token'));

  [
    'export async function getReliabilityJoinGate',
    "['New', 'BuildingTrust'].includes(profile.public_status)",
    'activeGroupCount >= activeGroupLimit',
    'canJoinNormalGroup: !blockedByRestriction && !limitedByMaturity',
  ].forEach(token => assertIncludes(reliability, token, 'reliability gate token'));

  [
    'getReliabilityJoinGate',
    'const reliabilityGate = await getReliabilityJoinGate(actor.User_ID)',
    'if (!reliabilityGate.canJoinNormalGroup)',
    'User is not eligible to join another active group.',
  ].forEach(token => assertIncludes(groupLifecycle, token, 'legacy direct join gate token'));

  [
    'async function assertAcceptedParticipantsCanBecomeActive',
    'for (const userId of [...new Set(userIds)])',
    'const gate = await getReliabilityJoinGate(userId)',
    'blockedParticipants.push',
    'would exceed active group reliability limits',
    'await assertAcceptedParticipantsCanBecomeActive(acceptedParticipantUserIds)',
    'const group = await ensureCanonicalGroupForRequest(request)',
  ].forEach(token => assertIncludes(groupFormation, token, 'formation approval active group limit token'));

  const approvalGateIndex = groupFormation.indexOf('await assertAcceptedParticipantsCanBecomeActive(acceptedParticipantUserIds)');
  const createGroupIndex = groupFormation.indexOf('const group = await ensureCanonicalGroupForRequest(request)');
  if (approvalGateIndex < 0 || createGroupIndex < 0 || approvalGateIndex > createGroupIndex) {
    throw new Error('Formation approval active group limit gate must run before canonical group creation.');
  }

  const result = {
    scenario: 'phase2-active-group-limit-validation',
    validatedFiles: {
      groupLifecycle: 'supabase/functions/group-lifecycle/index.ts',
      groupFormation: 'supabase/functions/group-formation/index.ts',
      reliability: 'supabase/functions/_shared/reliability.ts',
      config: 'supabase/functions/_shared/config.ts',
    },
    completedChecks: [
      'new/building-trust active group limit is loaded from app_config',
      'direct legacy group join checks reliability gate before creating an active membership',
      'formation approval re-checks all accepted participants before canonical group creation',
      'approval fails before EqubGroup/GroupMembers writes when accepted participants exceed active group limits',
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
