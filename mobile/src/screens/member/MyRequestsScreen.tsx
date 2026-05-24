import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { InlineError, MetricTile, ScreenScroll, SegmentedTabs, SectionCard, TopAppBar } from '../../components/ui';
import { useMyFormationGroupsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { palette } from '../../theme/tokens';
import { FormingRequestCard } from './FormingRequestCard';
import { memberStyles } from './styles';

type RequestFilter = 'All' | 'Forming' | 'PendingApproval' | 'Approved' | 'Rejected';

export function MyRequestsScreen() {
  const navigation = useNavigation<any>();
  const { data: myRequests = [], error } = useMyFormationGroupsQuery();
  const [filter, setFilter] = useState<RequestFilter>('All');
  const filteredRequests = useMemo(() => (
    filter === 'All' ? myRequests : myRequests.filter(request => request.status === filter)
  ), [filter, myRequests]);
  const counts = useMemo(() => ({
    forming: myRequests.filter(request => request.status === 'Forming').length,
    review: myRequests.filter(request => request.status === 'PendingApproval').length,
    approved: myRequests.filter(request => request.status === 'Approved').length,
  }), [myRequests]);

  return (
    <ScreenScroll>
      <TopAppBar title="My Requests" subtitle="Forming groups" onBack={() => navigation.goBack()} rightLabel={`${myRequests.length}`} />
      <InlineError message={error instanceof Error ? error.message : ''} />
      <SectionCard style={memberStyles.requestSummaryCard}>
        <Text style={memberStyles.sectionTitle}>Request workspace</Text>
        <Text style={memberStyles.mutedText}>Track the groups you created, manage participant requests, and open approved join windows from one place.</Text>
        <View style={memberStyles.metricsGrid}>
          <MetricTile label="Forming" value={String(counts.forming)} />
          <MetricTile label="In Review" value={String(counts.review)} tone={counts.review > 0 ? 'warn' : 'neutral'} />
          <MetricTile label="Approved" value={String(counts.approved)} tone={counts.approved > 0 ? 'good' : 'neutral'} />
        </View>
      </SectionCard>
      <SegmentedTabs
        options={[
          { key: 'All', label: 'All' },
          { key: 'Forming', label: 'Forming' },
          { key: 'PendingApproval', label: 'Review' },
          { key: 'Approved', label: 'Approved' },
        ]}
        selectedKey={filter}
        onSelect={key => setFilter(key as RequestFilter)}
      />
      {filteredRequests.length ? (
        <View style={memberStyles.exploreCardList}>
          {filteredRequests.map(request => (
            <FormingRequestCard
              key={request.id}
              request={request}
              onPress={() => {
                if (request.status === 'Approved' && request.approved_group_id && request.activated_at) {
                  navigation.navigate(routes.groupStatus, { groupId: request.approved_group_id });
                  return;
                }
                if (request.status === 'Approved' && request.approved_group_id) {
                  navigation.navigate(routes.groupDetail, { groupId: request.approved_group_id });
                  return;
                }
                navigation.navigate(routes.formationCreator, { requestId: request.id });
              }}
            />
          ))}
        </View>
      ) : (
        <View style={memberStyles.exploreEmptyCard}>
          <View style={memberStyles.exploreEmptyIcon}>
            <Icon name="playlist-add-check" size={32} color={palette.primary} />
          </View>
          <Text style={memberStyles.exploreEmptyTitle}>No forming requests</Text>
          <Text style={memberStyles.exploreEmptyBody}>Create a forming group to gather accepted members before it starts.</Text>
        </View>
      )}
    </ScreenScroll>
  );
}
