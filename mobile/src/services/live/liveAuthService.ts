import { supabase } from '../supabaseClient';
import type { AuthService, LoginChallenge, LoginInput, RegisterInput } from '../contracts';
import type { AuthSession, SessionUser } from '../../types/domain';
import { mockBackend } from '../mock/mockBackend';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function invoke<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<Envelope<T>>('register-login', { body });
  if (error) {
    throw new Error(error.message);
  }
  if (!data?.ok || !data.data) {
    throw new Error(data?.error ?? 'Edge Function invocation failed.');
  }
  return data.data;
}

export const liveAuthService: AuthService = {
  async register(input: RegisterInput): Promise<SessionUser> {
    const response = await invoke<{ user: SessionUser }>({ action: 'register', register: input });
    mockBackend.syncExternalUser(response.user, `hash:${input.password}`);
    return response.user;
  },

  async requestOtp(phoneNumber: string) {
    return invoke<{ sid?: string; status?: string; challengeId: string }>({ action: 'requestOtp', requestOtp: { phoneNumber } });
  },

  async verifyOtp(phoneNumber: string, otp: string) {
    return invoke<{ approved: boolean; pendingKycToken?: string }>({ action: 'verifyOtp', verifyOtp: { phoneNumber, otp } });
  },

  async beginLogin(input: LoginInput, roleHint?: 'Member' | 'Admin'): Promise<LoginChallenge> {
    const session = await invoke<AuthSession>({ action: 'beginLogin', beginLogin: { ...input, roleHint } });
    mockBackend.syncExternalUser(session.user);
    return { challengeToken: session.token, phoneNumber: session.user.phoneNumber };
  },

  async completeLogin(challengeToken: string, _otp: string): Promise<AuthSession> {
    const session = await invoke<AuthSession>({ action: 'restore', restore: { token: challengeToken } });
    mockBackend.syncExternalUser(session.user);
    return session;
  },

  async login(input: LoginInput, roleHint?: 'Member' | 'Admin'): Promise<AuthSession> {
    const session = await invoke<AuthSession>({ action: 'login', login: { ...input, roleHint } });
    mockBackend.syncExternalUser(session.user);
    return session;
  },

  async restore(token: string): Promise<AuthSession | null> {
    try {
      const session = await invoke<AuthSession>({ action: 'restore', restore: { token } });
      mockBackend.syncExternalUser(session.user);
      return session;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    return undefined;
  },
};
