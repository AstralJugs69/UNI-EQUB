import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, ListRow, LoadingState, MetricTile, PrimaryCTA, SectionCard, StatusBanner, TopAppBar } from '../../components/ui';
import { useAdminOverviewQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { AdminNav } from './shared';
import { adminStyles } from './styles';

export function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { data } = useAdminOverviewQuery();

  if (!data) {
    return <LoadingState title="Loading admin workspace" subtitle="Pulling pending reviews, groups, and export state." />;
  }

  return (
    <AppScreen footer={<AdminNav active={routes.adminDashboard} />}>
      <TopAppBar title="Command Center" subtitle="Admin Workspace" rightLabel="Healthy" />
      <SectionCard>
        <View style={adminStyles.metricsGrid}>
          <MetricTile label="Pending KYC" value={String(data.pendingKycCount)} tone={data.pendingKycCount > 0 ? 'warn' : 'good'} />
          <MetricTile label="Group Requests" value={String(data.pendingGroupCount)} tone={data.pendingGroupCount > 0 ? 'warn' : 'good'} />
          <MetricTile label="Active Cycles" value={String(data.activeGroupCount)} />
          <MetricTile label="Exports" value={String(data.exportsCount)} />
        </View>
      </SectionCard>
      <StatusBanner tone="info" title="Automation is active." body="Winner selection, reminder derivation, and payout creation are all running through backend-controlled flows." />
      <SectionCard variant="soft">
        <ListRow title={`${data.pendingKycCount} student IDs need review`} leadingIcon="badge" />
        <ListRow title={`${data.pendingGroupCount} groups are waiting approval`} leadingIcon="pending-actions" />
      </SectionCard>
      <SectionCard>
        <View style={adminStyles.actionGroup}>
          <PrimaryCTA label="Review KYC" onPress={() => navigation.navigate(routes.adminKyc)} />
          <PrimaryCTA label="Approve Groups" onPress={() => navigation.navigate(routes.adminGroups)} />
          <PrimaryCTA label="Reports" onPress={() => navigation.navigate(routes.adminReports)} />
        </View>
      </SectionCard>
      <SectionCard>
        {data.logs.map(log => (
          <ListRow key={log} title={log} leadingIcon="history" />
        ))}
      </SectionCard>
    </AppScreen>
  );
}
