import { supabaseAdmin } from './supabaseAdmin.ts';
import type { DurableNotificationRecord, NotificationSeverity } from './types.ts';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  actionRoute?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  deliveredInAppAt?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      severity: input.severity ?? 'Info',
      title: input.title,
      message: input.message,
      action_route: input.actionRoute ?? null,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      metadata: input.metadata ?? {},
      expires_at: input.expiresAt ?? null,
      delivered_in_app_at: input.deliveredInAppAt ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as DurableNotificationRecord;
}

export async function markUserNotificationsRead(userId: string) {
  const readAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: readAt })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }
  return { readAt };
}
