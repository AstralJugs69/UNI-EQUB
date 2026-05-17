import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DemoModeBanner } from '../../components/DemoModeBanner';
import { AppScreen, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, SectionCard, StatusBanner, TitleBlock, TopAppBar } from '../../components/ui';
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
    <AppScreen footer={<AdminNav active={routes.adminDashboard} />} footerFlush>
      <DemoModeBanner />
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
        <TitleBlock title="Review queues" subtitle="Tap into the queues from the bottom tabs or quick actions." />
        <ListRow title="Student ID reviews" subtitle={`${data.pendingKycCount} waiting`} right={<Pill label={data.pendingKycCount > 0 ? 'Review' : 'Clear'} tone={data.pendingKycCount > 0 ? 'warn' : 'good'} />} leadingIcon="badge" onPress={() => navigation.navigate(routes.adminKyc)} />
        <ListRow title="Group approvals" subtitle={`${data.pendingGroupCount} legacy and Phase 2 requests`} right={<Pill label={data.pendingGroupCount > 0 ? 'Review' : 'Clear'} tone={data.pendingGroupCount > 0 ? 'warn' : 'good'} />} leadingIcon="pending-actions" onPress={() => navigation.navigate(routes.adminGroups)} />
      </SectionCard>
      <SectionCard>
        <View style={adminStyles.actionGroup}>
          <PrimaryCTA label="Review KYC" onPress={() => navigation.navigate(routes.adminKyc)} />
          <PrimaryCTA label="Approve Groups" onPress={() => navigation.navigate(routes.adminGroups)} />
          <PrimaryCTA label="Reports" onPress={() => navigation.navigate(routes.adminReports)} />
        </View>
      </SectionCard>
      <SectionCard>
        <TitleBlock title="Recent audit activity" subtitle="Demo mode seeds the same audit surface used by live reports." />
        {data.logs.map(log => (
          <ListRow key={log} title={log} leadingIcon="history" />
        ))}
      </SectionCard>
      {data.providerLogs?.length ? (
        <SectionCard variant="soft">
          <TitleBlock title="Provider activity" subtitle="Mock payment and reminder rails for the demo." />
          {data.providerLogs.slice(0, 3).map(log => (
            <ListRow key={`${log.provider}-${log.createdAt}-${log.message}`} title={log.message} subtitle={`${log.provider} • ${log.status}`} leadingIcon="sync" />
          ))}
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}
