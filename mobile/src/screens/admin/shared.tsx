import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { BottomNav } from '../../components/ui';
import { routes } from '../../navigation/routes';

const adminTabs = [
  { key: routes.adminDashboard, label: 'Overview', icon: 'dashboard' },
  { key: routes.adminKyc, label: 'KYC', icon: 'badge' },
  { key: routes.adminGroups, label: 'Groups', icon: 'groups' },
  { key: routes.adminReports, label: 'Reports', icon: 'summarize' },
];

export function AdminNav({ active }: { active: string }) {
  const navigation = useNavigation<any>();
  return <BottomNav items={adminTabs} activeKey={active} onPress={key => navigation.navigate(key)} />;
}
