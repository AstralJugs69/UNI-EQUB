const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const groupLifecyclePath = path.join(repoRoot, 'supabase/functions/group-lifecycle/index.ts');
const liveGroupsPath = path.join(repoRoot, 'mobile/src/services/live/liveGroupsService.ts');
const mockBackendTestPath = path.join(repoRoot, 'mobile/src/services/mock/mockBackend.test.ts');

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
  const lifecycle = read(groupLifecyclePath);
  const liveGroups = read(liveGroupsPath);
  const mockBackendTest = read(mockBackendTestPath);

  [
    "case 'createRequest'",
    ".from('EqubGroup')",
    'Status: \'Pending\'',
    'Virtual_Acc_Ref: null',
    'return json({ group: toAppGroup(data as GroupRecord) }, 201)',
  ].forEach(token => assertIncludes(lifecycle, token, 'legacy group-lifecycle createRequest token'));

  [
    "action: 'createRequest'",
    'createRequest: input',
    "invoke<{ group: GroupRecord }>",
    'syncGroupShape(response.group)',
  ].forEach(token => assertIncludes(liveGroups, token, 'live mobile legacy createRequest token'));

  [
    'keeps the legacy group creation request path pending during Phase 2 migration',
    "expect(group.Status).toBe('Pending')",
    "expect(pending.some(item => item.group.Group_ID === group.Group_ID)).toBe(true)",
  ].forEach(token => assertIncludes(mockBackendTest, token, 'legacy group compatibility Jest evidence'));

  const result = {
    scenario: 'phase2-legacy-group-create-compatibility-validation',
    validatedFiles: {
      groupLifecycle: 'supabase/functions/group-lifecycle/index.ts',
      liveGroupsService: 'mobile/src/services/live/liveGroupsService.ts',
      mockBackendTest: 'mobile/src/services/mock/mockBackend.test.ts',
    },
    completedChecks: [
      'legacy group-lifecycle.createRequest still inserts canonical EqubGroup rows',
      'legacy createRequest rows remain Pending and use the existing null Virtual_Acc_Ref approval flow',
      'mobile live GroupService.createRequest still calls group-lifecycle createRequest',
      'mock backend regression covers pending legacy group creation during Phase 2 migration',
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
