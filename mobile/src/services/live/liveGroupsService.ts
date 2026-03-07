import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import { mockBackend } from '../mock/mockBackend';
import type { GroupService } from '../contracts';
import type { DashboardSnapshot, GroupApprovalItem, GroupRecord, GroupStatusSnapshot, MembershipRecord, RoundRecord, SessionUser } from '../../types/domain';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface PendingApprovalResponse {
  items: Array<{
    group: GroupRecord;
    creator: {
      User_ID: string;
      Full_Name: string;
      Phone_Number: string;
      Password_Hash: string;
      Student_ID_Img: string;
      KYC_Status: SessionUser['kycStatus'];
      Role: SessionUser['role'];
      Created_At: string;
    };
    note: string;
  }>;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const token = await loadSessionToken();
  if (!token) {
    throw new Error('No active session token was found.');
  }

  const { data, error } = await supabase.functions.invoke<Envelope<T>>('group-lifecycle', {
    body: { ...body, token },
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.ok || !data.data) {
    throw new Error(data?.error ?? 'Group lifecycle invocation failed.');
  }
  return data.data;
}

function toSessionUser(user: PendingApprovalResponse['items'][number]['creator']): SessionUser {
  return {
    userId: user.User_ID,
    fullName: user.Full_Name,
    phoneNumber: user.Phone_Number,
    role: user.Role,
    kycStatus: user.KYC_Status,
  };
}

function syncGroupShape(group: GroupRecord | null | undefined) {
  if (group) {
    mockBackend.syncExternalGroup(group);
  }
}

function syncRoundShape(round: RoundRecord | null | undefined) {
  if (round) {
    mockBackend.syncExternalRound(round);
  }
}

export const liveGroupsService: GroupService = {
  async listBrowseable(): Promise<GroupRecord[]> {
    const response = await invoke<{ groups: GroupRecord[] }>({ action: 'listBrowseable' });
    mockBackend.syncExternalGroups(response.groups);
    return response.groups;
  },

  async getGroup(groupId: string): Promise<GroupRecord | null> {
    const response = await invoke<{ group: GroupRecord }>({ action: 'getGroup', groupId });
    syncGroupShape(response.group);
    return response.group;
  },

  async getGroupStatus(userId: string, groupId: string): Promise<GroupStatusSnapshot> {
    const response = await invoke<GroupStatusSnapshot>({ action: 'getGroupStatus', groupId });
    syncGroupShape(response.group);
    syncRoundShape(response.currentRound);
    if (response.canCurrentUserPay) {
      mockBackend.syncExternalMembership({
        Membership_ID: `live-${userId}-${groupId}`,
        Group_ID: groupId,
        User_ID: userId,
        Joined_At: new Date().toISOString(),
        Status: 'Active',
      });
    }
    return response;
  },

  async createRequest(_userId: string, input): Promise<GroupRecord> {
    const response = await invoke<{ group: GroupRecord }>({
      action: 'createRequest',
      createRequest: input,
    });
    syncGroupShape(response.group);
    return response.group;
  },

  async listPendingApprovals(): Promise<GroupApprovalItem[]> {
    const response = await invoke<PendingApprovalResponse>({ action: 'listPending' });
    response.items.forEach(item => {
      syncGroupShape(item.group);
      mockBackend.syncExternalUser(toSessionUser(item.creator));
    });
    return response.items.map(item => ({
      group: item.group,
      creator: item.creator,
      note: item.note,
    }));
  },

  async approve(groupId: string): Promise<void> {
    const response = await invoke<{ group: GroupRecord; currentRound: RoundRecord }>({ action: 'approve', groupId });
    syncGroupShape(response.group);
    syncRoundShape(response.currentRound);
  },

  async reject(groupId: string): Promise<void> {
    const response = await invoke<{ group: GroupRecord; note: string }>({ action: 'reject', groupId });
    syncGroupShape(response.group);
  },

  async freeze(groupId: string): Promise<void> {
    const response = await invoke<{ group: GroupRecord }>({ action: 'freeze', groupId });
    syncGroupShape(response.group);
  },

  async joinGroup(_userId: string, groupId: string): Promise<void> {
    const response = await invoke<{ membership: MembershipRecord; group: GroupRecord; currentRound: RoundRecord }>({ action: 'join', groupId });
    syncGroupShape(response.group);
    syncRoundShape(response.currentRound);
    mockBackend.syncExternalMembership(response.membership);
  },

  async getDashboard(userId: string): Promise<DashboardSnapshot> {
    const response = await invoke<DashboardSnapshot>({ action: 'getDashboard' });
    syncGroupShape(response.currentGroup);
    syncRoundShape(response.currentRound);
    if (response.currentGroup) {
      mockBackend.syncExternalMembership({
        Membership_ID: `live-${userId}-${response.currentGroup.Group_ID}`,
        Group_ID: response.currentGroup.Group_ID,
        User_ID: userId,
        Joined_At: new Date().toISOString(),
        Status: 'Active',
      });
    }
    return response;
  },
};
