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
  const completedGroups = data.completedGroups ?? [];

  return (
    <ScreenScroll>
      <TopAppBar title="My Equb Groups" subtitle="Group Switcher" onBack={() => navigation.goBack()} rightLabel={`${activeGroups.length} active`} />
      <TitleBlock title="Open a group cycle" subtitle="Active groups keep payment and draw controls here. Completed groups stay visible for history." />
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
      {completedGroups.length ? (
        <SectionCard>
          <TitleBlock title="Past Equbs" subtitle="Groups you participated in before completion." />
          {completedGroups.map(group => (
            <ListRow
              key={group.Group_ID}
              title={group.Group_Name}
              subtitle={`${group.Frequency} - ${formatCurrency(group.Amount)}`}
              right={<Pill label="Completed" tone="good" />}
              leadingIcon="history"
            />
          ))}
        </SectionCard>
      ) : null}
    </ScreenScroll>
  );
}
