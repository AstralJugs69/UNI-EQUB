import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AppScreen, EmptyState, InlineError, ListRow, MetricTile, Pill, PrimaryCTA, SecondaryCTA, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useAdminActions, useFormationGroupQuery, useGroupStatusQuery, usePendingFormationGroupsQuery, usePendingGroupsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { formatCurrency } from '../member/shared';
import { AdminNav } from './shared';
import { adminStyles } from './styles';

export function AdminGroupsScreen() {
  const { data: legacyData } = usePendingGroupsQuery();
  const { data: formationQueue = [] } = usePendingFormationGroupsQuery();
  const formationItem = formationQueue[0];
  const { data: formationDetail } = useFormationGroupQuery(formationItem?.id ?? '');
  const {
    approveFormationGroup,
    approveGroup,
    freezeGroup,
    createResolutionPoll,
    closeResolutionPoll,
    rejectFormationGroup,
    rejectGroup,
    resolveFrozenGroup,
  } = useAdminActions();
  const [adminNote, setAdminNote] = useState('');
  const frozenItem = legacyData?.find(item => item.group.Status === 'Frozen');
  const legacyItem = legacyData?.find(item => item.group.Status !== 'Frozen') ?? null;
  const moreLegacyItems = (legacyData ?? []).filter(item =>
    item.group.Group_ID !== legacyItem?.group.Group_ID && item.group.Group_ID !== frozenItem?.group.Group_ID);
  const { data: frozenStatus } = useGroupStatusQuery(frozenItem?.group.Group_ID ?? '');

  const busy = approveGroup.isPending
    || rejectGroup.isPending
    || freezeGroup.isPending
    || createResolutionPoll.isPending
    || closeResolutionPoll.isPending
    || resolveFrozenGroup.isPending
    || approveFormationGroup.isPending
    || rejectFormationGroup.isPending;

  return (
    <AppScreen footer={<AdminNav active={routes.adminGroups} />} footerFlush>
      <TopAppBar title="Group Review" subtitle="Admin Queue" rightLabel={`${formationQueue.length + (legacyData?.length ?? 0)} pending`} />
      {formationItem && formationDetail ? (
        <>
          <SectionCard>
            <View style={adminStyles.rowWrap}>
              <Pill label={formationItem.status} tone="warn" />
              <Pill label={formationItem.risk_level} tone={formationItem.risk_level === 'Low' ? 'good' : 'warn'} />
            </View>
            <TitleBlock title={formationItem.proposed_group_name} subtitle={`Submitted by creator ${formationItem.creator_id.slice(-4)}`} />
            <View style={adminStyles.metricsGrid}>
              <MetricTile label="Contribution" value={formatCurrency(formationItem.contribution_amount)} />
              <MetricTile label="Accepted" value={`${formationItem.accepted_participant_count}/${formationItem.min_members}`} helper={`${formationItem.max_members} max members`} />
            </View>
            <ListRow title="Frequency" subtitle={formationItem.frequency} leadingIcon="repeat" />
            <ListRow title="Visibility" subtitle={`${formationItem.visibility} / ${formationItem.invite_mode}`} leadingIcon="visibility" />
            <ListRow title="Terms" subtitle={formationItem.terms_version} leadingIcon="rule" />
            <ListRow title="Payout vesting" subtitle={formationItem.vesting_enabled ? 'Enabled' : 'Disabled by creator'} leadingIcon="account-balance-wallet" />
          </SectionCard>
          <SectionCard variant="soft">
            <Text style={adminStyles.sectionTitle}>Participants</Text>
            <View style={adminStyles.listGroup}>
              {formationDetail.joinRequests.map(join => (
                <ListRow
                  key={join.id}
                  title={join.user_id === formationItem.creator_id ? 'Creator' : `Member ${join.user_id.slice(-4)}`}
                  subtitle={join.decision_reason ?? 'No decision note'}
                  right={<Pill label={join.status} tone={join.status === 'Accepted' ? 'good' : join.status === 'Requested' ? 'warn' : 'neutral'} />}
                  leadingIcon="person"
                />
              ))}
            </View>
          </SectionCard>
          <SectionCard variant="soft">
            <TitleBlock title="Review checks" subtitle="Approval creates canonical MVP group/member/round rows and leaves rejection in group_requests." />
            <ListRow title="Accepted participant minimum" subtitle={formationItem.accepted_participant_count >= formationItem.min_members ? 'Satisfied' : 'Below minimum'} leadingIcon="fact-check" />
            <ListRow title="Vesting policy" subtitle={formationItem.vesting_disabled_by_creator ? 'Override requested' : 'Standard vesting enabled'} leadingIcon="verified-user" />
            <ListRow title="Agreement required" subtitle={formationItem.agreement_required ? 'Required' : 'Not required'} leadingIcon="assignment" />
          </SectionCard>
          <PrimaryCTA label="Approve Formation" onPress={() => approveFormationGroup.mutate({ requestId: formationItem.id })} loading={approveFormationGroup.isPending} disabled={busy} />
          <SecondaryCTA label="Reject Formation" onPress={() => rejectFormationGroup.mutate({ requestId: formationItem.id, decisionReason: 'Rejected from admin review.' })} loading={rejectFormationGroup.isPending} disabled={busy} />
        </>
      ) : null}
      {formationQueue.length > 1 ? (
        <SectionCard variant="soft">
          <Text style={adminStyles.sectionTitle}>More formation requests</Text>
          <View style={adminStyles.listGroup}>
            {formationQueue.slice(1).map(request => (
              <ListRow
                key={request.id}
                title={request.proposed_group_name}
                subtitle={`${request.frequency} • ${request.visibility} • ${request.accepted_participant_count}/${request.min_members} accepted`}
                right={<Pill label={request.risk_level} tone={request.risk_level === 'Low' ? 'good' : 'warn'} />}
                leadingIcon="groups"
              />
            ))}
          </View>
        </SectionCard>
      ) : null}
      {frozenItem ? (
        <>
          <SectionCard>
            <View style={adminStyles.rowWrap}>
              <Pill label="Frozen recovery" tone="warn" />
              <Pill label={frozenItem.group.Status} tone="warn" />
            </View>
            <TitleBlock title={frozenItem.group.Group_Name} subtitle={`Review owner ${frozenItem.creator.Full_Name}`} />
            <ListRow title="Contribution" subtitle={`${frozenItem.group.Amount} ETB`} leadingIcon="payments" />
            <ListRow title="Members" subtitle={String(frozenItem.group.Max_Members)} leadingIcon="groups" />
            <ListRow title="Frequency" subtitle={frozenItem.group.Frequency} leadingIcon="repeat" />
            <ListRow title="Summary" subtitle={frozenItem.group.Description} leadingIcon="notes" />
          </SectionCard>
          <StatusBanner tone="warning" title="Manual recovery" body="This group is frozen while admin resolves the default case. Continuing keeps reserved payouts frozen for audit review." />
          {frozenStatus?.activeResolutionPoll ? (
            <SecondaryCTA
              label="Close Vote"
              onPress={() => closeResolutionPoll.mutate({
                groupId: frozenItem.group.Group_ID,
                pollId: frozenStatus.activeResolutionPoll!.poll.id,
              })}
              loading={closeResolutionPoll.isPending}
              disabled={busy}
            />
          ) : (
            <SecondaryCTA
              label="Open Member Vote"
              onPress={() => createResolutionPoll.mutate(frozenItem.group.Group_ID)}
              loading={createResolutionPoll.isPending}
              disabled={busy}
            />
          )}
          <PrimaryCTA
            label="Resume Group"
            onPress={() => resolveFrozenGroup.mutate({
              groupId: frozenItem.group.Group_ID,
              resolutionNote: 'Manual admin recovery: continue group with reserve held frozen.',
            })}
            loading={resolveFrozenGroup.isPending}
            disabled={busy}
          />
        </>
      ) : null}
      {legacyItem ? (
        <>
          <SectionCard>
            <View style={adminStyles.rowWrap}>
              <Pill label="Legacy MVP" tone="neutral" />
              <Pill label={legacyItem.group.Status} tone="warn" />
            </View>
            <TitleBlock title={legacyItem.group.Group_Name} subtitle={`Requested by ${legacyItem.creator.Full_Name}`} />
            <ListRow title="Contribution" subtitle={`${legacyItem.group.Amount} ETB`} leadingIcon="payments" />
            <ListRow title="Members" subtitle={String(legacyItem.group.Max_Members)} leadingIcon="groups" />
            <ListRow title="Frequency" subtitle={legacyItem.group.Frequency} leadingIcon="repeat" />
            <ListRow title="Summary" subtitle={legacyItem.group.Description} leadingIcon="notes" />
          </SectionCard>
          <StatusBanner tone="warning" title="Legacy request path" body="This queue is preserved during migration while new group formation moves through group_requests." />
          <PrimaryCTA label="Approve Legacy Group" onPress={() => approveGroup.mutate(legacyItem.group.Group_ID)} loading={approveGroup.isPending} disabled={busy} />
          <SecondaryCTA
            label="Return Legacy Request"
            onPress={() => rejectGroup.mutate(legacyItem.group.Group_ID, { onSuccess: () => setAdminNote('Legacy request returned to pending review and hidden from members.') })}
            loading={rejectGroup.isPending}
            disabled={busy}
          />
          <SecondaryCTA label="Freeze Legacy Group" onPress={() => freezeGroup.mutate(legacyItem.group.Group_ID)} loading={freezeGroup.isPending} disabled={busy} />
          <InlineError message={adminNote} />
        </>
      ) : null}
      {moreLegacyItems.length > 0 ? (
        <SectionCard variant="soft">
          <Text style={adminStyles.sectionTitle}>More legacy requests</Text>
          <View style={adminStyles.listGroup}>
            {moreLegacyItems.map(item => (
              <ListRow
                key={item.group.Group_ID}
                title={item.group.Group_Name}
                subtitle={`${item.group.Frequency} • ${item.group.Amount} ETB • ${item.creator.Full_Name}`}
                leadingIcon="pending-actions"
              />
            ))}
          </View>
        </SectionCard>
      ) : null}
      {!formationItem && !legacyItem ? (
        <EmptyState icon="playlist-add-check" title="No pending group requests" subtitle="Submitted Phase 2 formations and legacy MVP requests will appear here for review." />
      ) : null}
    </AppScreen>
  );
}
