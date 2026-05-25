import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { EmptyState, ListRow, LoadingState, Pill, ScreenScroll, SectionCard, TopAppBar, TitleBlock } from '../../components/ui';
import { useDashboardQuery, useRefreshMemberData } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { formatCurrency } from './shared';
import type { GroupRecord } from '../../types/domain';
import { groupMembershipBuckets } from './uxState';

function GroupSection({
  title,
  subtitle,
  groups,
  emptyTitle,
  onOpen,
}: {
  title: string;
  subtitle: string;
  groups: GroupRecord[];
  emptyTitle?: string;
  onOpen: (group: GroupRecord) => void;
}) {
  if (!groups.length) {
    return emptyTitle ? <EmptyState icon="groups-2" title={emptyTitle} subtitle={subtitle} /> : null;
  }
  return (
    <SectionCard>
      <TitleBlock title={title} subtitle={subtitle} />
      {groups.map(group => (
        <ListRow
          key={group.Group_ID}
          title={group.Group_Name}
          subtitle={`${group.Frequency} - ${formatCurrency(group.Amount)} - ${group.Max_Members} members`}
          right={<Pill label={group.Status === 'Pending' ? 'Join window' : group.Status} tone={group.Status === 'Pending' ? 'warn' : group.Status === 'Completed' ? 'good' : group.Status === 'Frozen' ? 'bad' : 'active'} />}
          leadingIcon={group.Status === 'Completed' ? 'history' : group.Status === 'Pending' ? 'hourglass-empty' : 'groups'}
          onPress={() => onOpen(group)}
        />
      ))}
    </SectionCard>
  );
}

export function ActiveGroupsScreen() {
  const navigation = useNavigation<any>();
  const { data } = useDashboardQuery();
  const { refreshing, refreshMemberData } = useRefreshMemberData();

  if (!data) {
    return <LoadingState title="Loading active groups" subtitle="Pulling your current Equb memberships." />;
  }

  const activeGroups = data.activeGroups ?? (data.currentGroup ? [data.currentGroup] : []);
  const completedGroups = data.completedGroups ?? [];
  const buckets = groupMembershipBuckets(activeGroups, completedGroups);
  const openGroup = (group: GroupRecord) => navigation.navigate(group.Status === 'Pending' ? routes.groupDetail : routes.groupStatus, { groupId: group.Group_ID });

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={refreshMemberData}>
      <TopAppBar title="My Equb Groups" subtitle="Group Switcher" onBack={() => navigation.goBack()} rightLabel={`${activeGroups.length}`} />
      <TitleBlock title="Choose a group" subtitle="Join windows open previews. Active, voting, and frozen groups open the full cycle state." />
      {!activeGroups.length && !completedGroups.length ? (
        <EmptyState icon="groups-2" title="No Equb groups yet" subtitle="Approved groups you join or create will appear here." />
      ) : null}
      <GroupSection title="Active cycles" subtitle="Groups currently accepting contributions, draws, or votes." groups={buckets.cycleGroups} onOpen={openGroup} />
      <GroupSection title="Join windows" subtitle="Approved groups that have not started contributions yet." groups={buckets.joinWindowGroups} onOpen={openGroup} />
      <GroupSection title="Needs recovery" subtitle="Paused groups waiting for voting or admin resolution." groups={buckets.frozenGroups} onOpen={openGroup} />
      <GroupSection title="Other memberships" subtitle="Groups that are not currently in a standard active state." groups={buckets.otherGroups} onOpen={openGroup} />
      <GroupSection title="Past Equbs" subtitle="Groups you participated in before completion." groups={buckets.completedGroups} onOpen={openGroup} />
    </ScreenScroll>
  );
}
