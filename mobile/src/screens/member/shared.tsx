import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { BottomNav } from '../../components/ui';
import { routes } from '../../navigation/routes';
import type { PaymentMethod } from '../../types/domain';

const groupStudents = require('../../assets/students-group.jpg');

export const memberTabs = [
  { key: routes.dashboard, label: 'Home', labelKey: 'tab.home', icon: 'home-filled' },
  { key: routes.explore, label: 'Explore', labelKey: 'tab.explore', icon: 'travel-explore' },
  { key: routes.history, label: 'History', labelKey: 'tab.history', icon: 'receipt-long' },
  { key: routes.wallet, label: 'Wallet', labelKey: 'tab.wallet', icon: 'account-balance-wallet' },
  { key: routes.notifications, label: 'Alerts', labelKey: 'tab.alerts', icon: 'notifications' },
  { key: routes.profile, label: 'Profile', labelKey: 'tab.profile', icon: 'person' },
];

export function MemberNav({ active }: { active: string }) {
  const navigation = useNavigation<any>();
  return <BottomNav items={memberTabs} activeKey={active} onPress={key => navigation.navigate(key)} />;
}

export function paymentMethodLabel(method: PaymentMethod) {
  if (method === 'Telebirr') {
    return 'Telebirr';
  }
  if (method === 'MockUSSD') {
    return 'Telebirr USSD';
  }
  return 'Chapa Sandbox';
}

export function formatCurrency(value: number) {
  return `${value.toLocaleString()} ETB`;
}

export function formatTimeLeft(deadline?: string | null) {
  if (!deadline) {
    return 'Not scheduled';
  }

  const remainingMs = new Date(deadline).getTime() - Date.now();
  if (!Number.isFinite(remainingMs)) {
    return 'Not scheduled';
  }
  if (remainingMs <= 0) {
    return 'Due now';
  }

  const totalHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days <= 0) {
    return `${hours}h left`;
  }
  if (hours === 0) {
    return `${days}d left`;
  }
  return `${days}d ${hours}h left`;
}

export { groupStudents };
