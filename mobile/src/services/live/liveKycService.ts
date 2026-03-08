import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from '../supabaseClient';
import { mockBackend } from '../mock/mockBackend';
import type { KycService } from '../contracts';
import type { KycReviewItem, UserRecord } from '../../types/domain';
import type { SessionUser } from '../../types/domain';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const DEV_KYC_PLACEHOLDER_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z08kAAAAASUVORK5CYII=';

async function invoke<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<Envelope<T>>('kyc-submit-review', { body });
  if (error) {
    throw new Error(error.message);
  }
  if (!data?.ok || !data.data) {
    throw new Error(data?.error ?? 'KYC function invocation failed.');
  }
  return data.data;
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
  async submitKyc(userId: string, imageRef: string) {
    const fileNameHint = imageRef.split('/').pop() || 'student-id.png';
    const upload = await invoke<{ bucket: string; path: string; token: string; contentType: string }>({
      action: 'createUploadUrl',
      userId,
      fileName: fileNameHint.endsWith('.png') ? fileNameHint : `${fileNameHint}.png`,
      contentType: 'image/png',
    });

    const { error: uploadError } = await supabase.storage
      .from(upload.bucket)
      .uploadToSignedUrl(upload.path, upload.token, decodeBase64(DEV_KYC_PLACEHOLDER_PNG_BASE64), {
        contentType: upload.contentType,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const storedRef = `storage://${upload.bucket}/${upload.path}`;
    const response = await invoke<{ user: UserRecord }>({ action: 'submit', userId, imageRef: storedRef });
    mockBackend.setUserKycStatus(userId, response.user.KYC_Status, storedRef);
  },

  async listPendingReviews(): Promise<KycReviewItem[]> {
    const response = await invoke<{ users: UserRecord[] }>({ action: 'listPending' });
    return response.users.map(user => ({ user, note: 'Live Supabase KYC review item.' }));
  },

  async approve(userId: string) {
    const response = await invoke<{ user: UserRecord }>({ action: 'approve', userId });
    mockBackend.syncExternalUser(toSessionUser(response.user));
  },

  async ban(userId: string) {
    const response = await invoke<{ user: UserRecord }>({ action: 'ban', userId });
    mockBackend.syncExternalUser(toSessionUser(response.user));
  },
};
