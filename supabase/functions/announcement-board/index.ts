import { fail, failFromError, json } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupRecord, GroupRequestRecord, MembershipRecord, UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function requireActor(token: string) {
  const payload = await verifySession(token);
  const userId = payload.sub;
  if (!userId) {
    throw new Error('Invalid session token.');
  }
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw error;
  }
  return data as UserRecord;
}

function toAnnouncement(row: Record<string, unknown>) {
  return {
    id: row.id,
    groupId: row.group_id,
    groupRequestId: row.group_request_id,
    createdBy: row.created_by,
    title: row.title,
    body: row.body,
    priority: row.priority,
    pinned: row.pinned,
    scope: row.target_scope,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getGroup(groupId: string) {
  const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Group_ID', groupId).single();
  if (error) {
    throw error;
  }
  return data as GroupRecord;
}

async function getGroupRequest(requestId: string) {
  const { data, error } = await supabaseAdmin.from('group_requests').select('*').eq('id', requestId).single();
  if (error) {
    throw error;
  }
  return data as GroupRequestRecord;
}

async function assertCanRead(actor: UserRecord, groupId?: string | null, groupRequestId?: string | null) {
  if (actor.Role === 'Admin') {
    return;
  }
  if (groupId) {
    const { data, error } = await supabaseAdmin
      .from('GroupMembers')
      .select('*')
      .eq('Group_ID', groupId)
      .eq('User_ID', actor.User_ID)
      .eq('Status', 'Active')
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      return;
    }
  }
  if (groupRequestId) {
    const request = await getGroupRequest(groupRequestId);
    if (request.creator_id === actor.User_ID) {
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('group_join_requests')
      .select('*')
      .eq('group_request_id', groupRequestId)
      .eq('user_id', actor.User_ID)
      .in('status', ['Accepted', 'Requested'])
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      return;
    }
  }
  throw new Error('Announcement access is not allowed.');
}

async function assertCanWrite(actor: UserRecord, groupId?: string | null, groupRequestId?: string | null) {
  if (actor.Role === 'Admin') {
    return;
  }
  if (groupId) {
    const group = await getGroup(groupId);
    if (group.Creator_ID === actor.User_ID) {
      return;
    }
  }
  if (groupRequestId) {
    const request = await getGroupRequest(groupRequestId);
    if (request.creator_id === actor.User_ID) {
      return;
    }
  }
  throw new Error('Only admins or group creators can manage announcements.');
}

async function targetUserIds(groupId?: string | null, groupRequestId?: string | null) {
  if (groupId) {
    const { data, error } = await supabaseAdmin.from('GroupMembers').select('*').eq('Group_ID', groupId).eq('Status', 'Active');
    if (error) {
      throw error;
    }
    return ((data ?? []) as MembershipRecord[]).map(item => item.User_ID);
  }
  if (groupRequestId) {
    const request = await getGroupRequest(groupRequestId);
    const { data, error } = await supabaseAdmin.from('group_join_requests').select('user_id').eq('group_request_id', groupRequestId).in('status', ['Accepted', 'Requested']);
    if (error) {
      throw error;
    }
    return [...new Set([request.creator_id, ...(data ?? []).map(item => item.user_id as string)])];
  }
  return [];
}

async function notifyTargets(announcement: Record<string, unknown>) {
  if (announcement.priority !== 'High' && announcement.priority !== 'Critical' && !announcement.pinned) {
    return;
  }
  const users = await targetUserIds(announcement.group_id as string | null, announcement.group_request_id as string | null);
  if (!users.length) {
    return;
  }
  await supabaseAdmin.from('notifications').insert(users.map(userId => ({
    user_id: userId,
    type: 'Announcement',
    severity: announcement.priority === 'Critical' ? 'Warning' : 'Info',
    title: announcement.title,
    message: announcement.body,
    action_route: announcement.group_id ? 'member/group' : 'member/group-formation',
    related_entity_type: announcement.group_id ? 'EqubGroup' : 'group_requests',
    related_entity_id: announcement.group_id ?? announcement.group_request_id,
    metadata: { announcementId: announcement.id },
  })));
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = await request.json();
    const actor = await requireActor(body.token);

    switch (body.action) {
      case 'listForGroup': {
        await assertCanRead(actor, body.groupId, body.groupRequestId);
        let query = supabaseAdmin.from('group_announcements').select('*').is('archived_at', null).order('pinned', { ascending: false }).order('created_at', { ascending: false });
        query = body.groupId ? query.eq('group_id', body.groupId) : query.eq('group_request_id', body.groupRequestId);
        const { data, error } = await query;
        if (error) {
          throw error;
        }
        return json({ announcements: (data ?? []).map(row => toAnnouncement(row as Record<string, unknown>)) });
      }
      case 'create': {
        const input = body.announcement ?? {};
        await assertCanWrite(actor, input.groupId, input.groupRequestId);
        if (!input.groupId && !input.groupRequestId) {
          return fail('Announcement target is required.', 400);
        }
        const { data, error } = await supabaseAdmin
          .from('group_announcements')
          .insert({
            group_id: input.groupId ?? null,
            group_request_id: input.groupRequestId ?? null,
            created_by: actor.User_ID,
            title: input.title,
            body: input.body,
            priority: input.priority ?? 'Normal',
            pinned: input.pinned ?? false,
            target_scope: input.groupRequestId ? 'FormingGroup' : 'ApprovedGroup',
          })
          .select('*')
          .single();
        if (error) {
          throw error;
        }
        await notifyTargets(data as Record<string, unknown>);
        return json({ announcement: toAnnouncement(data as Record<string, unknown>) }, 201);
      }
      case 'update': {
        const { data: existing, error: existingError } = await supabaseAdmin.from('group_announcements').select('*').eq('id', body.announcementId).single();
        if (existingError) {
          throw existingError;
        }
        await assertCanWrite(actor, existing.group_id, existing.group_request_id);
        const input = body.announcement ?? {};
        const { data, error } = await supabaseAdmin
          .from('group_announcements')
          .update({
            title: input.title ?? existing.title,
            body: input.body ?? existing.body,
            priority: input.priority ?? existing.priority,
            pinned: input.pinned ?? existing.pinned,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.announcementId)
          .select('*')
          .single();
        if (error) {
          throw error;
        }
        await notifyTargets(data as Record<string, unknown>);
        return json({ announcement: toAnnouncement(data as Record<string, unknown>) });
      }
      case 'archive': {
        const { data: existing, error: existingError } = await supabaseAdmin.from('group_announcements').select('*').eq('id', body.announcementId).single();
        if (existingError) {
          throw existingError;
        }
        await assertCanWrite(actor, existing.group_id, existing.group_request_id);
        const { error } = await supabaseAdmin.from('group_announcements').update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.announcementId);
        if (error) {
          throw error;
        }
        return json({ archived: true });
      }
      default:
        return fail('Unsupported announcement action.', 400);
    }
  } catch (error) {
    return failFromError(error, 'Unexpected announcement board error.', 500, { functionName: 'announcement-board' });
  }
});
