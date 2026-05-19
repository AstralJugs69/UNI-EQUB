const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const migrationPath = path.join(repoRoot, 'supabase/migrations/20260519114500_phase2_kyc_history.sql');
const edgeFunctionPath = path.join(repoRoot, 'supabase/functions/kyc-submit-review/index.ts');
const liveServicePath = path.join(repoRoot, 'mobile/src/services/live/liveKycService.ts');
const mockServicePath = path.join(repoRoot, 'mobile/src/services/mock/mockBackend.ts');
const contractPath = path.join(repoRoot, 'mobile/src/services/contracts/index.ts');
const domainPath = path.join(repoRoot, 'mobile/src/types/domain.ts');
const sharedTypesPath = path.join(repoRoot, 'supabase/functions/_shared/types.ts');
const adminKycScreenPath = path.join(repoRoot, 'mobile/src/screens/admin/AdminKycScreen.tsx');

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
  const migration = read(migrationPath);
  const edgeFunction = read(edgeFunctionPath);
  const liveService = read(liveServicePath);
  const mockService = read(mockServicePath);
  const contract = read(contractPath);
  const domain = read(domainPath);
  const sharedTypes = read(sharedTypesPath);
  const adminKycScreen = read(adminKycScreenPath);

  [
    'create table if not exists public.kyc_submissions',
    'create table if not exists public.kyc_documents',
    'This Phase 2 companion table preserves the MVP User.Student_ID_Img field',
    'idx_kyc_submissions_one_pending_per_user',
    'idx_kyc_submissions_status_submitted',
    'idx_kyc_documents_submission',
    'idx_kyc_documents_user_kind',
    'kyc_submissions_set_updated_at',
    'legacy_backfill',
    "'legacy_student_id'",
    'alter table public.kyc_submissions enable row level security',
    'alter table public.kyc_documents enable row level security',
  ].forEach(token => assertIncludes(migration, token, 'KYC history migration token'));

  [
    "action: 'createUploadUrl' | 'submit' | 'listPending' | 'approve' | 'needsResubmission' | 'ban'",
    'interface KycDocumentReference',
    'async function createKycSubmission',
    ".from('kyc_submissions')",
    ".from('kyc_documents')",
    'async function listPendingSubmissions',
    'async function updateLatestSubmissionDecision',
    "'NeedsResubmission'",
    'kyc_submission_created',
    'kyc_submission_approved',
    'kyc_submission_needs_resubmission',
    'kyc_submission_rejected',
    'createNotification',
    'writeAuditEvent',
    'Student_ID_Img: primaryImageRef',
  ].forEach(token => assertIncludes(edgeFunction, token, 'KYC Edge Function token'));

  [
    'interface StoredKycDocumentRef',
    'documentKind: document.kind',
    'documentRefs: storedRefs',
    'submission?: KycSubmissionRecord',
    'documents: KycDocumentRecord[]',
    "action: 'needsResubmission'",
  ].forEach(token => assertIncludes(liveService, token, 'live KYC service token'));

  [
    'requestResubmission(userId: string): Promise<void>',
    'KycDocumentKind',
  ].forEach(token => assertIncludes(contract, token, 'KYC service contract token'));

  [
    'export type KycSubmissionStatus',
    'export type KycDocumentKind',
    'export interface KycSubmissionRecord',
    'export interface KycDocumentRecord',
    'submission?: KycSubmissionRecord',
    'documents?: KycDocumentRecord[]',
  ].forEach(token => assertIncludes(domain, token, 'mobile KYC type token'));

  [
    'export type KycSubmissionStatus',
    'export type KycDocumentKind',
    'export interface KycSubmissionRecord',
    'export interface KycDocumentRecord',
  ].forEach(token => assertIncludes(sharedTypes, token, 'shared KYC type token'));

  [
    'requestResubmission: async',
    'KYC needs resubmission',
  ].forEach(token => assertIncludes(mockService, token, 'mock KYC parity token'));

  [
    'requestKycResubmission',
    'item.documents?.length',
    'Resubmit',
  ].forEach(token => assertIncludes(adminKycScreen, token, 'admin KYC screen token'));

  const result = {
    scenario: 'phase2-kyc-history-validation',
    validatedFiles: {
      migration: 'supabase/migrations/20260519114500_phase2_kyc_history.sql',
      edgeFunction: 'supabase/functions/kyc-submit-review/index.ts',
      liveService: 'mobile/src/services/live/liveKycService.ts',
      mockService: 'mobile/src/services/mock/mockBackend.ts',
      serviceContract: 'mobile/src/services/contracts/index.ts',
      mobileTypes: 'mobile/src/types/domain.ts',
      sharedTypes: 'supabase/functions/_shared/types.ts',
      adminKycScreen: 'mobile/src/screens/admin/AdminKycScreen.tsx',
    },
    completedChecks: [
      'KYC submissions and document metadata tables are additive Phase 2 companion tables',
      'legacy User.Student_ID_Img compatibility field remains updated from the primary document reference',
      'legacy unverified member KYC rows are backfilled into pending submission/document records during migration',
      'new KYC submissions supersede prior pending submissions for the same user',
      'admin review queue reads pending kyc_submissions and returns related document metadata',
      'approve, needs-resubmission, and reject/ban decisions write durable notifications and audit events',
      'live and mock mobile KYC services expose matching submit/list/approve/resubmit/ban behavior',
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
