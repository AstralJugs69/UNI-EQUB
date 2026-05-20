import { PermissionsAndroid, Platform } from 'react-native';

export async function requestNotificationPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  const current = await PermissionsAndroid.check(permission);
  if (current) {
    return true;
  }

  const result = await PermissionsAndroid.request(permission, {
    title: 'Allow UniEqub notifications?',
    message: 'UniEqub uses notifications for KYC decisions, contribution reminders, group updates, and payout events.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not Now',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}
