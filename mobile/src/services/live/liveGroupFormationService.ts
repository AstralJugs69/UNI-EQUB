import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import type {
  CreateGroupFormationInput,
  FormationInvitationInput,
  FormationTermsAcceptance,
  GroupFormationService,
} from '../contracts';
import type {
  ContributionObligationRecord,
  GroupFormationDetail,
  GroupFormationRequestSummary,
  GroupInvitationRecord,
  GroupJoinRequestRecord,
  GroupRecord,
  GroupRequestRecord,
  MembershipRecord,
  RoundRecord,
} from '../../types/domain';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface FormationDetailEnvelope {
  groupRequest: GroupRequestRecord;
  joinRequests?: GroupJoinRequestRecord[];
  invitations?: GroupInvitationRecord[];
  joinRequest?: GroupJoinRequestRecord;
  creatorParticipant?: GroupJoinRequestRecord;
  accepted_participant_count?: number;
  remaining_slots?: number;
}

interface FormationListResponse {
  requests: GroupFormationRequestSummary[];
}

interface FormationInviteResponse extends FormationDetailEnvelope {
  invitation: GroupInvitationRecord;
}

interface FormationApprovalResponse extends FormationDetailEnvelope {
  group: GroupRecord;
  memberships?: MembershipRecord[];
  round?: RoundRecord;
  obligations?: ContributionObligationRecord[];
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const token = await loadSessionToken();
  if (!token) {
    throw new Error('No active session token was found.');
  }

  const { data, error } = await supabase.functions.invoke<Envelope<T>>('group-formation', {
    body: { ...body, token },
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.ok || !data.data) {
    throw new Error(data?.error ?? 'Group formation invocation failed.');
  }
  return data.data;
}

function toDetail(response: FormationDetailEnvelope): GroupFormationDetail {
  const joinRequests = response.joinRequests ?? [
    response.joinRequest,
    response.creatorParticipant,
  ].filter((item): item is GroupJoinRequestRecord => Boolean(item));
  const acceptedCount = response.accepted_participant_count
    ?? joinRequests.filter(item => item.status === 'Accepted').length;

  return {
    groupRequest: response.groupRequest,
    joinRequests,
    invitations: response.invitations ?? [],
    accepted_participant_count: acceptedCount,
    remaining_slots: response.remaining_slots ?? Math.max(response.groupRequest.max_members - acceptedCount, 0),
  };
}

export const liveGroupFormationService: GroupFormationService = {
  async listPublic(_userId: string): Promise<GroupFormationRequestSummary[]> {
    const response = await invoke<FormationListResponse>({ action: 'listPublic' });
    return response.requests;
  },

  async listMine(_userId: string): Promise<GroupFormationRequestSummary[]> {
    const response = await invoke<FormationListResponse>({ action: 'listMine' });
    return response.requests;
  },

  async listPendingApproval(): Promise<GroupFormationRequestSummary[]> {
    const response = await invoke<FormationListResponse>({ action: 'listPendingApproval' });
    return response.requests;
  },

  async getRequest(_userId: string, requestId: string): Promise<GroupFormationDetail> {
    const response = await invoke<FormationDetailEnvelope>({ action: 'getRequest', requestId });
    return toDetail(response);
  },

  async createRequest(_userId: string, input: CreateGroupFormationInput): Promise<GroupFormationDetail> {
    const response = await invoke<FormationDetailEnvelope>({
      action: 'createRequest',
      createRequest: input,
    });
    return toDetail(response);
  },

  async requestJoin(_userId: string, requestId: string, terms: FormationTermsAcceptance): Promise<GroupFormationDetail> {
    const response = await invoke<FormationDetailEnvelope>({
      action: 'requestJoin',
      requestId,
      ...terms,
    });
    return toDetail(response);
  },

  async acceptJoin(_userId: string, joinRequestId: string, decisionReason?: string): Promise<GroupFormationDetail> {
    const response = await invoke<FormationDetailEnvelope>({
      action: 'acceptJoin',
      joinRequestId,
      decisionReason,
    });
    return toDetail(response);
  },

  async removeParticipant(_userId: string, joinRequestId: string, decisionReason?: string): Promise<GroupFormationDetail> {
    const response = await invoke<FormationDetailEnvelope>({
      action: 'removeParticipant',
      joinRequestId,
      decisionReason,
    });
    return toDetail(response);
  },

  async invite(_userId: string, input: FormationInvitationInput): Promise<{ detail: GroupFormationDetail; invitation: GroupInvitationRecord }> {
    const response = await invoke<FormationInviteResponse>({
      action: 'invite',
      requestId: input.requestId,
      targetUserId: input.targetUserId,
      invitedPhoneOrStudentId: input.invitedPhoneOrStudentId,
      inviteCode: input.inviteCode,
    });
    return { detail: toDetail(response), invitation: response.invitation };
  },

  async acceptInvite(_userId: string, input): Promise<GroupFormationDetail> {
    const response = await invoke<FormationDetailEnvelope>({
      action: 'acceptInvite',
      invitationId: input.invitationId,
      inviteCode: input.inviteCode,
      groupTermsAccepted: input.groupTermsAccepted,
      acceptedTermsVersion: input.acceptedTermsVersion,
    });
    return toDetail(response);
  },

  async submitForApproval(_userId: string, requestId: string): Promise<GroupFormationDetail> {
    const response = await invoke<FormationDetailEnvelope>({
      action: 'submitForApproval',
      requestId,
    });
    return toDetail(response);
  },

  async adminApprove(requestId: string, decisionReason?: string): Promise<GroupRecord> {
    const response = await invoke<FormationApprovalResponse>({
      action: 'adminApprove',
      requestId,
      decisionReason,
    });
    return response.group;
  },

  async adminReject(requestId: string, decisionReason?: string): Promise<GroupFormationDetail> {
    const response = await invoke<FormationDetailEnvelope>({
      action: 'adminReject',
      requestId,
      decisionReason,
    });
    return toDetail(response);
  },
};
