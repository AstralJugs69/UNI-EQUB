import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { EmptyState, ListRow, LoadingState, Pill, ScreenScroll, SectionCard, TopAppBar, TitleBlock } from '../../components/ui';
import { useDashboardQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { formatCurrency } from './shared';

export function ActiveGroupsScreen() {
  const navigation = useNavigation<any>();
  const { data } = useDashboardQuery();

  if (!data) {
    return <LoadingState title="Loading active groups" subtitle="Pulling your current Equb memberships." />;
  }

  const activeGroups = data.activeGroups ?? (data.currentGroup ? [data.currentGroup] : []);

  return (
    <ScreenScroll>
      <TopAppBar title="My Active Groups" subtitle="Group Switcher" onBack={() => navigation.goBack()} rightLabel={`${activeGroups.length} active`} />
      <TitleBlock title="Open a group cycle" subtitle="Each active Equb keeps its own payment, winner, vote, and refund state." />
      {!activeGroups.length ? (
        <EmptyState icon="groups-2" title="No active groups" subtitle="Approved groups you join or create will appear here." />
      ) : activeGroups.map(group => (
        <SectionCard key={group.Group_ID}>
          <ListRow
            title={group.Group_Name}
            subtitle={`${group.Frequency} - ${formatCurrency(group.Amount)}`}
            right={<Pill label={group.Group_ID === data.currentGroup?.Group_ID ? 'Current' : group.Status} tone={group.Group_ID === data.currentGroup?.Group_ID ? 'active' : 'good'} />}
            leadingIcon="groups"
            onPress={() => navigation.navigate(routes.groupStatus, { groupId: group.Group_ID })}
          />
        </SectionCard>
      ))}
    </ScreenScroll>
  );
}
