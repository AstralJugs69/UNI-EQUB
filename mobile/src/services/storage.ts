import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import type { AccountSlot, AuthSession } from '../types/domain';

const SERVICE = 'uniequb-session';
const FALLBACK_KEY = '@uniequb/session-token';
const LAST_ACTIVE_KEY = '@uniequb/last-active-at';
const ACCOUNT_SLOTS_KEY = '@uniequb/account-slots';
const APP_PREFERENCES_KEY = '@uniequb/local-preferences';
const notificationReadKey = (userId: string) => `@uniequb/notifications-read/${userId}`;
const seenDrawsKey = (userId: string) => `@uniequb/seen-draws-v2/${userId}`;
const accountTokenService = (userId: string) => `uniequb-account/${userId}`;

export type LocalAppLanguage = 'English' | 'Amharic';
export type LocalAppTheme = 'Light' | 'Dark' | 'System';

export interface LocalAppPreferences {
  language: LocalAppLanguage;
  theme: LocalAppTheme;
}

export async function saveSessionToken(token: string) {
  try {
    await Keychain.setGenericPassword('session', token, { service: SERVICE });
  } catch {
    await AsyncStorage.setItem(FALLBACK_KEY, token);
  }
}

export async function loadSessionToken() {
  try {
    const credentials = await Keychain.getGenericPassword({ service: SERVICE });
    if (credentials) {
      return credentials.password;
    }
  } catch {
    // fall through to AsyncStorage
  }
  return AsyncStorage.getItem(FALLBACK_KEY);
}

export async function saveLastActiveAt(value: string) {
  await AsyncStorage.setItem(LAST_ACTIVE_KEY, value);
}

export async function loadLastActiveAt() {
  return AsyncStorage.getItem(LAST_ACTIVE_KEY);
}

export async function clearSessionToken() {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch {
    // ignore and continue
  }
  await AsyncStorage.removeItem(FALLBACK_KEY);
  await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
}

export async function loadAccountSlots(): Promise<AccountSlot[]> {
  const raw = await AsyncStorage.getItem(ACCOUNT_SLOTS_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as AccountSlot[];
  } catch {
    return [];
  }
}

async function saveAccountSlots(slots: AccountSlot[]) {
  const ordered = [...slots].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  await AsyncStorage.setItem(ACCOUNT_SLOTS_KEY, JSON.stringify(ordered));
}

export async function saveAccountSlot(session: AuthSession, avatarSeed?: string): Promise<AccountSlot> {
  const slot: AccountSlot = {
    userId: session.user.userId,
    displayName: session.user.fullName,
    role: session.user.role,
    phoneNumber: session.user.phoneNumber,
    avatarSeed: avatarSeed ?? session.user.userId,
    lastActiveAt: new Date().toISOString(),
    tokenState: 'Available',
  };
  try {
    await Keychain.setGenericPassword(session.user.userId, session.token, { service: accountTokenService(session.user.userId) });
  } catch {
    await AsyncStorage.setItem(`${ACCOUNT_SLOTS_KEY}/token/${session.user.userId}`, session.token);
  }
  const slots = (await loadAccountSlots()).filter(item => item.userId !== slot.userId);
  await saveAccountSlots([slot, ...slots]);
  return slot;
}

export async function loadAccountToken(userId: string): Promise<string | null> {
  try {
    const credentials = await Keychain.getGenericPassword({ service: accountTokenService(userId) });
    if (credentials) {
      return credentials.password;
    }
  } catch {
    // fall through to AsyncStorage fallback
  }
  return AsyncStorage.getItem(`${ACCOUNT_SLOTS_KEY}/token/${userId}`);
}

export async function removeAccountSlot(userId: string): Promise<void> {
  const slots = (await loadAccountSlots()).filter(item => item.userId !== userId);
  await saveAccountSlots(slots);
  try {
    await Keychain.resetGenericPassword({ service: accountTokenService(userId) });
  } catch {
    // ignore and continue
  }
  await AsyncStorage.removeItem(`${ACCOUNT_SLOTS_KEY}/token/${userId}`);
}

export async function loadLocalAppPreferences(): Promise<LocalAppPreferences> {
  const raw = await AsyncStorage.getItem(APP_PREFERENCES_KEY);
  if (!raw) {
    return { language: 'English', theme: 'Light' };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LocalAppPreferences>;
    return {
      language: parsed.language === 'Amharic' ? 'Amharic' : 'English',
      theme: parsed.theme === 'Dark' || parsed.theme === 'System' ? parsed.theme : 'Light',
    };
  } catch {
    return { language: 'English', theme: 'Light' };
  }
}

export async function saveLocalAppPreferences(preferences: LocalAppPreferences): Promise<void> {
  await AsyncStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(preferences));
}

export async function loadReadNotificationIds(userId: string) {
  const value = await AsyncStorage.getItem(notificationReadKey(userId));
  if (!value) {
    return [] as string[];
  }
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [] as string[];
  }
}

export async function saveReadNotificationIds(userId: string, ids: string[]) {
  await AsyncStorage.setItem(notificationReadKey(userId), JSON.stringify([...new Set(ids)]));
}

export async function loadSeenDrawIds(userId: string) {
  const value = await AsyncStorage.getItem(seenDrawsKey(userId));
  if (!value) {
    return [] as string[];
  }
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [] as string[];
  }
}

export async function saveSeenDrawId(userId: string, drawId: string) {
  const ids = await loadSeenDrawIds(userId);
  await AsyncStorage.setItem(seenDrawsKey(userId), JSON.stringify([...new Set([drawId, ...ids])].slice(0, 80)));
}
