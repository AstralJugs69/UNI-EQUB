import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useAdminActions, useFormationGroupQuery, useGroupStatusQuery, usePendingFormationGroupsQuery, usePendingGroupsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { formatCurrency } from '../member/shared';
import { adminStyles } from './styles';

export function AdminGroupReviewScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const kind = route.params?.kind as 'formation' | 'frozen' | 'legacy' | undefined;
  const requestId = route.params?.requestId ?? '';
  const groupId = route.params?.groupId ?? '';
  const { data: formationQueue = [] } = usePendingFormationGroupsQuery();
  const { data: legacyData = [] } = usePendingGroupsQuery();
  const formationItem = formationQueue.find(item => item.id === requestId);
  const { data: formationDetail } = useFormationGroupQuery(kind === 'formation' ? requestId : '');
  const groupItem = legacyData.find(item => item.group.Group_ID === groupId);
  const { data: frozenStatus } = useGroupStatusQuery(kind === 'frozen' ? groupId : '');
  const actions = useAdminActions();
  const [error, setError] = useState('');

  const busy = actions.approveGroup.isPending
    || actions.rejectGroup.isPending
    || actions.freezeGroup.isPending
    || actions.createResolutionPoll.isPending
    || actions.closeResolutionPoll.isPending
    || actions.resolveFrozenGroup.isPending
    || actions.approveFormationGroup.isPending
    || actions.rejectFormationGroup.isPending;

  function returnToQueue(flash: string) {
    navigation.navigate(routes.adminTabs, { screen: routes.adminGroups, params: { flash } });
  }

  function confirm(title: string, message: string, label: string, onConfirm: () => void) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: 'destructive', onPress: onConfirm },
    ]);
  }

  if (kind === 'formation') {
    if (!formationItem || !formationDetail) {
      return <LoadingState title="Loading formation review" subtitle="Finding the selected group request." />;
    }
    return (
      <ScreenScroll>
        <TopAppBar title="Admin Group Review" subtitle="Formation" onBack={() => navigation.goBack()} rightLabel={formationItem.status} />
        <SectionCard>
          <View style={adminStyles.rowWrap}>
            <Pill label={formationItem.status} tone="warn" />
            <Pill label={formationItem.risk_level} tone={formationItem.risk_level === 'Low' ? 'good' : 'warn'} />
            <Pill label={formationItem.visibility} tone="active" />
          </View>
          <TitleBlock title={formationItem.proposed_group_name} subtitle={formationItem.description ?? `Submitted by creator ${formationItem.creator_id.slice(-4)}`} />
          <View style={adminStyles.metricsGrid}>
            <MetricTile label="Contribution" value={formatCurrency(formationItem.contribution_amount)} />
            <MetricTile label="Accepted" value={`${formationItem.accepted_participant_count}/${formationItem.min_members}`} helper={`${formationItem.max_members} max members`} />
          </View>
          <ListRow title="Frequency" subtitle={formationItem.frequency} leadingIcon="repeat" />
          <ListRow title="Terms" subtitle={formationItem.terms_version} leadingIcon="rule" />
          <ListRow title="Payout vesting" subtitle={formationItem.vesting_enabled ? 'Enabled' : 'Disabled by creator'} leadingIcon="account-balance-wallet" />
        </SectionCard>
        <SectionCard variant="soft">
          <Text style={adminStyles.sectionTitle}>Participants</Text>
          {formationDetail.joinRequests.map(join => (
            <ListRow
              key={join.id}
              title={join.user_id === formationItem.creator_id ? 'Creator' : `Member ${join.user_id.slice(-4)}`}
              subtitle={join.decision_reason ?? 'No decision note'}
              right={<Pill label={join.status} tone={join.status === 'Accepted' ? 'good' : join.status === 'Requested' ? 'warn' : 'neutral'} />}
              leadingIcon="person"
            />
          ))}
        </SectionCard>
        <SectionCard variant="soft">
          <TitleBlock title="Review checks" subtitle="Approval creates canonical group, membership, and round rows." />
          <ListRow title="Accepted participant minimum" subtitle={formationItem.accepted_participant_count >= formationItem.min_members ? 'Satisfied' : 'Below minimum'} leadingIcon="fact-check" />
          <ListRow title="Agreement required" subtitle={formationItem.agreement_required ? 'Required' : 'Not required'} leadingIcon="assignment" />
        </SectionCard>
        <InlineError message={error} />
        <PrimaryCTA
          label="Approve Formation"
          onPress={() => {
            setError('');
            actions.approveFormationGroup.mutate({ requestId: formationItem.id }, {
              onSuccess: () => returnToQueue('Formation approved.'),
              onError: err => setError(err instanceof Error ? err.message : 'Unable to approve formation.'),
            });
          }}
          loading={actions.approveFormationGroup.isPending}
          disabled={busy}
        />
        <SecondaryCTA
          label="Reject Formation"
          onPress={() => confirm('Reject formation', `Reject ${formationItem.proposed_group_name}?`, 'Reject', () => {
            setError('');
            actions.rejectFormationGroup.mutate({ requestId: formationItem.id, decisionReason: 'Rejected from admin review.' }, {
              onSuccess: () => returnToQueue('Formation rejected.'),
              onError: err => setError(err instanceof Error ? err.message : 'Unable to reject formation.'),
            });
          })}
          loading={actions.rejectFormationGroup.isPending}
          disabled={busy}
        />
      </ScreenScroll>
    );
  }

  if (!groupItem) {
    return <LoadingState title="Loading group review" subtitle="Finding the selected queue item." />;
  }

  const isFrozen = kind === 'frozen';

  return (
    <ScreenScroll>
      <TopAppBar title="Admin Group Review" subtitle={isFrozen ? 'Frozen Recovery' : 'Legacy MVP'} onBack={() => navigation.goBack()} rightLabel={groupItem.group.Status} />
      <SectionCard>
        <View style={adminStyles.rowWrap}>
          <Pill label={isFrozen ? 'Frozen recovery' : 'Legacy MVP'} tone={isFrozen ? 'warn' : 'neutral'} />
          <Pill label={groupItem.group.Status} tone="warn" />
        </View>
        <TitleBlock title={groupItem.group.Group_Name} subtitle={`Requested by ${groupItem.creator.Full_Name}`} />
        <View style={adminStyles.metricsGrid}>
          <MetricTile label="Contribution" value={formatCurrency(groupItem.group.Amount)} />
          <MetricTile label="Members" value={String(groupItem.group.Max_Members)} />
        </View>
        <ListRow title="Frequency" subtitle={groupItem.group.Frequency} leadingIcon="repeat" />
        <ListRow title="Summary" subtitle={groupItem.group.Description} leadingIcon="notes" />
      </SectionCard>
      {isFrozen ? (
        <>
          <StatusBanner tone="warning" title="Manual recovery" body="This group is frozen while admin resolves the default case. Continuing keeps reserved payouts frozen for audit review." />
          <InlineError message={error} />
          {frozenStatus?.activeResolutionPoll ? (
            <SecondaryCTA
              label="Close Vote"
              onPress={() => confirm('Close member vote', 'Close this recovery vote and apply the current resolution state?', 'Close Vote', () => {
                setError('');
                actions.closeResolutionPoll.mutate({
                  groupId: groupItem.group.Group_ID,
                  pollId: frozenStatus.activeResolutionPoll!.poll.id,
                }, {
                  onSuccess: () => returnToQueue('Member vote closed.'),
                  onError: err => setError(err instanceof Error ? err.message : 'Unable to close vote.'),
                });
              })}
              loading={actions.closeResolutionPoll.isPending}
              disabled={busy}
            />
          ) : (
            <SecondaryCTA
              label="Open Member Vote"
              onPress={() => {
                setError('');
                actions.createResolutionPoll.mutate(groupItem.group.Group_ID, {
                  onSuccess: () => returnToQueue('Member vote opened.'),
                  onError: err => setError(err instanceof Error ? err.message : 'Unable to open vote.'),
                });
              }}
              loading={actions.createResolutionPoll.isPending}
              disabled={busy}
            />
          )}
          <PrimaryCTA
            label="Resume Group"
            onPress={() => confirm('Resume group', `Resume ${groupItem.group.Group_Name} with reserve held frozen?`, 'Resume', () => {
              setError('');
              actions.resolveFrozenGroup.mutate({
                groupId: groupItem.group.Group_ID,
                resolutionNote: 'Manual admin recovery: continue group with reserve held frozen.',
              }, {
                onSuccess: () => returnToQueue('Group resumed.'),
                onError: err => setError(err instanceof Error ? err.message : 'Unable to resume group.'),
              });
            })}
            loading={actions.resolveFrozenGroup.isPending}
            disabled={busy}
          />
        </>
      ) : (
        <>
          <StatusBanner tone="warning" title="Legacy request path" body="This queue is preserved during migration while new group formation moves through group_requests." />
          <InlineError message={error} />
          <PrimaryCTA
            label="Approve Legacy Group"
            onPress={() => {
              setError('');
              actions.approveGroup.mutate(groupItem.group.Group_ID, {
                onSuccess: () => returnToQueue('Legacy group approved.'),
                onError: err => setError(err instanceof Error ? err.message : 'Unable to approve legacy group.'),
              });
            }}
            loading={actions.approveGroup.isPending}
            disabled={busy}
          />
          <SecondaryCTA
            label="Return Legacy Request"
            onPress={() => confirm('Return legacy request', `Return ${groupItem.group.Group_Name} to pending review?`, 'Return', () => {
              setError('');
              actions.rejectGroup.mutate(groupItem.group.Group_ID, {
                onSuccess: () => returnToQueue('Legacy request returned.'),
                onError: err => setError(err instanceof Error ? err.message : 'Unable to return legacy request.'),
              });
            })}
            loading={actions.rejectGroup.isPending}
            disabled={busy}
          />
          <SecondaryCTA
            label="Freeze Legacy Group"
            onPress={() => confirm('Freeze group', `Freeze ${groupItem.group.Group_Name} for admin recovery?`, 'Freeze', () => {
              setError('');
              actions.freezeGroup.mutate(groupItem.group.Group_ID, {
                onSuccess: () => returnToQueue('Legacy group frozen.'),
                onError: err => setError(err instanceof Error ? err.message : 'Unable to freeze legacy group.'),
              });
            })}
            loading={actions.freezeGroup.isPending}
            disabled={busy}
          />
        </>
      )}
    </ScreenScroll>
  );
}
