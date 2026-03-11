import React from 'react';
import { Text } from 'react-native';
import { AppScreen, EmptyState, ListRow, PrimaryCTA, SecondaryCTA, SectionCard, TopAppBar, TitleBlock } from '../../components/ui';
import { useAdminActions, useAdminOverviewQuery, useReportsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { AdminNav } from './shared';
import { adminStyles } from './styles';

export function AdminReportsScreen() {
  const { data: overview } = useAdminOverviewQuery();
  const { data: reports = [] } = useReportsQuery();
  const { sendReminders, exportReport } = useAdminActions();

  return (
    <AppScreen footer={<AdminNav active={routes.adminReports} />} footerFlush>
      <TopAppBar title="Audit And Reports" subtitle="Exports" rightLabel="Ready" />
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
      <PrimaryCTA label="Send Reminder Batch" onPress={() => sendReminders.mutate()} loading={sendReminders.isPending} disabled={sendReminders.isPending} />
      <SecondaryCTA label="Export First Report" onPress={() => exportReport.mutate({ title: reports[0]?.title ?? 'report', format: reports[0]?.format ?? 'PDF' })} loading={exportReport.isPending} disabled={exportReport.isPending || !reports.length} />
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
