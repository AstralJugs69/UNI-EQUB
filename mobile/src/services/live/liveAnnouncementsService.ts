import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import type { AnnouncementInput, AnnouncementService } from '../contracts';
import type { GroupAnnouncement } from '../../types/domain';
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
  const { data, error } = await supabase.functions.invoke<Envelope<T>>('announcement-board', {
    body: { ...body, token },
  });
  if (error) {
    throw new Error(await readLiveFunctionError(error, 'Announcement board invocation failed.'));
  }
  return assertLiveEnvelope(data, 'Announcement board invocation failed.');
}

export const liveAnnouncementsService: AnnouncementService = {
  async listForGroup(input): Promise<GroupAnnouncement[]> {
    const response = await invoke<{ announcements: GroupAnnouncement[] }>({ action: 'listForGroup', ...input });
    return response.announcements;
  },

  async create(input: AnnouncementInput): Promise<GroupAnnouncement> {
    const response = await invoke<{ announcement: GroupAnnouncement }>({ action: 'create', announcement: input });
    return response.announcement;
  },

  async update(id: string, input: Partial<AnnouncementInput>): Promise<GroupAnnouncement> {
    const response = await invoke<{ announcement: GroupAnnouncement }>({ action: 'update', announcementId: id, announcement: input });
    return response.announcement;
  },

  async archive(id: string): Promise<void> {
    await invoke({ action: 'archive', announcementId: id });
  },
};
