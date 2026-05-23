import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthSession, SessionUser } from '../types/domain';
import type { KycSubmissionInput, RegisterResult } from '../services/contracts';
import { clearSessionToken, loadLastActiveAt, loadSessionToken, saveLastActiveAt, saveSessionToken } from '../services/storage';
import { useServices } from './ServicesProvider';

const INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

interface PendingLoginChallenge {
  phoneNumber: string;
  challengeToken: string;
}

interface AuthContextValue {
  authReady: boolean;
  session: AuthSession | null;
  pendingUser: SessionUser | null;
  pendingLogin: PendingLoginChallenge | null;
  login: (emailOrPhone: string, password: string, roleHint?: 'Member' | 'Admin') => Promise<void>;
  beginLogin: (emailOrPhone: string, password: string, roleHint?: 'Member' | 'Admin') => Promise<void>;
  completeLogin: (otp: string) => Promise<void>;
  register: (fullName: string, email: string, phoneNumber: string, password: string) => Promise<RegisterResult>;
  requestOtp: (phoneNumber: string) => Promise<void>;
  verifyOtp: (phoneNumber: string, otp: string) => Promise<void>;
  requestEmailVerification: (input?: { userId?: string; email?: string }) => Promise<void>;
  verifyEmail: (input: { userId?: string; code: string }) => Promise<{ requiresOtp: boolean }>;
  getOtpGate: (input: { token?: string; phoneNumber?: string }) => Promise<{ requiresOtp: boolean; phoneNumber?: string | null }>;
  resetPassword: (phoneNumber: string, newPassword: string, otp?: string) => Promise<{ requiresOtp: boolean; reset: boolean }>;
  submitPendingKyc: (input: KycSubmissionInput) => Promise<void>;
  submitCurrentKyc: (input: KycSubmissionInput) => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const services = useServices();
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingUser, setPendingUser] = useState<SessionUser | null>(null);
  const [pendingKycToken, setPendingKycToken] = useState<string | null>(null);
  const [pendingLogin, setPendingLogin] = useState<PendingLoginChallenge | null>(null);

  useEffect(() => {
    let active = true;
    async function restore() {
      const token = await loadSessionToken();
      const lastActiveAt = await loadLastActiveAt();
      if (!token) {
        if (active) {
          setAuthReady(true);
        }
        return;
      }
      if (lastActiveAt && Date.now() - new Date(lastActiveAt).getTime() > INACTIVITY_LIMIT_MS) {
        await clearSessionToken();
        if (active) {
          setAuthReady(true);
        }
        return;
      }
      try {
        const restored = await services.auth.restore(token);
        if (active) {
          setSession(restored);
          setAuthReady(true);
        }
        if (restored) {
          await saveLastActiveAt(new Date().toISOString());
        }
      } catch {
        await clearSessionToken();
        if (active) {
          setSession(null);
          setAuthReady(true);
        }
      }
    }
    restore();
    return () => {
      active = false;
    };
  }, [services]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active' && session) {
        await saveLastActiveAt(new Date().toISOString());
      }
    });
    return () => subscription.remove();
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    authReady,
    session,
    pendingUser,
    pendingLogin,
    beginLogin: async (emailOrPhone, password, roleHint) => {
      const challenge = await services.auth.beginLogin(emailOrPhone.includes('@') ? { email: emailOrPhone, password } : { phoneNumber: emailOrPhone, password }, roleHint);
      setPendingLogin(challenge);
    },
    login: async (emailOrPhone, password, roleHint) => {
      const nextSession = await services.auth.login(emailOrPhone.includes('@') ? { email: emailOrPhone, password } : { phoneNumber: emailOrPhone, password }, roleHint);
      await saveSessionToken(nextSession.token);
      await services.accounts.saveCurrent(nextSession);
      await saveLastActiveAt(new Date().toISOString());
      setSession(nextSession);
      setPendingLogin(null);
      setPendingUser(null);
      setPendingKycToken(null);
    },
    completeLogin: async otp => {
      if (!pendingLogin) {
        throw new Error('No pending login challenge. Start login again.');
      }
      const nextSession = await services.auth.completeLogin(pendingLogin.challengeToken, otp);
      await saveSessionToken(nextSession.token);
      await services.accounts.saveCurrent(nextSession);
      await saveLastActiveAt(new Date().toISOString());
      setSession(nextSession);
      setPendingLogin(null);
      setPendingUser(null);
      setPendingKycToken(null);
    },
    register: async (fullName, email, phoneNumber, password) => {
      const result = await services.auth.register({
        fullName,
        email,
        phoneNumber,
        password,
        studentIdImage: 'storage://students/pending-upload.png',
      });
      setPendingUser(result.user);
      setPendingKycToken(result.pendingKycToken ?? null);
      return result;
    },
    requestOtp: async phoneNumber => {
      await services.auth.requestOtp(phoneNumber);
    },
    verifyOtp: async (phoneNumber, otp) => {
      const response = await services.auth.verifyOtp(phoneNumber, otp);
      setPendingKycToken(response.pendingKycToken ?? null);
    },
    requestEmailVerification: async input => {
      await services.auth.requestEmailVerification({
        userId: input?.userId ?? pendingUser?.userId ?? session?.user.userId,
        email: input?.email ?? pendingUser?.email ?? session?.user.email ?? undefined,
      });
    },
    verifyEmail: async input => {
      const response = await services.auth.verifyEmail({
        userId: input.userId ?? pendingUser?.userId ?? session?.user.userId,
        code: input.code,
      });
      if (response.pendingKycToken) {
        setPendingKycToken(response.pendingKycToken);
      }
      if (response.user) {
        if (pendingUser?.userId === response.user.userId) {
          setPendingUser(response.user);
        }
        if (session?.user.userId === response.user.userId) {
          setSession(current => current ? { ...current, user: response.user! } : current);
        }
      }
      return { requiresOtp: response.requiresOtp ?? false };
    },
    getOtpGate: input => services.auth.getOtpGate(input),
    resetPassword: (phoneNumber, newPassword, otp) => services.auth.resetPassword({ phoneNumber, newPassword, otp }),
    submitPendingKyc: async input => {
      if (!pendingUser || !pendingKycToken) {
        throw new Error('No pending registration is available.');
      }
      const nextSession = await services.kyc.submitKyc(pendingUser.userId, input, pendingKycToken);
      await saveSessionToken(nextSession.token);
      await services.accounts.saveCurrent(nextSession);
      await saveLastActiveAt(new Date().toISOString());
      setSession(nextSession);
      setPendingUser(null);
      setPendingKycToken(null);
      setPendingLogin(null);
    },
    submitCurrentKyc: async input => {
      if (!session) {
        throw new Error('No active member session is available.');
      }
      const nextSession = await services.kyc.resubmitKyc(session.user.userId, input);
      await saveSessionToken(nextSession.token);
      await services.accounts.saveCurrent(nextSession);
      await saveLastActiveAt(new Date().toISOString());
      setSession(nextSession);
      setPendingUser(null);
      setPendingKycToken(null);
      setPendingLogin(null);
    },
    switchAccount: async userId => {
      const stored = await services.accounts.switchTo(userId);
      if (!stored.token) {
        throw new Error('This saved account needs password sign-in again.');
      }
      const restored = await services.auth.restore(stored.token);
      if (!restored) {
        throw new Error('This saved session has expired. Sign in again to refresh it.');
      }
      await saveSessionToken(stored.token);
      await services.accounts.saveCurrent(restored);
      await saveLastActiveAt(new Date().toISOString());
      queryClient.clear();
      setSession(restored);
      setPendingUser(null);
      setPendingKycToken(null);
      setPendingLogin(null);
    },
    logout: async () => {
      await services.auth.logout();
      await clearSessionToken();
      queryClient.clear();
      setSession(null);
      setPendingUser(null);
      setPendingKycToken(null);
      setPendingLogin(null);
    },
  }), [authReady, pendingKycToken, pendingLogin, pendingUser, queryClient, services, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
