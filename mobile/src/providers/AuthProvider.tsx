import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type { AuthSession, SessionUser } from '../types/domain';
import type { KycSubmissionInput } from '../services/contracts';
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
  beginLogin: (phoneNumber: string, password: string, roleHint?: 'Member' | 'Admin') => Promise<void>;
  completeLogin: (otp: string) => Promise<void>;
  register: (fullName: string, phoneNumber: string, password: string) => Promise<void>;
  requestOtp: (phoneNumber: string) => Promise<void>;
  verifyOtp: (phoneNumber: string, otp: string) => Promise<void>;
  submitPendingKyc: (input: KycSubmissionInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const services = useServices();
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
    beginLogin: async (phoneNumber, password, roleHint) => {
      const challenge = await services.auth.beginLogin({ phoneNumber, password }, roleHint);
      setPendingLogin(challenge);
    },
    completeLogin: async otp => {
      if (!pendingLogin) {
        throw new Error('No pending login challenge. Start login again.');
      }
      const nextSession = await services.auth.completeLogin(pendingLogin.challengeToken, otp);
      await saveSessionToken(nextSession.token);
      await saveLastActiveAt(new Date().toISOString());
      setSession(nextSession);
      setPendingLogin(null);
      setPendingUser(null);
      setPendingKycToken(null);
    },
    register: async (fullName, phoneNumber, password) => {
      const user = await services.auth.register({
        fullName,
        phoneNumber,
        password,
        studentIdImage: 'storage://students/pending-upload.png',
      });
      setPendingUser(user);
      setPendingKycToken(null);
    },
    requestOtp: async phoneNumber => {
      await services.auth.requestOtp(phoneNumber);
    },
    verifyOtp: async (phoneNumber, otp) => {
      const response = await services.auth.verifyOtp(phoneNumber, otp);
      setPendingKycToken(response.pendingKycToken ?? null);
    },
    submitPendingKyc: async input => {
      if (!pendingUser || !pendingKycToken) {
        throw new Error('No pending registration is available.');
      }
      const nextSession = await services.kyc.submitKyc(pendingUser.userId, input, pendingKycToken);
      await saveSessionToken(nextSession.token);
      await saveLastActiveAt(new Date().toISOString());
      setSession(nextSession);
      setPendingUser(null);
      setPendingKycToken(null);
      setPendingLogin(null);
    },
    logout: async () => {
      await services.auth.logout();
      await clearSessionToken();
      setSession(null);
      setPendingUser(null);
      setPendingKycToken(null);
      setPendingLogin(null);
    },
  }), [authReady, pendingKycToken, pendingLogin, pendingUser, services, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}



