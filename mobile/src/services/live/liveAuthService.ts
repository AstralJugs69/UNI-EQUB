import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import type { AuthService, LoginChallenge, LoginInput, RegisterInput, RegisterResult } from '../contracts';
import type { AuthSession } from '../../types/domain';
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
  async register(input: RegisterInput): Promise<RegisterResult> {
    const response = await invoke<RegisterResult>({ action: 'register', register: input });
    return {
      user: response.user,
      requiresOtp: response.requiresOtp ?? true,
      requiresEmailVerification: response.requiresEmailVerification ?? true,
      pendingKycToken: response.pendingKycToken,
    };
  },

  async requestOtp(phoneNumber: string) {
    return invoke<{ sid?: string; status?: string; challengeId: string }>({ action: 'requestOtp', requestOtp: { phoneNumber } });
  },

  async verifyOtp(phoneNumber: string, otp: string) {
    return invoke<{ approved: boolean; pendingKycToken?: string }>({ action: 'verifyOtp', verifyOtp: { phoneNumber, otp } });
  },

  async requestEmailVerification(input) {
    const token = await loadSessionToken();
    return invoke({ action: 'requestEmailVerification', requestEmailVerification: { ...input, token: token ?? undefined } });
  },

  async verifyEmail(input) {
    const token = await loadSessionToken();
    return invoke({ action: 'verifyEmail', verifyEmail: { ...input, token: token ?? undefined } });
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

  async getOtpGate(input) {
    return invoke<{ requiresOtp: boolean; phoneNumber?: string | null }>({ action: 'otpGate', otpGate: input });
  },

  async resetPassword(input) {
    return invoke<{ requiresOtp: boolean; reset: boolean }>({ action: 'resetPassword', resetPassword: input });
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
