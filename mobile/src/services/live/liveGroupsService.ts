import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import type { GroupService } from '../contracts';
import type {
  DashboardSnapshot,
  GroupApprovalItem,
  GroupFreezeEventRecord,
  GroupFreezeResolutionAction,
  GroupRecord,
  GroupStatusSnapshot,
  MembershipRecord,
  RoundRecord,
  SessionUser,
} from '../../types/domain';
import { assertLiveEnvelope, readLiveFunctionError } from './liveFunctionError';

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
    throw new Error(await readLiveFunctionError(error, 'Group lifecycle invocation failed.'));
  }
  return assertLiveEnvelope(data, 'Group lifecycle invocation failed.');
}

export const liveGroupsService: GroupService = {
  async listBrowseable(_userId: string): Promise<GroupRecord[]> {
    const response = await invoke<{ groups: GroupRecord[] }>({ action: 'listBrowseable' });
    return response.groups;
  },

  async getGroup(groupId: string): Promise<GroupRecord | null> {
    try {
      const response = await invoke<{ group: GroupRecord }>({ action: 'getGroup', groupId });
      return response.group;
    } catch {
      return null;
    }
  },

  async getGroupStatus(_userId: string, groupId: string): Promise<GroupStatusSnapshot> {
    return invoke<GroupStatusSnapshot>({ action: 'getGroupStatus', groupId });
  },

  async createRequest(_userId: string, input): Promise<GroupRecord> {
    const response = await invoke<{ group: GroupRecord }>({
      action: 'createRequest',
      createRequest: input,
    });
    return response.group;
  },

  async listPendingApprovals(): Promise<GroupApprovalItem[]> {
    const response = await invoke<PendingApprovalResponse>({ action: 'listPending' });
    return response.items.map(item => ({
      group: item.group,
      creator: item.creator,
      note: item.note,
    }));
  },

  async approve(groupId: string): Promise<void> {
    await invoke<{ group: GroupRecord; currentRound: RoundRecord }>({ action: 'approve', groupId });
  },

  async reject(groupId: string): Promise<void> {
    await invoke<{ group: GroupRecord; note: string }>({ action: 'reject', groupId });
  },

  async freeze(groupId: string): Promise<void> {
    await invoke<{ group: GroupRecord; freezeEvent?: GroupFreezeEventRecord }>({ action: 'freeze', groupId });
  },

  async resolveFreeze(groupId: string, resolutionAction: GroupFreezeResolutionAction = 'ContinueWithReserveFrozen', resolutionNote?: string): Promise<void> {
    await invoke<{ group: GroupRecord; freezeEvent?: GroupFreezeEventRecord }>({
      action: 'resolveFreeze',
      groupId,
      resolutionAction,
      resolutionNote,
    });
  },

  async createResolutionPoll(groupId: string): Promise<GroupStatusSnapshot['activeResolutionPoll']> {
    const response = await invoke<Pick<GroupStatusSnapshot, 'activeResolutionPoll' | 'refundTickets'>>({
      action: 'createResolutionPoll',
      groupId,
    });
    return response.activeResolutionPoll ?? null;
  },

  async voteResolutionPoll(groupId: string, pollId: string, optionId: string): Promise<void> {
    await invoke({
      action: 'voteResolutionPoll',
      groupId,
      pollId,
      optionId,
    });
  },

  async closeResolutionPoll(groupId: string, pollId: string): Promise<void> {
    await invoke({
      action: 'closeResolutionPoll',
      groupId,
      pollId,
    });
  },

  async decideWinnerExit(groupId: string, windowId: string, decision: 'Continue' | 'Exit'): Promise<void> {
    await invoke({
      action: 'decideWinnerExit',
      groupId,
      winnerExitWindowId: windowId,
      winnerExitDecision: decision,
    });
  },

  async joinGroup(_userId: string, groupId: string): Promise<void> {
    await invoke<{ membership: MembershipRecord; group: GroupRecord; currentRound: RoundRecord }>({ action: 'join', groupId });
  },

  async getDashboard(_userId: string): Promise<DashboardSnapshot> {
    return invoke<DashboardSnapshot>({ action: 'getDashboard' });
  },
};
