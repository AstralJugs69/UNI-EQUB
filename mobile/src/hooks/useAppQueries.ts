import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../providers/ServicesProvider';
import { useAuth } from '../providers/AuthProvider';
import type { PaymentMethod } from '../types/domain';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  groups: ['groups'] as const,
  group: (groupId: string) => ['group', groupId] as const,
  formationGroups: ['formation-groups'] as const,
  myFormationGroups: ['my-formation-groups'] as const,
  formationGroup: (requestId: string) => ['formation-group', requestId] as const,
  groupStatus: (groupId: string) => ['group-status', groupId] as const,
  history: ['history'] as const,
  wallet: ['wallet'] as const,
  notifications: ['notifications'] as const,
  adminOverview: ['admin-overview'] as const,
  pendingKyc: ['pending-kyc'] as const,
  pendingGroups: ['pending-groups'] as const,
  pendingFormationGroups: ['pending-formation-groups'] as const,
  reports: ['reports'] as const,
};

export function useDashboardQuery() {
  const services = useServices();
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboard,
    enabled: !!session,
    queryFn: () => services.groups.getDashboard(session!.user.userId),
  });
}

export function useGroupsQuery() {
  const services = useServices();
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.groups,
    enabled: !!session,
    queryFn: () => services.groups.listBrowseable(session!.user.userId),
  });
}

export function useGroupQuery(groupId: string) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.group(groupId),
    enabled: !!groupId,
    queryFn: () => services.groups.getGroup(groupId),
  });
}

export function useFormationGroupsQuery() {
  const services = useServices();
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.formationGroups,
    enabled: !!session,
    queryFn: () => services.formation.listPublic(session!.user.userId),
  });
}

export function useMyFormationGroupsQuery() {
  const services = useServices();
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.myFormationGroups,
    enabled: !!session,
    queryFn: () => services.formation.listMine(session!.user.userId),
  });
}

export function useFormationGroupQuery(requestId: string) {
  const services = useServices();
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.formationGroup(requestId),
    enabled: !!session && !!requestId,
    queryFn: () => services.formation.getRequest(session!.user.userId, requestId),
  });
}

export function useGroupStatusQuery(groupId: string) {
  const services = useServices();
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.groupStatus(groupId),
    enabled: !!session && !!groupId,
    queryFn: () => services.groups.getGroupStatus(session!.user.userId, groupId),
  });
}

export function useTransactionsQuery() {
  const services = useServices();
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.history,
    enabled: !!session,
    queryFn: () => services.payments.listTransactions(session!.user.userId),
  });
}

export function useWalletQuery() {
  const services = useServices();
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.wallet,
    enabled: !!session,
    queryFn: () => services.payments.getWallet(session!.user.userId),
  });
}

export function useNotificationsQuery() {
  const services = useServices();
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications,
    enabled: !!session,
    queryFn: () => services.notifications.listForUser(session!.user.userId),
  });
}

export function useAdminOverviewQuery() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: () => services.reports.getAdminOverview(),
  });
}

export function usePendingKycQuery() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.pendingKyc,
    queryFn: () => services.kyc.listPendingReviews(),
  });
}

export function usePendingGroupsQuery() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.pendingGroups,
    queryFn: () => services.groups.listPendingApprovals(),
  });
}

export function usePendingFormationGroupsQuery() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.pendingFormationGroups,
    queryFn: () => services.formation.listPendingApproval(),
  });
}

export function useReportsQuery() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.reports,
    queryFn: () => services.reports.listReports(),
  });
}

export function useMemberActions() {
  const services = useServices();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const refreshMemberData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
      queryClient.invalidateQueries({ queryKey: queryKeys.formationGroups }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myFormationGroups }),
      queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: ['group-status'] }),
    ]);
  };

  return {
    joinGroup: useMutation({
      mutationFn: (groupId: string) => services.groups.joinGroup(session!.user.userId, groupId),
      onSuccess: refreshMemberData,
    }),
    payContribution: useMutation({
      mutationFn: ({ groupId, method }: { groupId: string; method: PaymentMethod }) =>
        services.payments.payContribution(session!.user.userId, groupId, method),
      onSuccess: refreshMemberData,
    }),
    withdrawPayout: useMutation({
      mutationFn: () => services.payments.withdrawPayout(session!.user.userId),
      onSuccess: refreshMemberData,
    }),
    markNotificationsRead: useMutation({
      mutationFn: () => services.notifications.markAllRead(session!.user.userId),
      onSuccess: refreshMemberData,
    }),
    createGroup: useMutation({
      mutationFn: (input: Parameters<typeof services.groups.createRequest>[1]) =>
        services.groups.createRequest(session!.user.userId, input),
      onSuccess: async () => {
        await refreshMemberData();
        await queryClient.invalidateQueries({ queryKey: queryKeys.pendingGroups });
      },
    }),
    createFormation: useMutation({
      mutationFn: (input: Parameters<typeof services.formation.createRequest>[1]) =>
        services.formation.createRequest(session!.user.userId, input),
      onSuccess: async detail => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myFormationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroup(detail.groupRequest.id) }),
        ]);
      },
    }),
    requestJoinFormation: useMutation({
      mutationFn: ({ requestId, acceptedTermsVersion }: { requestId: string; acceptedTermsVersion: string }) =>
        services.formation.requestJoin(session!.user.userId, requestId, {
          groupTermsAccepted: true,
          acceptedTermsVersion,
        }),
      onSuccess: async (_detail, variables) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myFormationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroup(variables.requestId) }),
        ]);
      },
    }),
    lookupFormationInviteCode: useMutation({
      mutationFn: (inviteCode: string) =>
        services.formation.lookupInviteCode(session!.user.userId, inviteCode),
      onSuccess: async detail => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.formationGroup(detail.groupRequest.id) });
      },
    }),
    acceptFormationInviteCode: useMutation({
      mutationFn: ({ inviteCode, acceptedTermsVersion }: { inviteCode: string; acceptedTermsVersion: string }) =>
        services.formation.acceptInvite(session!.user.userId, {
          inviteCode,
          groupTermsAccepted: true,
          acceptedTermsVersion,
        }),
      onSuccess: async detail => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myFormationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroup(detail.groupRequest.id) }),
        ]);
      },
    }),
    inviteFormation: useMutation({
      mutationFn: (input: Parameters<typeof services.formation.invite>[1]) =>
        services.formation.invite(session!.user.userId, input),
      onSuccess: async response => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.formationGroup(response.detail.groupRequest.id) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.myFormationGroups });
      },
    }),
    acceptFormationJoin: useMutation({
      mutationFn: ({ joinRequestId, decisionReason }: { joinRequestId: string; decisionReason?: string }) =>
        services.formation.acceptJoin(session!.user.userId, joinRequestId, decisionReason),
      onSuccess: async detail => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myFormationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroup(detail.groupRequest.id) }),
        ]);
      },
    }),
    removeFormationParticipant: useMutation({
      mutationFn: ({ joinRequestId, decisionReason }: { joinRequestId: string; decisionReason?: string }) =>
        services.formation.removeParticipant(session!.user.userId, joinRequestId, decisionReason),
      onSuccess: async detail => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myFormationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroup(detail.groupRequest.id) }),
        ]);
      },
    }),
    submitFormationForApproval: useMutation({
      mutationFn: (requestId: string) =>
        services.formation.submitForApproval(session!.user.userId, requestId),
      onSuccess: async detail => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myFormationGroups }),
          queryClient.invalidateQueries({ queryKey: queryKeys.formationGroup(detail.groupRequest.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.pendingGroups }),
        ]);
      },
    }),
  };
}

export function useAdminActions() {
  const services = useServices();
  const queryClient = useQueryClient();

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview }),
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingKyc }),
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingGroups }),
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingFormationGroups }),
      queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
      queryClient.invalidateQueries({ queryKey: queryKeys.formationGroups }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports }),
    ]);
  };

  return {
    approveKyc: useMutation({
      mutationFn: (userId: string) => services.kyc.approve(userId),
      onSuccess: refreshAdminData,
    }),
    requestKycResubmission: useMutation({
      mutationFn: (userId: string) => services.kyc.requestResubmission(userId),
      onSuccess: refreshAdminData,
    }),
    banUser: useMutation({
      mutationFn: (userId: string) => services.kyc.ban(userId),
      onSuccess: refreshAdminData,
    }),
    approveGroup: useMutation({
      mutationFn: (groupId: string) => services.groups.approve(groupId),
      onSuccess: refreshAdminData,
    }),
    rejectGroup: useMutation({
      mutationFn: (groupId: string) => services.groups.reject(groupId),
      onSuccess: refreshAdminData,
    }),
    freezeGroup: useMutation({
      mutationFn: (groupId: string) => services.groups.freeze(groupId),
      onSuccess: refreshAdminData,
    }),
    approveFormationGroup: useMutation({
      mutationFn: ({ requestId, decisionReason }: { requestId: string; decisionReason?: string }) =>
        services.formation.adminApprove(requestId, decisionReason),
      onSuccess: refreshAdminData,
    }),
    rejectFormationGroup: useMutation({
      mutationFn: ({ requestId, decisionReason }: { requestId: string; decisionReason?: string }) =>
        services.formation.adminReject(requestId, decisionReason),
      onSuccess: refreshAdminData,
    }),
    sendReminders: useMutation({
      mutationFn: () => services.notifications.sendReminderBatch(),
      onSuccess: refreshAdminData,
    }),
    exportReport: useMutation({
      mutationFn: ({ title, format }: { title: string; format: 'PDF' | 'CSV' }) => services.reports.exportReport(title, format),
    }),
  };
}

