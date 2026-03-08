import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'uniequb-session';
const FALLBACK_KEY = '@uniequb/session-token';
const LAST_ACTIVE_KEY = '@uniequb/last-active-at';
const notificationReadKey = (userId: string) => `@uniequb/notifications-read/${userId}`;

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
