import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, SectionCard, StatusBanner, TitleBlock, TopAppBar } from '../../components/ui';
import { useAdminOverviewQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { adminStyles } from './styles';

export function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { data } = useAdminOverviewQuery();

  if (!data) {
    return <LoadingState title="Loading admin workspace" subtitle="Pulling pending reviews, groups, and export state." />;
  }
  const needsAttention = data.pendingKycCount + data.pendingGroupCount + (data.reminderQueue?.length ?? 0);
  const primaryQueue = data.pendingKycCount > 0
    ? { title: 'KYC reviews need attention', body: `${data.pendingKycCount} student submission${data.pendingKycCount === 1 ? '' : 's'} waiting for review.`, label: 'Review KYC', route: routes.adminKyc, icon: 'badge' }
    : data.pendingGroupCount > 0
      ? { title: 'Group queue needs attention', body: `${data.pendingGroupCount} formation, frozen, or legacy item${data.pendingGroupCount === 1 ? '' : 's'} waiting.`, label: 'Open Groups', route: routes.adminGroups, icon: 'groups' }
      : data.reminderQueue?.length
        ? { title: 'Reminder queue is ready', body: `${data.reminderQueue.length} reminder candidate${data.reminderQueue.length === 1 ? '' : 's'} can be reviewed in reports.`, label: 'Open Reports', route: routes.adminReports, icon: 'notifications-active' }
        : { title: 'No urgent admin work', body: 'KYC, group review, and reminder queues are currently clear.', label: 'Open Reports', route: routes.adminReports, icon: 'task-alt' };

  return (
    <AppScreen>
      <TopAppBar title="Command Center" subtitle="Admin Workspace" rightLabel={needsAttention ? `${needsAttention} open` : 'Clear'} />
      <SectionCard style={adminStyles.adminAttentionCard}>
        <View style={adminStyles.adminAttentionIcon}>
          <Text style={adminStyles.adminAttentionIconText}>{needsAttention || 'OK'}</Text>
        </View>
        <View style={adminStyles.adminAttentionText}>
          <Text style={adminStyles.adminAttentionTitle}>{primaryQueue.title}</Text>
          <Text style={adminStyles.adminAttentionBody}>{primaryQueue.body}</Text>
        </View>
        <PrimaryCTA label={primaryQueue.label} onPress={() => navigation.navigate(primaryQueue.route)} icon={primaryQueue.icon} />
      </SectionCard>
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
      {data.reliabilitySummary ? (
        <SectionCard variant="soft">
          <TitleBlock title="Reliability overview" subtitle="Public labels across current users." />
          <View style={adminStyles.rowWrap}>
            {(['New', 'BuildingTrust', 'Trusted', 'Restricted', 'Banned'] as const).map(status => (
              <Pill
                key={status}
                label={`${status}: ${data.reliabilitySummary?.[status] ?? 0}`}
                tone={status === 'Trusted' ? 'good' : status === 'Restricted' || status === 'Banned' ? 'bad' : status === 'BuildingTrust' ? 'active' : 'neutral'}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}
      <SectionCard>
        <TitleBlock title="Recent audit activity" subtitle="Read-only event trail from reports." />
        {data.auditTimeline?.length ? data.auditTimeline.slice(0, 4).map(event => (
          <ListRow
            key={event.id}
            title={event.summary}
            subtitle={`${event.actorName ?? event.actorRole} - ${event.createdAt}`}
            leadingIcon="history"
          />
        )) : data.logs.map(log => (
          <ListRow key={log} title={log} leadingIcon="history" />
        ))}
      </SectionCard>
      {data.providerLogs?.length ? (
        <SectionCard variant="soft">
          <TitleBlock title="Provider activity" subtitle="Mock payment and reminder rails for the demo." />
          {data.providerLogs.slice(0, 3).map(log => (
            <ListRow key={`${log.provider}-${log.createdAt}-${log.message}`} title={log.message} subtitle={`${log.provider} - ${log.status}`} leadingIcon="sync" />
          ))}
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}
