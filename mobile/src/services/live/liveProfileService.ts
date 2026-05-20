import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import type { ProfileImageUploadInput, ProfileService, ProfileUpdateInput } from '../contracts';
import type { AvatarDescriptor, UserProfile } from '../../types/domain';
import { assertLiveEnvelope, readLiveFunctionError } from './liveFunctionError';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const token = await loadSessionToken();
  if (!token) {
    throw new Error('No active session token was found.');
  }
  const { data, error } = await supabase.functions.invoke<Envelope<T>>('profile-center', {
    body: { ...body, token },
  });
  if (error) {
    throw new Error(await readLiveFunctionError(error, 'Profile center invocation failed.'));
  }
  return assertLiveEnvelope(data, 'Profile center invocation failed.');
}

export const liveProfileService: ProfileService = {
  async getProfile(userId: string): Promise<UserProfile> {
    const response = await invoke<{ profile: UserProfile }>({ action: 'getProfile', userId });
    return response.profile;
  },

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<UserProfile> {
    const response = await invoke<{ profile: UserProfile }>({ action: 'updateProfile', userId, profile: input });
    return response.profile;
  },

  async uploadProfileImage(userId: string, input: ProfileImageUploadInput): Promise<UserProfile> {
    const response = await invoke<{ profile: UserProfile }>({ action: 'uploadProfileImage', userId, image: input });
    return response.profile;
  },

  async removeProfileImage(userId: string): Promise<UserProfile> {
    const response = await invoke<{ profile: UserProfile }>({ action: 'removeProfileImage', userId });
    return response.profile;
  },

  async ensureAvatarSeed(userId: string): Promise<AvatarDescriptor> {
    const response = await invoke<{ avatar: AvatarDescriptor }>({ action: 'ensureAvatarSeed', userId });
    return response.avatar;
  },
};
