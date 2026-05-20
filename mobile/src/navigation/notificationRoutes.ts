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
    if ((entityType === 'kyc_submission' || entityType === 'user') && entityId) {
      return { name: routes.adminKycReview, params: { userId: entityId } };
    }
    return null;
  }

  if (actionRoute === 'member/group' && (entityType === 'EqubGroup' || entityType === 'group') && entityId) {
    return { name: routes.groupStatus, params: { groupId: entityId } };
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

  if (actionRoute === 'member/wallet') {
    return { name: routes.memberTabs, params: { screen: routes.wallet } };
  }

  return null;
}
