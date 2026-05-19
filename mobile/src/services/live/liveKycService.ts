import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import { mockBackend } from '../mock/mockBackend';
import type { KycService, KycSubmissionInput } from '../contracts';
import type { AuthSession, KycDocumentRecord, KycReviewItem, KycSubmissionRecord, SessionUser, UserRecord } from '../../types/domain';
import { assertLiveEnvelope, readLiveFunctionError } from './liveFunctionError';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface StoredKycDocumentRef {
  kind: KycSubmissionInput['documents'][number]['kind'];
  storageRef: string;
  bucket: string;
  objectPath: string;
  fileName: string;
  contentType: string;
}

interface PendingKycResponse {
  users?: UserRecord[];
  items?: Array<{
    user: UserRecord;
    submission: KycSubmissionRecord;
    documents: KycDocumentRecord[];
    note: string;
  }>;
}

async function invoke<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<Envelope<T>>('kyc-submit-review', { body });
  if (error) {
    throw new Error(await readLiveFunctionError(error, 'KYC function invocation failed.'));
  }
  return assertLiveEnvelope(data, 'KYC function invocation failed.');
}

async function invokeWithSession<T>(body: Record<string, unknown>): Promise<T> {
  const token = await loadSessionToken();
  if (!token) {
    throw new Error('No active session token was found.');
  }
  return invoke<T>({ ...body, token });
}

function toSessionUser(user: UserRecord): SessionUser {
  return {
    userId: user.User_ID,
    fullName: user.Full_Name,
    phoneNumber: user.Phone_Number,
    role: user.Role,
    kycStatus: user.KYC_Status,
  };
}

export const liveKycService: KycService = {
  async submitKyc(userId: string, input: KycSubmissionInput, pendingKycToken: string): Promise<AuthSession> {
    const storedRefs: StoredKycDocumentRef[] = [];

    for (const document of input.documents) {
      const upload = await invoke<{ bucket: string; path: string; token: string; contentType: string }>({
        action: 'createUploadUrl',
        token: pendingKycToken,
        userId,
        fileName: document.fileName,
        contentType: document.contentType,
        documentKind: document.kind,
      });

      const { error: uploadError } = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, decodeBase64(document.base64), {
          contentType: document.contentType,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      storedRefs.push({
        kind: document.kind,
        storageRef: `storage://${upload.bucket}/${upload.path}`,
        bucket: upload.bucket,
        objectPath: upload.path,
        fileName: document.fileName,
        contentType: document.contentType,
      });
    }

    const response = await invoke<{ user: UserRecord; submission?: KycSubmissionRecord; token: string; sessionUser: SessionUser }>({
      action: 'submit',
      token: pendingKycToken,
      userId,
      imageRef: storedRefs[0]?.storageRef,
      documentRefs: storedRefs,
    });
    mockBackend.setUserKycStatus(userId, response.user.KYC_Status, storedRefs[0]?.storageRef);
    return { token: response.token, user: response.sessionUser };
  },

  async listPendingReviews(): Promise<KycReviewItem[]> {
    const response = await invokeWithSession<PendingKycResponse>({ action: 'listPending' });
    if (response.items?.length) {
      return response.items.map(item => ({
        user: item.user,
        note: item.note,
        submission: item.submission,
        documents: item.documents,
      }));
    }
    return (response.users ?? []).map(user => ({ user, note: 'Live Supabase KYC review item.' }));
  },

  async approve(userId: string) {
    const response = await invokeWithSession<{ user: UserRecord }>({ action: 'approve', userId });
    mockBackend.syncExternalUser(toSessionUser(response.user));
  },

  async ban(userId: string) {
    const response = await invokeWithSession<{ user: UserRecord }>({ action: 'ban', userId });
    mockBackend.syncExternalUser(toSessionUser(response.user));
  },

  async requestResubmission(userId: string) {
    const response = await invokeWithSession<{ user: UserRecord }>({ action: 'needsResubmission', userId });
    mockBackend.syncExternalUser(toSessionUser(response.user));
  },
};
