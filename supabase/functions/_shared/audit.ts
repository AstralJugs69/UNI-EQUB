import { supabaseAdmin } from './supabaseAdmin.ts';
import type { AuditActorRole, AuditEventRecord, UserRecord } from './types.ts';

export interface AuditEventInput {
  actor?: UserRecord | null;
  actorRole?: AuditActorRole;
  eventType: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function writeAuditEvent(input: AuditEventInput) {
  const actorRole = input.actorRole ?? input.actor?.Role ?? 'System';
  const { data, error } = await supabaseAdmin
    .from('audit_events')
    .insert({
      actor_user_id: input.actor?.User_ID ?? null,
      actor_role: actorRole,
      event_type: input.eventType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
      ip_address: input.ipAddress ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as AuditEventRecord;
}

export function auditMetadata(metadata?: Record<string, unknown>) {
  return metadata ?? {};
}
