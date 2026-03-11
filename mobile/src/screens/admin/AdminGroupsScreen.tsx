import React, { useState } from 'react';
import { AppScreen, EmptyState, InlineError, ListRow, PrimaryCTA, SecondaryCTA, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useAdminActions, usePendingGroupsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { AdminNav } from './shared';

export function AdminGroupsScreen() {
  const { data } = usePendingGroupsQuery();
  const { approveGroup, rejectGroup, freezeGroup } = useAdminActions();
  const [adminNote, setAdminNote] = useState('');
  const item = data?.[0];

  return (
    <AppScreen footer={<AdminNav active={routes.adminGroups} />} footerFlush>
      <TopAppBar title="Group Review" subtitle="Admin Queue" rightLabel={`${data?.length ?? 0} pending`} />
      {item ? (
        <>
          <SectionCard>
            <TitleBlock title={item.group.Group_Name} subtitle={`Requested by ${item.creator.Full_Name}`} />
            <ListRow title="Contribution" subtitle={`${item.group.Amount} ETB`} leadingIcon="payments" />
            <ListRow title="Members" subtitle={String(item.group.Max_Members)} leadingIcon="groups" />
            <ListRow title="Frequency" subtitle={item.group.Frequency} leadingIcon="repeat" />
            <ListRow title="Summary" subtitle={item.group.Description} leadingIcon="notes" />
          </SectionCard>
          <SectionCard variant="soft">
            <TitleBlock title="Compliance review" subtitle="These checks keep the request review structured even though the MVP has no dedicated dispute table." />
            <ListRow title="Predatory contribution ratio" subtitle="No issue" leadingIcon="balance" />
            <ListRow title="Creator active groups" subtitle="At limit" leadingIcon="rule" />
            <ListRow title="Duplicate group name" subtitle="Clear" leadingIcon="fact-check" />
          </SectionCard>
          <StatusBanner tone="warning" title="Reject keeps the request pending." body="The fixed schema does not persist a separate rejected status, so returned requests remain hidden and unpublished until an admin resolves them." />
          <PrimaryCTA label="Approve Group" onPress={() => approveGroup.mutate(item.group.Group_ID)} loading={approveGroup.isPending} disabled={approveGroup.isPending || rejectGroup.isPending || freezeGroup.isPending} />
          <SecondaryCTA
            label="Return To Pending Review"
            onPress={() => rejectGroup.mutate(item.group.Group_ID, { onSuccess: () => setAdminNote('Request returned to pending review. It remains hidden from members until approval.') })}
            loading={rejectGroup.isPending}
            disabled={approveGroup.isPending || rejectGroup.isPending || freezeGroup.isPending}
          />
          <SecondaryCTA label="Freeze This Group" onPress={() => freezeGroup.mutate(item.group.Group_ID)} loading={freezeGroup.isPending} disabled={approveGroup.isPending || rejectGroup.isPending || freezeGroup.isPending} />
          <InlineError message={adminNote} />
        </>
      ) : (
        <EmptyState icon="playlist-add-check" title="No pending group requests" subtitle="All submitted groups have already been handled." />
      )}
    </AppScreen>
  );
}
