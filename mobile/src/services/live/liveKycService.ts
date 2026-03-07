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
    const response = await invoke<{ user: UserRecord }>({ action: 'submit', userId, imageRef });
    mockBackend.setUserKycStatus(userId, response.user.KYC_Status, imageRef);
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
