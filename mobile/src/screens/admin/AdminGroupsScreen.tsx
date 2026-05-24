import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, EmptyState, ListRow, MetricTile, Pill, SectionCard, SegmentedTabs, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { usePendingFormationGroupsQuery, usePendingGroupsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { formatCurrency } from '../member/shared';
import { adminStyles } from './styles';

export function AdminGroupsScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data: legacyData = [] } = usePendingGroupsQuery();
  const { data: formationQueue = [] } = usePendingFormationGroupsQuery();
  const [queue, setQueue] = useState<'All' | 'Formation' | 'Frozen' | 'Legacy'>('All');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (value: string) => !normalizedQuery || value.toLowerCase().includes(normalizedQuery);
  const filteredFormationQueue = useMemo(() => formationQueue.filter(request => (
    (queue === 'All' || queue === 'Formation')
    && matches(`${request.proposed_group_name} ${request.creator_id} ${request.frequency} ${request.status}`)
  )), [formationQueue, normalizedQuery, queue]);
  const frozenItems = useMemo(() => legacyData.filter(item => (
    item.group.Status === 'Frozen'
    && (queue === 'All' || queue === 'Frozen')
    && matches(`${item.group.Group_Name} ${item.creator.Full_Name} ${item.group.Frequency}`)
  )), [legacyData, normalizedQuery, queue]);
  const legacyItems = useMemo(() => legacyData.filter(item => (
    item.group.Status !== 'Frozen'
    && (queue === 'All' || queue === 'Legacy')
    && matches(`${item.group.Group_Name} ${item.creator.Full_Name} ${item.group.Frequency} ${item.group.Status}`)
  )), [legacyData, normalizedQuery, queue]);
  const rawFrozenCount = legacyData.filter(item => item.group.Status === 'Frozen').length;
  const rawLegacyCount = legacyData.filter(item => item.group.Status !== 'Frozen').length;
  const total = formationQueue.length + rawFrozenCount + rawLegacyCount;
  const visibleTotal = filteredFormationQueue.length + frozenItems.length + legacyItems.length;

  return (
    <AppScreen>
      <TopAppBar title="Group Queues" subtitle="Admin Hub" rightLabel={`${total} pending`} />
      {route?.params?.flash ? <StatusBanner tone="success" title={route.params.flash} /> : null}
      <SectionCard>
        <TitleBlock title="Triage group work" subtitle="Frozen and no-consensus cases should be handled before routine formation approvals." />
        <View style={adminStyles.metricsGrid}>
          <MetricTile label="Formation" value={String(formationQueue.length)} tone={formationQueue.length > 0 ? 'warn' : 'good'} />
          <MetricTile label="Frozen" value={String(rawFrozenCount)} tone={rawFrozenCount > 0 ? 'warn' : 'good'} />
          <MetricTile label="Legacy" value={String(rawLegacyCount)} />
        </View>
      </SectionCard>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by group, creator, or status..."
        placeholderTextColor="#8793A3"
        style={adminStyles.adminSearchInput}
      />
      <SegmentedTabs
        options={[
          { key: 'All', label: 'All' },
          { key: 'Frozen', label: 'Frozen' },
          { key: 'Formation', label: 'Formation' },
          { key: 'Legacy', label: 'Legacy' },
        ]}
        selectedKey={queue}
        onSelect={key => setQueue(key as 'All' | 'Formation' | 'Frozen' | 'Legacy')}
      />

      {filteredFormationQueue.length ? (
        <SectionCard>
          <TitleBlock title="Formation requests" subtitle="Creator-led groups ready for admin approval." />
          <ViewList>
            {filteredFormationQueue.map(request => (
              <ListRow
                key={request.id}
                title={request.proposed_group_name}
                subtitle={`${request.frequency} - ${formatCurrency(request.contribution_amount)} - ${request.accepted_participant_count}/${request.min_members} accepted`}
                right={<Pill label={request.risk_level} tone={request.risk_level === 'Low' ? 'good' : 'warn'} />}
                leadingIcon="playlist-add-check"
                onPress={() => navigation.navigate(routes.adminGroupReview, { kind: 'formation', requestId: request.id })}
              />
            ))}
          </ViewList>
        </SectionCard>
      ) : null}

      {frozenItems.length ? (
        <SectionCard variant="soft">
          <TitleBlock title="Frozen recovery" subtitle="Groups paused for admin resolution or member vote." />
          <ViewList>
            {frozenItems.map(item => (
              <ListRow
                key={item.group.Group_ID}
                title={item.group.Group_Name}
                subtitle={`${item.creator.Full_Name} - ${formatCurrency(item.group.Amount)}`}
                right={<Pill label="Frozen" tone="warn" />}
                leadingIcon="ac-unit"
                onPress={() => navigation.navigate(routes.adminGroupReview, { kind: 'frozen', groupId: item.group.Group_ID })}
              />
            ))}
          </ViewList>
        </SectionCard>
      ) : null}

      {legacyItems.length ? (
        <SectionCard variant="soft">
          <TitleBlock title="Legacy MVP requests" subtitle="Pending fixed-schema groups preserved during migration." />
          <ViewList>
            {legacyItems.map(item => (
              <ListRow
                key={item.group.Group_ID}
                title={item.group.Group_Name}
                subtitle={`${item.group.Frequency} - ${formatCurrency(item.group.Amount)} - ${item.creator.Full_Name}`}
                right={<Pill label={item.group.Status} tone="warn" />}
                leadingIcon="pending-actions"
                onPress={() => navigation.navigate(routes.adminGroupReview, { kind: 'legacy', groupId: item.group.Group_ID })}
              />
            ))}
          </ViewList>
        </SectionCard>
      ) : null}

      {!visibleTotal ? (
        <EmptyState icon="playlist-add-check" title="No pending group requests" subtitle="Submitted formations, frozen recoveries, and legacy MVP requests will appear here for review." />
      ) : null}
    </AppScreen>
  );
}

function ViewList({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
