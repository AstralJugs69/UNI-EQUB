import { resolveNotificationRoute } from './notificationRoutes';
import { routes } from './routes';
import type { AppNotification } from '../types/domain';

function notification(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: 'notification-test',
    title: 'Test',
    body: 'Body',
    createdAt: new Date(0).toISOString(),
    unread: true,
    ...overrides,
  };
}

describe('resolveNotificationRoute', () => {
  it('routes known member notification metadata through the whitelist', () => {
    expect(resolveNotificationRoute(notification({
      actionRoute: 'member/group',
      relatedEntityType: 'EqubGroup',
      relatedEntityId: 'group-1',
    }))).toEqual({ name: routes.groupStatus, params: { groupId: 'group-1' } });

    expect(resolveNotificationRoute(notification({
      actionRoute: 'member/payment',
      relatedEntityType: 'EqubGroup',
      relatedEntityId: 'group-1',
    }))).toEqual({ name: routes.payment, params: { groupId: 'group-1' } });

    expect(resolveNotificationRoute(notification({
      actionRoute: 'member/wallet',
      relatedEntityType: 'Transaction',
      relatedEntityId: 'txn-1',
    }))).toEqual({ name: routes.memberTabs, params: { screen: routes.wallet } });

    expect(resolveNotificationRoute(notification({
      actionRoute: 'member/transaction',
      relatedEntityType: 'Transaction',
      relatedEntityId: 'txn-1',
    }))).toEqual({ name: routes.transactionDetail, params: { transactionId: 'txn-1' } });

    expect(resolveNotificationRoute(notification({
      type: 'group_join_requested',
      actionRoute: 'member/group-formation',
      relatedEntityType: 'group_requests',
      relatedEntityId: 'request-1',
    }))).toEqual({ name: routes.formationCreator, params: { requestId: 'request-1' } });

    expect(resolveNotificationRoute(notification({
      type: 'group_join_accepted',
      actionRoute: 'member/group-formation',
      relatedEntityType: 'group_requests',
      relatedEntityId: 'request-1',
    }))).toEqual({ name: routes.formationDetail, params: { requestId: 'request-1' } });

    expect(resolveNotificationRoute(notification({
      actionRoute: 'member/profile-email',
      relatedEntityType: 'user',
      relatedEntityId: 'user-1',
    }))).toEqual({ name: routes.profileEmail });

    expect(resolveNotificationRoute(notification({
      type: 'group_resolution_poll_opened',
      actionRoute: 'member/resolution-vote',
      relatedEntityType: 'group',
      relatedEntityId: 'group-1',
    }))).toEqual({ name: routes.resolutionVote, params: { groupId: 'group-1' } });
  });

  it('routes admin review notifications without trusting raw route names', () => {
    expect(resolveNotificationRoute(notification({
      actionRoute: 'admin/group-formation',
      relatedEntityType: 'group_requests',
      relatedEntityId: 'request-1',
    }), 'Admin')).toEqual({ name: routes.adminGroupReview, params: { kind: 'formation', requestId: 'request-1' } });

    expect(resolveNotificationRoute(notification({
      type: 'group_resolution_poll_closed',
      actionRoute: 'admin/group-review',
      relatedEntityType: 'group',
      relatedEntityId: 'group-1',
    }), 'Admin')).toEqual({ name: routes.adminGroupReview, params: { kind: 'frozen', groupId: 'group-1' } });

    expect(resolveNotificationRoute(notification({
      actionRoute: 'AdminGroups',
      relatedEntityType: 'group_requests',
      relatedEntityId: 'request-1',
    }), 'Admin')).toBeNull();
  });

  it('leaves unknown or incomplete metadata non-navigable', () => {
    expect(resolveNotificationRoute(notification({
      actionRoute: 'member/group',
      relatedEntityType: 'EqubGroup',
    }))).toBeNull();

    expect(resolveNotificationRoute(notification({
      actionRoute: 'SomeRawRoute',
      relatedEntityType: 'EqubGroup',
      relatedEntityId: 'group-1',
    }))).toBeNull();
  });
});
