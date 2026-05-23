import { routes } from './routes';
import type { AppNotification, UserRole } from '../types/domain';

export interface ResolvedNotificationRoute {
  name: string;
  params?: Record<string, unknown>;
}

export function resolveNotificationRoute(notification: AppNotification, role: UserRole = 'Member'): ResolvedNotificationRoute | null {
  const entityId = notification.relatedEntityId ?? undefined;
  const entityType = notification.relatedEntityType ?? undefined;
  const actionRoute = notification.actionRoute ?? undefined;

  if (role === 'Admin') {
    if (actionRoute === 'admin/group-formation' && entityType === 'group_requests' && entityId) {
      return { name: routes.adminGroupReview, params: { kind: 'formation', requestId: entityId } };
    }
    if ((actionRoute === 'admin/group-review' || actionRoute === 'admin/group' || notification.type?.startsWith('group_resolution_')) && (entityType === 'EqubGroup' || entityType === 'group') && entityId) {
      return { name: routes.adminGroupReview, params: { kind: notification.type?.startsWith('group_resolution_') ? 'frozen' : 'legacy', groupId: entityId } };
    }
    if ((entityType === 'kyc_submission' || entityType === 'user') && entityId) {
      return { name: routes.adminKycReview, params: { userId: entityId } };
    }
    return null;
  }

  if ((actionRoute === 'member/resolution-vote' || notification.type?.startsWith('group_resolution_')) && (entityType === 'EqubGroup' || entityType === 'group') && entityId) {
    return { name: routes.resolutionVote, params: { groupId: entityId } };
  }

  if ((actionRoute === 'member/group' || actionRoute === 'member/group-cycle') && (entityType === 'EqubGroup' || entityType === 'group') && entityId) {
    return { name: routes.groupStatus, params: { groupId: entityId } };
  }

  if (actionRoute === 'member/group-preview' && (entityType === 'EqubGroup' || entityType === 'group') && entityId) {
    return { name: routes.groupDetail, params: { groupId: entityId } };
  }

  if (actionRoute === 'member/payment' && (entityType === 'EqubGroup' || entityType === 'group') && entityId) {
    return { name: routes.payment, params: { groupId: entityId } };
  }

  if (actionRoute === 'member/group-formation' && entityType === 'group_requests' && entityId) {
    if (notification.type === 'group_join_requested' || notification.type === 'GroupFormationSubmitted') {
      return { name: routes.formationCreator, params: { requestId: entityId } };
    }
    return { name: routes.formationDetail, params: { requestId: entityId } };
  }

  if (actionRoute === 'member/kyc') {
    return { name: routes.kyc, params: { mode: 'resubmission' } };
  }

  if (actionRoute === 'member/profile-email' || actionRoute === 'member/email-verification') {
    return { name: routes.profileEmail };
  }

  if (actionRoute === 'member/wallet') {
    return { name: routes.memberTabs, params: { screen: routes.wallet } };
  }

  if (actionRoute === 'member/transaction' && entityType === 'Transaction' && entityId) {
    return { name: routes.transactionDetail, params: { transactionId: entityId } };
  }

  if (actionRoute === 'member/notifications') {
    return { name: routes.memberTabs, params: { screen: routes.notifications } };
  }

  return null;
}
