import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FormationErrorBanner } from '../../components/AppErrors';
import { Icon } from '../../components/Icon';
import { ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SectionCard, StatusBanner, TopAppBar } from '../../components/ui';
import { useFormationGroupQuery, useGroupAnnouncementsQuery, useMemberActions } from '../../hooks/useAppQueries';
import { useAuth } from '../../providers/AuthProvider';
import { iconSize, palette } from '../../theme/tokens';
import { formatCurrency, formatTimeLeft } from './shared';
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
  const acceptedPercent = request.max_members > 0 ? Math.min(100, Math.round((data.accepted_participant_count / request.max_members) * 100)) : 0;
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
      {success ? <StatusBanner tone="success" title={success} /> : null}
      <View style={memberStyles.previewHeroCard}>
        <View style={memberStyles.previewHeroTitleRow}>
          <Text style={memberStyles.previewHeroTitle}>{request.proposed_group_name}</Text>
          <View style={memberStyles.formationHubIcon}>
            <Icon name={currentUserJoin?.status === 'Accepted' ? 'verified' : 'group-add'} size={iconSize.md} color={palette.primary} />
          </View>
        </View>
        <Text style={memberStyles.previewHeroBody}>
          {request.description ?? (isPrivate ? 'Private invite group gathering accepted members before it starts.' : 'Creator-reviewed public group gathering members before admin approval.')}
        </Text>
        <View style={memberStyles.rowWrap}>
          <Pill label={request.status} tone={request.status === 'Forming' ? 'good' : 'warn'} />
          <Pill label={request.frequency} tone="active" />
          <Pill label={request.visibility} tone="neutral" />
        </View>
        <View style={memberStyles.formationProgressTrack}>
          <View style={[memberStyles.formationProgressFill, { width: `${acceptedPercent}%` }]} />
        </View>
        <Text style={memberStyles.mutedText}>{data.accepted_participant_count} of {request.max_members} members accepted. Admin review starts after the creator reaches the minimum and submits.</Text>
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
        <MetricTile label="Accepted" value={`${data.accepted_participant_count}/${request.max_members}`} helper={`${Math.max(request.min_members - data.accepted_participant_count, 0)} until review`} />
        <MetricTile label="Join Window" value={request.status === 'Approved' ? formatTimeLeft(request.join_window_ends_at) : `${request.join_window_hours ?? 72}h`} helper="After approval" />
        <MetricTile label="Completion" value="One win each" helper="Continuation is by member vote" tone="active" />
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
        <Text style={memberStyles.sectionTitle}>How this group starts</Text>
        <View style={memberStyles.listGroup}>
          <ListRow title="Creator review" subtitle="Your request goes to the group creator first." leadingIcon="how-to-reg" />
          <ListRow title="Admin approval" subtitle={isPrivate ? 'Private groups use invite-only approval.' : 'Public groups are reviewed before they become joinable.'} leadingIcon="admin-panel-settings" />
          <ListRow
            title="Join window before cycle"
            subtitle="Contributions and draws wait until the window closes or max members join."
            leadingIcon="hourglass-empty"
          />
          <ListRow title="Terms version" subtitle={displayTermsVersion(request.terms_version)} leadingIcon="rule" />
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
      <FormationErrorBanner error={error} />
      <PrimaryCTA
        label={currentUserJoin ? (currentUserJoin.status === 'Accepted' ? 'Accepted' : 'Requested') : 'Accept Terms And Request Join'}
        onPress={handleJoinRequest}
        loading={requestJoinFormation.isPending}
        disabled={!canRequestJoin || requestJoinFormation.isPending}
      />
    </ScreenScroll>
  );
}
