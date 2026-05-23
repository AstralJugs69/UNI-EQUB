import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { BottomNav } from '../../components/ui';
import { routes } from '../../navigation/routes';

export const adminTabs = [
  { key: routes.adminDashboard, label: 'Overview', labelKey: 'tab.overview', icon: 'dashboard' },
  { key: routes.adminKyc, label: 'KYC', icon: 'badge' },
  { key: routes.adminGroups, label: 'Groups', labelKey: 'tab.groups', icon: 'groups' },
  { key: routes.adminReports, label: 'Reports', labelKey: 'tab.reports', icon: 'summarize' },
  { key: routes.adminProfile, label: 'Profile', labelKey: 'tab.profile', icon: 'person' },
];

export function AdminNav({ active }: { active: string }) {
  const navigation = useNavigation<any>();
  return <BottomNav items={adminTabs} activeKey={active} onPress={key => navigation.navigate(key)} />;
}
