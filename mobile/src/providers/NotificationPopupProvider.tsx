import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { PropsWithChildren, useEffect } from 'react';
import { useNotificationsQuery, useProfileQuery } from '../hooks/useAppQueries';
import { useAuth } from './AuthProvider';
import { requestNotificationPermission } from '../services/native/notificationPermission';
import { showSystemNotification, supportsSystemNotification } from '../services/native/localNotifications';

const localSeenKey = (userId: string) => `@uniequb/system-notifications-seen/${userId}`;

async function loadSeenIds(userId: string) {
  const raw = await AsyncStorage.getItem(localSeenKey(userId));
  if (!raw) {
    return [] as string[];
  }
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [] as string[];
  }
}

async function saveSeenIds(userId: string, ids: string[]) {
  await AsyncStorage.setItem(localSeenKey(userId), JSON.stringify([...new Set(ids)].slice(0, 200)));
}

export function NotificationPopupProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const { data: notifications = [] } = useNotificationsQuery();
  const { data: profile } = useProfileQuery();
  const userId = session?.user.userId;
  const notificationPreference = profile?.notificationPreference ?? 'PushAndSms';

  useEffect(() => {
    let cancelled = false;

    async function showUnreadSystemNotifications() {
      if (!userId || notificationPreference === 'None' || notificationPreference === 'SmsOnly') {
        return;
      }
      const candidates = notifications
        .filter(item => item.unread && supportsSystemNotification(item))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .slice(-4);
      if (!candidates.length) {
        return;
      }
      const seenIds = await loadSeenIds(userId);
      const seen = new Set(seenIds);
      const pending = candidates.filter(item => !seen.has(item.id));
      if (!pending.length) {
        return;
      }
      const allowed = await requestNotificationPermission();
      if (!allowed || cancelled) {
        return;
      }
      const displayed: string[] = [];
      for (const notification of pending) {
        if (cancelled) {
          return;
        }
        const shown = await showSystemNotification(notification);
        if (shown) {
          displayed.push(notification.id);
        }
      }
      if (displayed.length && !cancelled) {
        await saveSeenIds(userId, [...displayed, ...seenIds]);
      }
    }

    showUnreadSystemNotifications().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [notificationPreference, notifications, userId]);

  return <>{children}</>;
}
