import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../providers/ServicesProvider';
import { useAuth } from '../providers/AuthProvider';
import type { PaymentMethod } from '../types/domain';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  groups: ['groups'] as const,
  group: (groupId: string) => ['group', groupId] as const,
  groupStatus: (groupId: string) => ['group-status', groupId] as const,
  history: ['history'] as const,
  wallet: ['wallet'] as const,
  notifications: ['notifications'] as const,
  adminOverview: ['admin-overview'] as const,
  pendingKyc: ['pending-kyc'] as const,
  pendingGroups: ['pending-groups'] as const,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports }),
    ]);
  };

  return {
    approveKyc: useMutation({
      mutationFn: (userId: string) => services.kyc.approve(userId),
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
    sendReminders: useMutation({
      mutationFn: () => services.notifications.sendReminderBatch(),
      onSuccess: refreshAdminData,
    }),
    exportReport: useMutation({
      mutationFn: ({ title, format }: { title: string; format: 'PDF' | 'CSV' }) => services.reports.exportReport(title, format),
    }),
  };
}

