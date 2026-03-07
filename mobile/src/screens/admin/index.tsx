import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomNav, InfoRow, KeyValue, Panel, Pill, PrimaryButton, ScreenScroll, TitleBlock, TopBar, uiStyles } from '../../components/ui';
import { useAdminActions, useAdminOverviewQuery, usePendingGroupsQuery, usePendingKycQuery, useReportsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { palette } from '../../theme/tokens';

const adminTabs = [
  { key: routes.adminDashboard, label: 'Overview' },
  { key: routes.adminKyc, label: 'KYC' },
  { key: routes.adminGroups, label: 'Groups' },
  { key: routes.adminReports, label: 'Reports' },
];

function AdminNav({ active }: { active: string }) {
  const navigation = useNavigation<any>();
  return <BottomNav items={adminTabs} activeKey={active} onPress={key => navigation.navigate(key)} />;
}

export function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { data } = useAdminOverviewQuery();
  if (!data) {
    return <ScreenScroll><TitleBlock title="Loading admin workspace" subtitle="Pulling pending reviews, groups, and export state." /></ScreenScroll>;
  }
  return (
    <ScreenScroll>
      <TopBar title="Command Center" subtitle="Admin Workspace" rightLabel="Healthy" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <KeyValue label="Pending KYC" value={String(data.pendingKycCount)} />
        <KeyValue label="Group Requests" value={String(data.pendingGroupCount)} />
        <KeyValue label="Active Cycles" value={String(data.activeGroupCount)} />
        <KeyValue label="Exports" value={String(data.exportsCount)} />
      </View>
      <View style={uiStyles.twoCol}>
        <Panel style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>Urgent queue</Text>
          <View style={{ marginTop: 10, gap: 10 }}>
            <InfoRow title={`${data.pendingKycCount} student IDs need review`} />
            <InfoRow title={`${data.pendingGroupCount} groups waiting approval`} />
          </View>
        </Panel>
        <Panel style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>Automation status</Text>
            <Pill label="healthy" tone="good" />
          </View>
          <View style={{ marginTop: 10, gap: 10 }}>
            <InfoRow title="Winner selection • automatic on full payment" />
            <InfoRow title="Reminder scheduler • queued and active" />
            <InfoRow title="Compliance logs • append-only" />
          </View>
        </Panel>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <PrimaryButton label="Review KYC" variant="secondary" onPress={() => navigation.navigate(routes.adminKyc)} />
        <PrimaryButton label="Approve Groups" variant="secondary" onPress={() => navigation.navigate(routes.adminGroups)} />
        <PrimaryButton label="Reports" variant="secondary" onPress={() => navigation.navigate(routes.adminReports)} />
      </View>
      <Panel>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>Recent admin actions</Text>
        <View style={{ marginTop: 10, gap: 10 }}>
          {data.logs.map(log => (
            <InfoRow key={log} title={log} />
          ))}
        </View>
      </Panel>
      <AdminNav active={routes.adminDashboard} />
    </ScreenScroll>
  );
}

export function AdminKycScreen() {
  const { data } = usePendingKycQuery();
  const { approveKyc, banUser } = useAdminActions();
  const item = data?.[0];
  return (
    <ScreenScroll>
      <TopBar title="KYC Review" subtitle="Admin Queue" rightLabel={`${data?.length ?? 0} pending`} />
      {item ? (
        <>
          <Panel>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>Applicant</Text>
            <View style={{ marginTop: 10, gap: 10 }}>
              <InfoRow title={item.user.Full_Name} subtitle={`${item.user.Phone_Number} • ${item.user.KYC_Status}`} />
              <InfoRow title={item.note} />
            </View>
          </Panel>
          <View style={uiStyles.twoCol}>
            <PrimaryButton label="Approve KYC" onPress={() => approveKyc.mutate(item.user.User_ID)} />
            <PrimaryButton label="Ban Account" variant="danger" onPress={() => banUser.mutate(item.user.User_ID)} />
          </View>
        </>
      ) : (
        <Panel><Text style={{ color: palette.success, fontWeight: '800' }}>No pending KYC requests. The queue is clear.</Text></Panel>
      )}
      <AdminNav active={routes.adminKyc} />
    </ScreenScroll>
  );
}

export function AdminGroupsScreen() {
  const { data } = usePendingGroupsQuery();
  const { approveGroup, rejectGroup, freezeGroup } = useAdminActions();
  const item = data?.[0];
  return (
    <ScreenScroll>
      <TopBar title="Group Review" subtitle="Admin Queue" rightLabel={`${data?.length ?? 0} pending`} />
      {item ? (
        <>
          <Panel>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>{item.group.Group_Name}</Text>
            <Text style={{ color: palette.muted, marginTop: 4 }}>Requested by {item.creator.Full_Name}</Text>
            <View style={[uiStyles.twoCol, { marginTop: 12 }]}>
              <KeyValue label="Contribution" value={`${item.group.Amount} ETB`} />
              <KeyValue label="Members" value={String(item.group.Max_Members)} />
            </View>
            <Text style={{ color: palette.muted, marginTop: 12 }}>{item.group.Description}</Text>
          </Panel>
          <Panel>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>Compliance flags</Text>
            <View style={{ marginTop: 10, gap: 10 }}>
              <InfoRow title="Predatory contribution ratio • No issue" />
              <InfoRow title="Creator active groups • At limit" />
              <InfoRow title="Duplicate group name • Clear" />
            </View>
          </Panel>
          <View style={uiStyles.twoCol}>
            <PrimaryButton label="Approve Group" onPress={() => approveGroup.mutate(item.group.Group_ID)} />
            <PrimaryButton label="Reject With Reason" variant="secondary" onPress={() => rejectGroup.mutate(item.group.Group_ID)} />
          </View>
          <PrimaryButton label="Freeze Dorm A Savings Group" variant="danger" onPress={() => freezeGroup.mutate('group-dorm')} />
        </>
      ) : (
        <Panel><Text style={{ color: palette.success, fontWeight: '800' }}>No pending group requests. All submissions are handled.</Text></Panel>
      )}
      <AdminNav active={routes.adminGroups} />
    </ScreenScroll>
  );
}

export function AdminReportsScreen() {
  const { data: overview } = useAdminOverviewQuery();
  const { data: reports } = useReportsQuery();
  const { sendReminders, exportReport } = useAdminActions();
  return (
    <ScreenScroll>
      <TopBar title="Audit And Reports" subtitle="Exports" rightLabel="Ready" />
      <Panel>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>Report packages</Text>
        <View style={{ marginTop: 10, gap: 10 }}>
          {reports?.map(report => (
            <InfoRow key={report.title} title={report.title} subtitle={report.description} right={report.format} />
          ))}
        </View>
      </Panel>
      <Panel>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>Reminder queue</Text>
        <View style={{ marginTop: 10, gap: 10 }}>
          {overview?.reminderQueue.map(entry => (
            <InfoRow key={entry} title={entry} />
          ))}
        </View>
      </Panel>
      <View style={uiStyles.twoCol}>
        <PrimaryButton label="Send Reminder Batch" onPress={() => sendReminders.mutate()} />
        <PrimaryButton label="Export First Report" variant="secondary" onPress={() => exportReport.mutate({ title: reports?.[0]?.title ?? 'report', format: reports?.[0]?.format ?? 'PDF' })} />
      </View>
      {exportReport.data ? (
        <Panel>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>Latest export</Text>
          <Text style={{ color: palette.muted, marginTop: 6 }}>{exportReport.data.fileName}</Text>
          <Text style={{ color: palette.text, marginTop: 10 }}>{exportReport.data.content}</Text>
        </Panel>
      ) : null}
      <AdminNav active={routes.adminReports} />
    </ScreenScroll>
  );
}
