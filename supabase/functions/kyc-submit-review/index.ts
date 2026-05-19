import { fail, failFromError, json } from '../_shared/contracts.ts';
import { signSession, verifyPendingKycToken, verifySession } from '../_shared/auth.ts';
import { writeAuditEvent } from '../_shared/audit.ts';
import { createNotification } from '../_shared/notifications.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { toSessionUser } from '../_shared/types.ts';
import type { KycDocumentKind, KycDocumentRecord, KycSubmissionRecord, UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KycPayload {
  action: 'createUploadUrl' | 'submit' | 'listPending' | 'approve' | 'needsResubmission' | 'ban';
  token?: string;
  userId?: string;
  imageRef?: string;
  documentRefs?: KycDocumentReference[];
  fileName?: string;
  contentType?: string;
  documentKind?: KycDocumentKind;
}

interface KycDocumentReference {
  kind: KycDocumentKind;
  storageRef: string;
  bucket?: string;
  objectPath?: string;
  fileName?: string;
  contentType?: string;
}

async function updateUser(userId: string, changes: Partial<UserRecord>) {
  const { data, error } = await supabaseAdmin.from('User').update(changes).eq('User_ID', userId).select('*').single();
  if (error) {
    throw error;
  }
  return data as UserRecord;
}

async function requirePendingKycActor(token: string, expectedUserId?: string) {
  const payload = await verifyPendingKycToken(token);
  const userId = payload.sub;
  if (!userId) {
    throw new Error('Invalid pending KYC token.');
  }
  if (expectedUserId && expectedUserId !== userId) {
    throw new Error('Pending KYC token does not match the requested user.');
  }
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw error;
  }
  return data as UserRecord;
}

async function requireKycSubmissionActor(token: string, expectedUserId?: string) {
  try {
    return await requirePendingKycActor(token, expectedUserId);
  } catch {
    const payload = await verifySession(token);
    const userId = payload.sub;
    if (!userId) {
      throw new Error('Invalid session token.');
    }
    if (expectedUserId && expectedUserId !== userId) {
      throw new Error('Session token does not match the requested user.');
    }
    const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
    if (error) {
      throw error;
    }
    const user = data as UserRecord;
    if (user.Role !== 'Member') {
      throw new Error('Only members can submit KYC documents.');
    }
    if (user.KYC_Status === 'Banned') {
      throw new Error('Banned accounts cannot submit KYC documents.');
    }
    return user;
  }
}

async function requireAdminActor(token: string) {
  const payload = await verifySession(token);
  const userId = payload.sub;
  if (!userId) {
    throw new Error('Invalid session token.');
  }
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw error;
  }
  const user = data as UserRecord;
  if (user.Role !== 'Admin') {
    throw new Error('Admin access is required for KYC review.');
  }
  if (user.KYC_Status === 'Banned') {
    throw new Error('This admin account has been banned.');
  }
  return user;
}

function parseStorageRef(storageRef: string) {
  const match = storageRef.match(/^storage:\/\/([^/]+)\/(.+)$/);
  return match ? { bucket: match[1], objectPath: match[2] } : { bucket: null, objectPath: null };
}

async function createKycSubmission(user: UserRecord, documentRefs: KycDocumentReference[]) {
  const submittedAt = new Date().toISOString();
  const { error: supersedeError } = await supabaseAdmin
    .from('kyc_submissions')
    .update({
      status: 'Superseded',
      reviewed_at: submittedAt,
      reviewed_by: user.User_ID,
      decision_note: 'Superseded by a newer submission.',
    })
    .eq('user_id', user.User_ID)
    .eq('status', 'PendingReview');
  if (supersedeError) {
    throw supersedeError;
  }

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from('kyc_submissions')
    .insert({
      user_id: user.User_ID,
      status: 'PendingReview',
      submitted_at: submittedAt,
      metadata: {
        legacy_student_id_img: user.Student_ID_Img,
        document_count: documentRefs.length,
      },
    })
    .select('*')
    .single();
  if (submissionError) {
    throw submissionError;
  }

  const submissionRecord = submission as KycSubmissionRecord;
  const documentRows = documentRefs.map(document => {
    const parsed = parseStorageRef(document.storageRef);
    return {
      submission_id: submissionRecord.id,
      user_id: user.User_ID,
      kind: document.kind,
      storage_ref: document.storageRef,
      bucket: document.bucket ?? parsed.bucket,
      object_path: document.objectPath ?? parsed.objectPath,
      file_name: document.fileName ?? null,
      content_type: document.contentType ?? null,
      metadata: {},
    };
  });

  if (documentRows.length) {
    const { error: documentsError } = await supabaseAdmin.from('kyc_documents').insert(documentRows);
    if (documentsError) {
      throw documentsError;
    }
  }

  return submissionRecord;
}

async function listPendingSubmissions() {
  const { data: submissions, error: submissionsError } = await supabaseAdmin
    .from('kyc_submissions')
    .select('*')
    .eq('status', 'PendingReview')
    .order('submitted_at', { ascending: false });
  if (submissionsError) {
    throw submissionsError;
  }

  const submissionRows = (submissions ?? []) as KycSubmissionRecord[];
  if (!submissionRows.length) {
    return { users: [] as UserRecord[], items: [] as Array<{ user: UserRecord; submission: KycSubmissionRecord; documents: KycDocumentRecord[]; note: string }> };
  }

  const userIds = [...new Set(submissionRows.map(submission => submission.user_id))];
  const submissionIds = submissionRows.map(submission => submission.id);
  const [{ data: users, error: usersError }, { data: documents, error: documentsError }] = await Promise.all([
    supabaseAdmin.from('User').select('*').in('User_ID', userIds),
    supabaseAdmin.from('kyc_documents').select('*').in('submission_id', submissionIds).order('uploaded_at', { ascending: false }),
  ]);
  if (usersError) {
    throw usersError;
  }
  if (documentsError) {
    throw documentsError;
  }

  const usersById = new Map(((users ?? []) as UserRecord[]).map(user => [user.User_ID, user]));
  const documentsBySubmission = new Map<string, KycDocumentRecord[]>();
  for (const document of (documents ?? []) as KycDocumentRecord[]) {
    const current = documentsBySubmission.get(document.submission_id) ?? [];
    current.push(document);
    documentsBySubmission.set(document.submission_id, current);
  }

  const items = submissionRows
    .map(submission => {
      const user = usersById.get(submission.user_id);
      if (!user) {
        return null;
      }
      const submissionDocuments = documentsBySubmission.get(submission.id) ?? [];
      return {
        user,
        submission,
        documents: submissionDocuments,
        note: `${submissionDocuments.length || 1} document reference${submissionDocuments.length === 1 ? '' : 's'} awaiting manual review.`,
      };
    })
    .filter(Boolean) as Array<{ user: UserRecord; submission: KycSubmissionRecord; documents: KycDocumentRecord[]; note: string }>;

  return { users: items.map(item => item.user), items };
}

async function latestPendingSubmission(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('kyc_submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'PendingReview')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as KycSubmissionRecord | null;
}

async function updateLatestSubmissionDecision(userId: string, admin: UserRecord, status: 'Approved' | 'Rejected' | 'NeedsResubmission', decisionNote: string) {
  const submission = await latestPendingSubmission(userId);
  if (!submission) {
    return null;
  }
  const { data, error } = await supabaseAdmin
    .from('kyc_submissions')
    .update({
      status,
      reviewed_by: admin.User_ID,
      reviewed_at: new Date().toISOString(),
      decision_note: decisionNote,
    })
    .eq('id', submission.id)
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return data as KycSubmissionRecord;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = (await request.json()) as KycPayload;

    switch (body.action) {
      case 'createUploadUrl': {
        if (!body.userId || !body.token) {
          return fail('Missing userId for KYC upload.', 400);
        }
        await requireKycSubmissionActor(body.token, body.userId);
        const documentKind = body.documentKind ?? 'front_id';
        const fileName = (body.fileName ?? `${documentKind}.png`).replace(/[^a-zA-Z0-9._-]/g, '-');
        const objectPath = `${body.userId}/kyc/${documentKind}/${Date.now()}-${fileName}`;
        const { data, error } = await supabaseAdmin.storage.from('student-ids').createSignedUploadUrl(objectPath);
        if (error) {
          throw error;
        }
        return json({
          bucket: 'student-ids',
          path: objectPath,
          token: data.token,
          signedUrl: data.signedUrl,
          contentType: body.contentType ?? 'image/png',
        });
      }

      case 'submit': {
        if (!body.userId || !body.token || (!body.imageRef && !body.documentRefs?.length)) {
          return fail('Missing KYC submit payload.', 400);
        }
        const actor = await requireKycSubmissionActor(body.token, body.userId);
        const documentRefs = body.documentRefs?.length
          ? body.documentRefs
          : [{ kind: 'legacy_student_id' as KycDocumentKind, storageRef: body.imageRef as string }];
        const primaryImageRef = documentRefs[0]?.storageRef ?? (body.imageRef as string);
        const submission = await createKycSubmission(actor, documentRefs);
        const user = await updateUser(body.userId, {
          Student_ID_Img: primaryImageRef,
          KYC_Status: 'Unverified',
        });
        await createNotification({
          userId: user.User_ID,
          type: 'kyc_submitted',
          severity: 'Info',
          title: 'KYC submitted',
          message: 'Your student ID documents are waiting for admin review.',
          actionRoute: 'member/kyc',
          relatedEntityType: 'kyc_submission',
          relatedEntityId: submission.id,
        });
        await writeAuditEvent({
          actor: user,
          eventType: 'kyc_submission_created',
          entityType: 'kyc_submission',
          entityId: submission.id,
          metadata: { document_count: documentRefs.length },
        });
        return json({ user, submission, token: await signSession(user), sessionUser: toSessionUser(user) });
      }

      case 'listPending': {
        if (!body.token) {
          return fail('Missing admin token for KYC review.', 401);
        }
        await requireAdminActor(body.token);
        const pending = await listPendingSubmissions();
        return json(pending);
      }

      case 'approve': {
        if (!body.userId || !body.token) {
          return fail('Missing userId for approval.', 400);
        }
        const admin = await requireAdminActor(body.token);
        const submission = await updateLatestSubmissionDecision(body.userId, admin, 'Approved', 'Approved by admin.');
        const user = await updateUser(body.userId, { KYC_Status: 'Verified' });
        await createNotification({
          userId: user.User_ID,
          type: 'kyc_approved',
          severity: 'Success',
          title: 'KYC approved',
          message: 'Your account is now verified for group creation and payout withdrawal.',
          actionRoute: 'member/kyc',
          relatedEntityType: submission ? 'kyc_submission' : 'user',
          relatedEntityId: submission?.id ?? user.User_ID,
        });
        await writeAuditEvent({
          actor: admin,
          eventType: 'kyc_submission_approved',
          entityType: submission ? 'kyc_submission' : 'user',
          entityId: submission?.id ?? user.User_ID,
          metadata: { reviewed_user_id: user.User_ID },
        });
        return json({ user, submission });
      }

      case 'needsResubmission': {
        if (!body.userId || !body.token) {
          return fail('Missing userId for resubmission request.', 400);
        }
        const admin = await requireAdminActor(body.token);
        const submission = await updateLatestSubmissionDecision(body.userId, admin, 'NeedsResubmission', 'Admin requested clearer KYC documents.');
        const user = await updateUser(body.userId, { KYC_Status: 'Unverified' });
        await createNotification({
          userId: user.User_ID,
          type: 'kyc_needs_resubmission',
          severity: 'Warning',
          title: 'KYC needs resubmission',
          message: 'Please upload clearer student ID documents to continue verification.',
          actionRoute: 'member/kyc',
          relatedEntityType: submission ? 'kyc_submission' : 'user',
          relatedEntityId: submission?.id ?? user.User_ID,
        });
        await writeAuditEvent({
          actor: admin,
          eventType: 'kyc_submission_needs_resubmission',
          entityType: submission ? 'kyc_submission' : 'user',
          entityId: submission?.id ?? user.User_ID,
          metadata: { reviewed_user_id: user.User_ID },
        });
        return json({ user, submission });
      }

      case 'ban': {
        if (!body.userId || !body.token) {
          return fail('Missing userId for ban.', 400);
        }
        const admin = await requireAdminActor(body.token);
        const submission = await updateLatestSubmissionDecision(body.userId, admin, 'Rejected', 'Rejected and account banned by admin.');
        const user = await updateUser(body.userId, { KYC_Status: 'Banned' });
        await createNotification({
          userId: user.User_ID,
          type: 'kyc_rejected',
          severity: 'Error',
          title: 'KYC rejected',
          message: 'Your account was restricted after KYC review.',
          actionRoute: 'member/kyc',
          relatedEntityType: submission ? 'kyc_submission' : 'user',
          relatedEntityId: submission?.id ?? user.User_ID,
        });
        await writeAuditEvent({
          actor: admin,
          eventType: 'kyc_submission_rejected',
          entityType: submission ? 'kyc_submission' : 'user',
          entityId: submission?.id ?? user.User_ID,
          metadata: { reviewed_user_id: user.User_ID },
        });
        return json({ user, submission });
      }

      default:
        return fail('Unsupported KYC action.', 400);
    }
  } catch (error) {
    return failFromError(error, 'Unexpected KYC error.', 500, { functionName: 'kyc-submit-review' });
  }
});
