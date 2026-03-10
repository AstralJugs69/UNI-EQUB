import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { BottomNav } from '../../components/ui';
import { routes } from '../../navigation/routes';
import type { PaymentMethod } from '../../types/domain';

const groupStudents = require('../../assets/students-group.jpg');

export const memberTabs = [
  { key: routes.dashboard, label: 'Home', icon: 'home-filled' },
  { key: routes.explore, label: 'Explore', icon: 'travel-explore' },
  { key: routes.history, label: 'History', icon: 'receipt-long' },
  { key: routes.wallet, label: 'Wallet', icon: 'account-balance-wallet' },
  { key: routes.profile, label: 'Profile', icon: 'person' },
];

export function MemberNav({ active }: { active: string }) {
  const navigation = useNavigation<any>();
  return <BottomNav items={memberTabs} activeKey={active} onPress={key => navigation.navigate(key)} />;
}

export function paymentMethodLabel(method: PaymentMethod) {
  return method === 'MockUSSD' ? 'Telebirr USSD' : method;
}

export function formatCurrency(value: number) {
  return `${value.toLocaleString()} ETB`;
}

export { groupStudents };
