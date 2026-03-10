import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, EmptyState, MetricTile, Pill, PrimaryCTA, SectionCard, TopAppBar } from '../../components/ui';
import { useGroupsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { MemberNav, formatCurrency } from './shared';
import { memberStyles } from './styles';

export function ExploreScreen() {
  const navigation = useNavigation<any>();
  const { data = [] } = useGroupsQuery();

  return (
    <AppScreen footer={<MemberNav active={routes.explore} />}>
      <TopAppBar title="Available Equbs" subtitle="Explore" />
      <SectionCard variant="soft">
        <Text style={memberStyles.mutedText}>Browse approved groups by cadence, contribution amount, and open slots.</Text>
      </SectionCard>
      {!data.length ? (
        <EmptyState icon="travel-explore" title="No open groups right now" subtitle="When admins approve new Equbs, they will appear here for members to review and join." />
      ) : data.map(group => (
        <SectionCard key={group.Group_ID}>
          <View style={memberStyles.rowWrap}>
            <Pill label={group.Status === 'Completed' ? 'Closed' : 'Open'} tone={group.Status === 'Completed' ? 'bad' : 'good'} />
            <Pill label={group.Frequency} tone="active" />
          </View>
          <Text style={memberStyles.sectionTitle}>{group.Group_Name}</Text>
          <Text style={memberStyles.mutedText}>{group.Description}</Text>
          <View style={memberStyles.twoCol}>
            <MetricTile label="Contribution" value={formatCurrency(group.Amount)} />
            <MetricTile label="Slots" value={`${group.Max_Members}`} helper="Maximum members" />
          </View>
          <PrimaryCTA label="View Group" onPress={() => navigation.navigate(routes.groupDetail, { groupId: group.Group_ID })} />
        </SectionCard>
      ))}
    </AppScreen>
  );
}
