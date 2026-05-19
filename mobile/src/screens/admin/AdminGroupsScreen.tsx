import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, EmptyState, ListRow, Pill, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { usePendingFormationGroupsQuery, usePendingGroupsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { formatCurrency } from '../member/shared';

export function AdminGroupsScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data: legacyData = [] } = usePendingGroupsQuery();
  const { data: formationQueue = [] } = usePendingFormationGroupsQuery();
  const frozenItems = legacyData.filter(item => item.group.Status === 'Frozen');
  const legacyItems = legacyData.filter(item => item.group.Status !== 'Frozen');
  const total = formationQueue.length + frozenItems.length + legacyItems.length;

  return (
    <AppScreen>
      <TopAppBar title="Group Queues" subtitle="Admin Hub" rightLabel={`${total} pending`} />
      {route?.params?.flash ? <StatusBanner tone="success" title={route.params.flash} /> : null}
      <TitleBlock title="Select a queue item" subtitle="Formation, frozen recovery, and legacy MVP requests each open into a full review page." />

      {formationQueue.length ? (
        <SectionCard>
          <TitleBlock title="Formation requests" subtitle="Creator-led groups ready for admin approval." />
          <ViewList>
            {formationQueue.map(request => (
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

      {!total ? (
        <EmptyState icon="playlist-add-check" title="No pending group requests" subtitle="Submitted formations, frozen recoveries, and legacy MVP requests will appear here for review." />
      ) : null}
    </AppScreen>
  );
}

function ViewList({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
