import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useFormationGroupQuery, useGroupAnnouncementsQuery, useMemberActions } from '../../hooks/useAppQueries';
import { useAuth } from '../../providers/AuthProvider';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

function displayTermsVersion(value: string) {
  return value.split('|')[0];
}

export function FormationDetailScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const requestId = route.params?.requestId ?? '';
  const { data } = useFormationGroupQuery(requestId);
  const { data: announcements } = useGroupAnnouncementsQuery({ groupRequestId: requestId });
  const { requestJoinFormation } = useMemberActions();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentUserJoin = useMemo(
    () => data?.joinRequests.find(item => item.user_id === session?.user.userId) ?? null,
    [data?.joinRequests, session?.user.userId],
  );

  if (!data || !session) {
    return <LoadingState title="Loading forming group" subtitle="Checking current participants and group terms." />;
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
      setSuccess('');
      await requestJoinFormation.mutateAsync({
        requestId: request.id,
        acceptedTermsVersion: request.terms_version,
      });
      setSuccess('Join request sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send join request right now.');
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Join Forming Group" onBack={() => navigation.goBack()} />
      <TitleBlock
        title={request.proposed_group_name}
        subtitle={request.description ?? (isPrivate ? 'Private invite group gathering accepted members before it starts.' : 'Public group request gathering members before admin approval.')}
      />
      {success ? <StatusBanner tone="success" title={success} /> : null}
      <View style={memberStyles.rowWrap}>
        <Pill label={request.status} tone={request.status === 'Forming' ? 'good' : 'warn'} />
        <Pill label={request.frequency} tone="active" />
        <Pill label={request.visibility} tone="neutral" />
      </View>
      {currentUserJoin ? (
        <StatusBanner
          tone={currentUserJoin.status === 'Accepted' ? 'success' : 'info'}
          title={currentUserJoin.status}
          body={isPrivate ? 'The creator can start this group after enough accepted members join.' : 'The creator reviews participants before submitting the group.'}
        />
      ) : null}
      {request.vesting_disabled_by_creator ? (
        <StatusBanner tone="warning" title="Join request paused" body="This request uses a private vesting override that still needs approved warning copy before member self-service is enabled." />
      ) : null}
      <View style={memberStyles.metricsGrid}>
        <MetricTile label="Contribution" value={formatCurrency(request.contribution_amount)} />
        <MetricTile label="Accepted" value={`${data.accepted_participant_count}/${request.min_members}`} helper={`${data.remaining_slots} slots left`} />
        <MetricTile label="Draw Cycles" value={`${request.total_cycles ?? request.max_members}`} helper="Before completion" tone="active" />
      </View>
      {announcements?.length ? (
        <SectionCard variant="soft">
          <Text style={memberStyles.sectionTitle}>Announcement board</Text>
          <View style={memberStyles.listGroup}>
            {announcements.map(item => (
              <ListRow
                key={item.id}
                title={item.title}
                subtitle={item.body}
                right={<Pill label={item.priority} tone={item.priority === 'Critical' ? 'bad' : item.priority === 'High' ? 'warn' : 'neutral'} />}
                leadingIcon={item.pinned ? 'push-pin' : 'campaign'}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}
      <SectionCard>
        <Text style={memberStyles.sectionTitle}>Terms</Text>
        <View style={memberStyles.listGroup}>
          <ListRow title={displayTermsVersion(request.terms_version)} leadingIcon="rule" />
          <ListRow
            title={isPrivate ? 'Invite-managed group' : 'Creator-reviewed request'}
            subtitle={isPrivate ? 'The group starts when the accepted-member minimum is met.' : 'Admin review happens after the creator submits.'}
            leadingIcon="how-to-reg"
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
        label={currentUserJoin ? (currentUserJoin.status === 'Accepted' ? 'Accepted' : 'Requested') : 'Accept Terms And Request Join'}
        onPress={handleJoinRequest}
        loading={requestJoinFormation.isPending}
        disabled={!canRequestJoin || requestJoinFormation.isPending}
      />
    </ScreenScroll>
  );
}
