import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AppScreen, EmptyState, ListRow, MetricTile, Pill, PrimaryCTA, SecondaryCTA, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useAdminActions, useAdminOverviewQuery, useReportsQuery } from '../../hooks/useAppQueries';
import { adminStyles } from './styles';

export function AdminReportsScreen({ route }: any) {
  const { data: overview } = useAdminOverviewQuery();
  const { data: reports = [] } = useReportsQuery();
  const { sendReminders, exportReport } = useAdminActions();
  const [success, setSuccess] = useState('');

  return (
    <AppScreen>
      <TopAppBar title="Audit And Reports" subtitle="Exports" rightLabel="Ready" />
      {route?.params?.flash ? <StatusBanner tone="success" title={route.params.flash} /> : null}
      {success ? <StatusBanner tone="success" title={success} /> : null}
      {overview ? (
        <SectionCard>
          <TitleBlock title="Operations snapshot" subtitle="Current admin-facing state from the same reporting service." />
          <MetricTile label="KYC" value={String(overview.pendingKycCount)} tone={overview.pendingKycCount > 0 ? 'warn' : 'good'} />
          <MetricTile label="Groups" value={String(overview.pendingGroupCount)} tone={overview.pendingGroupCount > 0 ? 'warn' : 'good'} />
          <MetricTile label="Active" value={String(overview.activeGroupCount)} />
        </SectionCard>
      ) : null}
      {overview?.reliabilitySummary ? (
        <SectionCard variant="soft">
          <TitleBlock title="Reliability labels" subtitle="Public user labels only; internal counters are not exposed here." />
          <View style={adminStyles.rowWrap}>
            {(['New', 'BuildingTrust', 'Trusted', 'Restricted', 'Banned'] as const).map(status => (
              <Pill
                key={status}
                label={`${status}: ${overview.reliabilitySummary?.[status] ?? 0}`}
                tone={status === 'Trusted' ? 'good' : status === 'Restricted' || status === 'Banned' ? 'bad' : status === 'BuildingTrust' ? 'active' : 'neutral'}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}
      <SectionCard>
        <TitleBlock title="Report packages" subtitle="Export the current backend summaries in PDF or CSV." />
        {reports.length ? reports.map(report => (
          <ListRow key={report.title} title={report.title} subtitle={report.description} right={<Text>{report.format}</Text>} leadingIcon="summarize" />
        )) : <EmptyState icon="summarize" title="No reports configured" subtitle="This surface will populate when report definitions are available." />}
      </SectionCard>
      <SectionCard variant="soft">
        <TitleBlock title="Reminder queue" subtitle="Entries are derived from active groups and unpaid members in open rounds." />
        {overview?.reminderQueue.length ? overview.reminderQueue.map(entry => <ListRow key={entry} title={entry} leadingIcon="notifications-active" />) : <EmptyState icon="notifications-none" title="Queue is clear" subtitle="No unpaid reminder candidates were found at the moment." />}
      </SectionCard>
      {overview?.providerLogs?.length ? (
        <SectionCard variant="soft">
          <TitleBlock title="Provider activity" subtitle="Sandbox payment and reminder events." />
          {overview.providerLogs.map(log => (
            <ListRow
              key={`${log.provider}-${log.createdAt}-${log.message}`}
              title={log.message}
              subtitle={`${log.provider} - ${log.createdAt}`}
              right={<Pill label={log.status} tone={log.status === 'Successful' ? 'good' : log.status === 'Failed' ? 'bad' : 'warn'} />}
              leadingIcon="sync"
            />
          ))}
        </SectionCard>
      ) : null}
      {overview?.auditTimeline?.length ? (
        <SectionCard>
          <TitleBlock title="Audit timeline" subtitle="Read-only recent sensitive events." />
          {overview.auditTimeline.map(event => (
            <ListRow
              key={event.id}
              title={event.summary}
              subtitle={`${event.actorName ?? event.actorRole} - ${event.createdAt}`}
              right={<Pill label={event.actorRole} tone={event.actorRole === 'Admin' ? 'active' : 'neutral'} />}
              leadingIcon="history"
            />
          ))}
        </SectionCard>
      ) : overview?.logs.length ? (
        <SectionCard>
          <TitleBlock title="Audit timeline" subtitle="Recent decisions and automated events." />
          {overview.logs.map(log => <ListRow key={log} title={log} leadingIcon="history" />)}
        </SectionCard>
      ) : null}
      <PrimaryCTA
        label="Send Reminder Batch"
        onPress={() => {
          setSuccess('');
          sendReminders.mutate(undefined, { onSuccess: () => setSuccess('Reminder batch sent.') });
        }}
        loading={sendReminders.isPending}
        disabled={sendReminders.isPending}
      />
      <SecondaryCTA
        label="Export First Report"
        onPress={() => {
          setSuccess('');
          exportReport.mutate({ title: reports[0]?.title ?? 'report', format: reports[0]?.format ?? 'PDF' }, { onSuccess: () => setSuccess('Report export ready.') });
        }}
        loading={exportReport.isPending}
        disabled={exportReport.isPending || !reports.length}
      />
      {exportReport.data ? (
        <SectionCard>
          <TitleBlock title="Latest export" subtitle={exportReport.data.fileName} />
          <Text style={adminStyles.mutedText}>{exportReport.data.mimeType ?? 'text/plain'}</Text>
          <Text>{exportReport.data.content}</Text>
          {exportReport.data.contentBase64 ? <Text style={adminStyles.sectionTitle}>Binary PDF payload is ready.</Text> : null}
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}
