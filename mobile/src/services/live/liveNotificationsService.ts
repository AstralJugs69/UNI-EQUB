import { supabase } from '../supabaseClient';
import { loadSessionToken, loadReadNotificationIds, saveReadNotificationIds } from '../storage';
import type { NotificationService } from '../contracts';
import type { AppNotification, ReminderBatchResult } from '../../types/domain';
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

  const { data, error } = await supabase.functions.invoke<Envelope<T>>('notification-center', {
    body: { ...body, token },
  });

  if (error) {
    throw new Error(await readLiveFunctionError(error, 'Notification center invocation failed.'));
  }
  return assertLiveEnvelope(data, 'Notification center invocation failed.');
}

function sortNotifications(items: AppNotification[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export const liveNotificationsService: NotificationService = {
  async listForUser(userId: string): Promise<AppNotification[]> {
    const response = await invoke<{ notifications: AppNotification[] }>({ action: 'listForUser' });
    const readIds = new Set(await loadReadNotificationIds(userId));
    return sortNotifications(
      response.notifications.map(item => ({
        ...item,
        unread: !readIds.has(item.id),
      })),
    );
  },

  async markAllRead(userId: string): Promise<void> {
    const items = await liveNotificationsService.listForUser(userId);
    await saveReadNotificationIds(userId, items.map(item => item.id));
  },

  async sendReminderBatch(): Promise<ReminderBatchResult> {
    return invoke<ReminderBatchResult>({ action: 'sendReminderBatch' });
  },
};
