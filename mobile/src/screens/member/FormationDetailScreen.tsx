import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useFormationGroupQuery, useMemberActions } from '../../hooks/useAppQueries';
import { useAuth } from '../../providers/AuthProvider';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

export function FormationDetailScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const requestId = route.params?.requestId ?? '';
  const { data } = useFormationGroupQuery(requestId);
  const { requestJoinFormation } = useMemberActions();
  const [error, setError] = useState('');

  const currentUserJoin = useMemo(
    () => data?.joinRequests.find(item => item.user_id === session?.user.userId) ?? null,
    [data?.joinRequests, session?.user.userId],
  );

  if (!data || !session) {
    return <LoadingState title="Loading request" subtitle="Checking current participants and group terms." />;
  }

  const request = data.groupRequest;
  const isPrivate = request.visibility === 'Private';
  const canRequestJoin = request.status === 'Forming'
    && request.visibility === 'Public'
    && !currentUserJoin
    && data.remaining_slots > 0
    && !request.vesting_disabled_by_creator;

  async function handleJoinRequest() {
    try {
      setError('');
      await requestJoinFormation.mutateAsync({
        requestId: request.id,
        acceptedTermsVersion: request.terms_version,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send join request right now.');
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Forming Group" subtitle="Phase 2 request" onBack={() => navigation.goBack()} />
      <TitleBlock
        title={request.proposed_group_name}
        subtitle={request.description ?? (isPrivate ? 'Private invite group gathering accepted members before it starts.' : 'Public group request gathering members before admin approval.')}
      />
      <View style={memberStyles.rowWrap}>
        <Pill label={request.status} tone={request.status === 'Forming' ? 'good' : 'warn'} />
        <Pill label={request.frequency} tone="active" />
        <Pill label={request.visibility} tone="neutral" />
      </View>
      {currentUserJoin ? (
        <StatusBanner
          tone={currentUserJoin.status === 'Accepted' ? 'success' : 'info'}
          title={`Your request is ${currentUserJoin.status.toLowerCase()}`}
          body={isPrivate ? 'The creator manages accepted members before starting this invite-only group.' : 'The creator manages participant approval before submitting the group for admin review.'}
        />
      ) : null}
      {request.vesting_disabled_by_creator ? (
        <StatusBanner tone="warning" title="Join request paused" body="This request uses a private vesting override that still needs approved warning copy before member self-service is enabled." />
      ) : null}
      <View style={memberStyles.metricsGrid}>
        <MetricTile label="Contribution" value={formatCurrency(request.contribution_amount)} />
        <MetricTile label="Accepted" value={`${data.accepted_participant_count}/${request.max_members}`} helper={`${data.remaining_slots} slots left`} />
      </View>
      <SectionCard>
        <Text style={memberStyles.sectionTitle}>Before you request to join</Text>
        <View style={memberStyles.listGroup}>
          <ListRow title="Current terms version" subtitle={request.terms_version} leadingIcon="rule" />
          <ListRow
            title="Creator accepts members first"
            subtitle={isPrivate ? 'An invite or accepted request is needed before the group starts.' : 'A join request does not create a canonical group membership until approval is complete.'}
            leadingIcon="how-to-reg"
          />
          <ListRow
            title={isPrivate ? 'No admin approval' : 'Admin approval still required'}
            subtitle={isPrivate ? 'Private invite groups start once the accepted-member minimum is met.' : 'The group becomes active only after admin review creates the canonical Equb group.'}
            leadingIcon={isPrivate ? 'lock-open' : 'admin-panel-settings'}
          />
        </View>
      </SectionCard>
      <SectionCard variant="soft">
        <Text style={memberStyles.sectionTitle}>Participant progress</Text>
        <View style={memberStyles.listGroup}>
          {data.joinRequests.map(join => (
            <ListRow
              key={join.id}
              title={join.user_id === session.user.userId ? 'You' : `Member ${join.user_id.slice(-4)}`}
              subtitle={join.decision_reason ?? 'Awaiting creator decision'}
              right={<Pill label={join.status} tone={join.status === 'Accepted' ? 'good' : join.status === 'Requested' ? 'warn' : 'neutral'} />}
              leadingIcon="person"
            />
          ))}
        </View>
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA
        label={currentUserJoin ? `Request ${currentUserJoin.status}` : 'Accept Terms And Request Join'}
        onPress={handleJoinRequest}
        loading={requestJoinFormation.isPending}
        disabled={!canRequestJoin || requestJoinFormation.isPending}
      />
    </ScreenScroll>
  );
}
