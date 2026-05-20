import { supabase } from '../supabaseClient';
import type { AuthService, LoginChallenge, LoginInput, RegisterInput } from '../contracts';
import type { AuthSession, SessionUser } from '../../types/domain';
import { assertLiveEnvelope, readLiveFunctionError } from './liveFunctionError';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function invoke<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<Envelope<T>>('register-login', { body });
  if (error) {
    throw new Error(await readLiveFunctionError(error, 'Register/login invocation failed.'));
  }
  return assertLiveEnvelope(data, 'Register/login invocation failed.');
}

export const liveAuthService: AuthService = {
  async register(input: RegisterInput): Promise<SessionUser> {
    const response = await invoke<{ user: SessionUser }>({ action: 'register', register: input });
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
    return { challengeToken: session.token, phoneNumber: session.user.phoneNumber };
  },

  async completeLogin(challengeToken: string, _otp: string): Promise<AuthSession> {
    return invoke<AuthSession>({ action: 'restore', restore: { token: challengeToken } });
  },

  async login(input: LoginInput, roleHint?: 'Member' | 'Admin'): Promise<AuthSession> {
    return invoke<AuthSession>({ action: 'login', login: { ...input, roleHint } });
  },

  async restore(token: string): Promise<AuthSession | null> {
    try {
      return await invoke<AuthSession>({ action: 'restore', restore: { token } });
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    return undefined;
  },
};
