import { NativeModules, Platform } from 'react-native';
import type { AppNotification } from '../../types/domain';

interface UniEqubLocalNotificationModule {
  show(id: string, title: string, body: string): Promise<boolean>;
}

const localNotificationModule = NativeModules.UniEqubLocalNotification as UniEqubLocalNotificationModule | undefined;

const supportedTypes = new Set([
  'announcement_created',
  'announcement_updated',
  'announcement_pinned',
  'group_activation_started',
  'group_activated',
  'group_cycle_completed',
  'group_cycle_ready_to_continue',
  'group_freeze_created',
  'group_freeze_resolved',
  'group_join_requested',
  'group_join_accepted',
  'group_join_rejected',
  'group_resolution_poll_opened',
  'group_resolution_poll_closed',
  'group_resolution_poll_expired',
  'kyc_approved',
  'kyc_banned',
  'kyc_resubmission_requested',
  'payment_contribution_due',
  'payment_contribution_failed',
  'payment_contribution_success',
  'payout_pending',
  'payout_success',
  'refund_ticket_created',
  'simulation_contribution_paid',
  'simulation_group_advanced',
  'simulation_member_removed',
  'GroupFormationApproved',
  'GroupFormationRejected',
  'GroupFormationSubmitted',
]);

const supportedPrefixes = [
  'announcement:',
  'contribution-due:',
  'contribution-success:',
  'email-unverified:',
  'group-active:',
  'group-completed:',
  'group-frozen:',
  'group-pending:',
  'kyc-pending:',
  'payout-pending:',
  'payout-success:',
  'refund-ticket:',
];

export function supportsSystemNotification(notification: AppNotification) {
  if (notification.source === 'Durable') {
    return true;
  }
  if (notification.type && supportedTypes.has(notification.type)) {
    return true;
  }
  return supportedPrefixes.some(prefix => notification.id.startsWith(prefix));
}

export async function showSystemNotification(notification: AppNotification) {
  if (Platform.OS !== 'android' || !localNotificationModule) {
    return false;
  }
  if (!supportsSystemNotification(notification)) {
    return false;
  }
  return localNotificationModule.show(notification.id, notification.title, notification.body);
}
