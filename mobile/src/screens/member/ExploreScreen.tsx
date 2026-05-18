import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, EmptyState, InlineError, MetricTile, Pill, PrimaryCTA, SecondaryCTA, SectionCard, TopAppBar } from '../../components/ui';
import { useFormationGroupsQuery, useGroupsQuery, useMyFormationGroupsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { MemberNav, formatCurrency } from './shared';
import { memberStyles } from './styles';

export function ExploreScreen() {
  const navigation = useNavigation<any>();
  const { data = [] } = useGroupsQuery();
  const { data: formingGroups = [], error: formingError } = useFormationGroupsQuery();
  const { data: myRequests = [], error: myRequestsError } = useMyFormationGroupsQuery();

  return (
    <AppScreen footer={<MemberNav active={routes.explore} />} footerFlush>
      <TopAppBar title="Explore" />
      <SectionCard variant="soft">
        <Text style={memberStyles.sectionTitle}>Form or join an Equb</Text>
        <Text style={memberStyles.mutedText}>Use an invite code, create a forming group, or browse approved groups.</Text>
        <View style={memberStyles.twoCol}>
          <SecondaryCTA label="Join With Code" onPress={() => navigation.navigate(routes.formationJoinCode)} />
          <SecondaryCTA label="Create Equb" onPress={() => navigation.navigate(routes.createBasics)} />
        </View>
      </SectionCard>
      <SectionCard>
        <View style={memberStyles.rowBetween}>
          <Text style={memberStyles.sectionTitle}>My requests</Text>
          <Text style={memberStyles.mutedText}>{myRequests.length} active</Text>
        </View>
        <InlineError message={myRequestsError instanceof Error ? myRequestsError.message : ''} />
        {!myRequests.length ? (
          <Text style={memberStyles.mutedText}>Create a forming group to gather accepted members before it starts.</Text>
        ) : myRequests.map(request => (
          <View key={request.id} style={memberStyles.itemBlock}>
            <View style={memberStyles.rowWrap}>
              <Pill label={request.status} tone={request.status === 'Approved' ? 'good' : request.status === 'PendingApproval' ? 'warn' : request.status === 'Rejected' ? 'bad' : 'active'} />
              <Pill label={request.visibility} tone="neutral" />
              <Pill label={request.frequency} tone="active" />
            </View>
            <Text style={memberStyles.sectionTitle}>{request.proposed_group_name}</Text>
            <Text style={memberStyles.mutedText}>{request.description ?? 'Your forming group request.'}</Text>
            <View style={memberStyles.metricsGrid}>
              <MetricTile label="Contribution" value={formatCurrency(request.contribution_amount)} />
              <MetricTile label="Accepted" value={`${request.accepted_participant_count}/${request.min_members}`} helper={`${request.remaining_slots} slots left`} tone={request.accepted_participant_count >= request.min_members ? 'good' : 'neutral'} />
            </View>
            <PrimaryCTA label={request.status === 'Forming' ? 'Manage Request' : 'View Request'} onPress={() => navigation.navigate(routes.formationCreator, { requestId: request.id })} />
          </View>
        ))}
      </SectionCard>
      <SectionCard>
        <View style={memberStyles.rowBetween}>
          <Text style={memberStyles.sectionTitle}>Forming groups</Text>
        </View>
        <InlineError message={formingError instanceof Error ? formingError.message : ''} />
        {formingGroups.map(request => (
          <View key={request.id} style={memberStyles.itemBlock}>
            <View style={memberStyles.rowWrap}>
              <Pill label={request.status} tone={request.status === 'Forming' ? 'good' : 'warn'} />
              <Pill label={request.frequency} tone="active" />
              <Pill label={request.visibility} tone="neutral" />
            </View>
            <Text style={memberStyles.sectionTitle}>{request.proposed_group_name}</Text>
            <Text style={memberStyles.mutedText}>{request.description ?? 'Public forming group request.'}</Text>
            <View style={memberStyles.metricsGrid}>
              <MetricTile label="Contribution" value={formatCurrency(request.contribution_amount)} />
              <MetricTile label="Accepted" value={`${request.accepted_participant_count}/${request.min_members}`} helper={`${request.remaining_slots} slots left`} />
            </View>
            <PrimaryCTA label="Review Request" onPress={() => navigation.navigate(routes.formationDetail, { requestId: request.id })} />
          </View>
        ))}
      </SectionCard>
      {!formingGroups.length ? (
        <EmptyState icon="group-add" title="No forming groups yet" subtitle="Public group requests will appear here while creators gather enough accepted members." />
      ) : null}
      <Text style={memberStyles.sectionTitle}>Approved groups</Text>
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
          <View style={memberStyles.metricsGrid}>
            <MetricTile label="Contribution" value={formatCurrency(group.Amount)} />
            <MetricTile label="Slots" value={`${group.Max_Members}`} helper="Maximum members" />
          </View>
          <PrimaryCTA label="View Group" onPress={() => navigation.navigate(routes.groupDetail, { groupId: group.Group_ID })} />
        </SectionCard>
      ))}
    </AppScreen>
  );
}
