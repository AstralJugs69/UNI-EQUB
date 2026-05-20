import React, { useMemo, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useFormationGroupQuery, useGroupAnnouncementsQuery, useMemberActions } from '../../hooks/useAppQueries';
import { iconSize, palette } from '../../theme/tokens';
import type { GroupJoinRequestRecord, KycStatus, ReliabilityPublicStatus } from '../../types/domain';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

function participantDisplayName(join: GroupJoinRequestRecord) {
  return join.participantProfile?.fullName ?? `Pending member ${join.user_id.slice(-6).toUpperCase()}`;
}

function participantProfileSummary(join: GroupJoinRequestRecord) {
  const profile = join.participantProfile;
  if (!profile) {
    return `Requested ${new Date(join.requested_at).toLocaleDateString()}`;
  }
  return [
    profile.phoneNumber,
    profile.university,
    profile.academicYear,
  ].filter(Boolean).join(' • ');
}

function trustTone(status: ReliabilityPublicStatus | undefined): 'neutral' | 'active' | 'good' | 'warn' | 'bad' {
  if (status === 'Trusted') {
    return 'good';
  }
  if (status === 'BuildingTrust') {
    return 'active';
  }
  if (status === 'Restricted') {
    return 'warn';
  }
  if (status === 'Banned') {
    return 'bad';
  }
  return 'neutral';
}

function kycTone(status: KycStatus | undefined): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'Verified') {
    return 'good';
  }
  if (status === 'Banned') {
    return 'bad';
  }
  return 'neutral';
}

export function FormationCreatorScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const requestId = route.params?.requestId ?? '';
  const { data } = useFormationGroupQuery(requestId);
  const { data: announcements } = useGroupAnnouncementsQuery({ groupRequestId: requestId });
  const {
    acceptFormationJoin,
    inviteFormation,
    removeFormationParticipant,
    submitFormationForApproval,
  } = useMemberActions();
  const [inviteTarget, setInviteTarget] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const pendingRequests = useMemo(
    () => data?.joinRequests.filter(item => item.status === 'Requested') ?? [],
    [data?.joinRequests],
  );

  if (!data) {
    return <LoadingState title="Loading forming group" subtitle="Preparing creator controls and participant state." />;
  }

  const request = data.groupRequest;
  const isPrivate = request.visibility === 'Private';
  const isPublicRequest = request.invite_mode === 'PublicRequest';
  const canInvite = request.status === 'Forming';
  const canSubmit = request.status === 'Forming' && data.accepted_participant_count >= request.min_members;
  const acceptedRemaining = Math.max(request.min_members - data.accepted_participant_count, 0);

  async function handleInvite() {
    try {
      setError('');
      setSuccess('');
      await inviteFormation.mutateAsync({
        requestId: request.id,
        invitedPhoneOrStudentId: isPublicRequest ? undefined : inviteTarget.trim() || undefined,
      });
      setInviteTarget('');
      setSuccess(isPublicRequest ? 'Invite code created.' : 'Invitation created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create invitation.');
    }
  }

  async function handleAccept(joinRequestId: string) {
    try {
      setError('');
      setSuccess('');
      await acceptFormationJoin.mutateAsync({ joinRequestId });
      setSuccess('Participant accepted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept participant.');
    }
  }

  async function handleRemove(joinRequestId: string) {
    try {
      setError('');
      setSuccess('');
      await removeFormationParticipant.mutateAsync({ joinRequestId });
      setSuccess('Participant removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update participant.');
    }
  }

  async function handleSubmit() {
    try {
      setError('');
      setSuccess('');
      await submitFormationForApproval.mutateAsync(request.id);
      setSuccess(isPrivate ? 'Private group started.' : 'Formation submitted for admin review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : (isPrivate ? 'Unable to start private group.' : 'Unable to submit for approval.'));
    }
  }

  async function handleShareInvite() {
    try {
      setError('');
      setSuccess('');
      const link = `uniequb://formation/${request.id}`;
      await Share.share({
        title: 'UniEqub group invitation',
        message: `Join ${request.proposed_group_name} on UniEqub: ${link}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share this group link.');
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="My Forming Group" onBack={() => navigation.goBack()} />
      <TitleBlock title={request.proposed_group_name} subtitle={request.description ?? undefined} />
      {success ? <StatusBanner tone="success" title={success} /> : null}
      <View style={memberStyles.rowWrap}>
        <Pill label={request.status} tone={request.status === 'Forming' ? 'good' : request.status === 'PendingApproval' ? 'warn' : 'neutral'} />
        <Pill label={request.visibility} tone="active" />
        <Pill label={request.invite_mode} tone="neutral" />
      </View>
      <View style={memberStyles.metricsGrid}>
        <MetricTile label="Contribution" value={formatCurrency(request.contribution_amount)} />
        <MetricTile label="Accepted" value={`${data.accepted_participant_count}/${request.min_members}`} helper={`${data.remaining_slots} slots left`} tone={canSubmit ? 'good' : 'neutral'} />
        <MetricTile label="Draw Cycles" value={`${request.total_cycles ?? request.max_members}`} helper="Before completion" tone="active" />
      </View>
      {request.status === 'PendingApproval' ? (
        <StatusBanner tone="success" title={isPrivate ? 'Starting private group' : 'Submitted for admin approval'} />
      ) : null}
      {request.status === 'Approved' ? (
        <StatusBanner tone="success" title={isPrivate ? 'Private group started' : 'Approved'} />
      ) : null}
      {request.status === 'Rejected' ? (
        <StatusBanner tone="danger" title="Request was not approved" body={request.rejection_reason ?? 'Review the reason and create a revised request when ready.'} />
      ) : null}
      {request.status === 'Forming' && acceptedRemaining > 0 ? (
        <StatusBanner tone="info" title={`${acceptedRemaining} more accepted member${acceptedRemaining === 1 ? '' : 's'} needed`} />
      ) : null}
      <SectionCard variant={pendingRequests.length ? 'raised' : 'default'}>
        <Text style={memberStyles.sectionTitle}>Participant requests</Text>
        {pendingRequests.length ? (
          <>
            <StatusBanner tone="info" title={`${pendingRequests.length} member${pendingRequests.length === 1 ? '' : 's'} waiting for your decision`} body="Accept members you trust into the forming group, or reject requests that do not fit this cycle." />
            <View style={memberStyles.listGroup}>
              {pendingRequests.map(join => (
                <View key={join.id} style={memberStyles.itemBlock}>
                  <ListRow
                    title={participantDisplayName(join)}
                    subtitle={participantProfileSummary(join)}
                    leadingIcon="person-add"
                    right={<Pill label={join.participantProfile?.reliability?.public_status ?? 'New'} tone={trustTone(join.participantProfile?.reliability?.public_status)} />}
                  />
                  <View style={memberStyles.rowWrap}>
                    <Pill label={`KYC ${join.participantProfile?.kycStatus ?? 'Unknown'}`} tone={kycTone(join.participantProfile?.kycStatus)} />
                    <Pill label={`${join.participantProfile?.reliability?.completed_groups_count ?? 0} completed`} tone="neutral" />
                    <Pill label={`${join.participantProfile?.reliability?.late_payment_count ?? 0} late`} tone={(join.participantProfile?.reliability?.late_payment_count ?? 0) > 0 ? 'warn' : 'good'} />
                    <Pill label={`${join.participantProfile?.reliability?.default_count ?? 0} defaults`} tone={(join.participantProfile?.reliability?.default_count ?? 0) > 0 ? 'bad' : 'good'} />
                  </View>
                  <Text style={memberStyles.mutedText}>
                    {join.participantProfile
                      ? `Profile: ${join.participantProfile.university ?? 'University not set'} • ${join.participantProfile.academicYear ?? 'Year not set'} • Requested ${new Date(join.requested_at).toLocaleDateString()}`
                      : 'Profile details are not available yet. Ask the member to complete their profile before accepting if you need more confidence.'}
                  </Text>
                  <View style={memberStyles.twoCol}>
                    <PrimaryCTA label="Accept Member" onPress={() => handleAccept(join.id)} loading={acceptFormationJoin.isPending} disabled={acceptFormationJoin.isPending || removeFormationParticipant.isPending} />
                    <SecondaryCTA label="Reject" onPress={() => handleRemove(join.id)} loading={removeFormationParticipant.isPending} disabled={acceptFormationJoin.isPending || removeFormationParticipant.isPending} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={memberStyles.mutedText}>No participant requests are waiting. Share the forming group or invite code to bring members here.</Text>
        )}
      </SectionCard>
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
      {canInvite ? (
        <SectionCard>
          <Text style={memberStyles.sectionTitle}>{isPublicRequest ? 'Shareable invite code' : 'Invite participant'}</Text>
          {isPublicRequest ? (
            <Text style={memberStyles.mutedText}>Create a reusable code that verified members can accept directly.</Text>
          ) : (
            <InputField label="Phone or Student ID" value={inviteTarget} onChangeText={setInviteTarget} leadingIcon="person-add" />
          )}
          <PrimaryCTA
            label={isPublicRequest ? 'Create Invite Code' : 'Create Invitation'}
            onPress={handleInvite}
            loading={inviteFormation.isPending}
            disabled={inviteFormation.isPending}
          />
        </SectionCard>
      ) : null}
      {data.invitations.length ? (
        <SectionCard variant="soft">
          <Text style={memberStyles.sectionTitle}>Invitations</Text>
          <View style={memberStyles.listGroup}>
            {data.invitations.map(invitation => {
              const reusable = Boolean(invitation.invite_code && !invitation.invited_phone_or_student_id && !invitation.invited_user_id);
              return (
                <ListRow
                  key={invitation.id}
                  title={invitation.invite_code ? 'App join link' : invitation.invited_phone_or_student_id ?? 'Invitation'}
                  subtitle={invitation.invite_code && invitation.invited_phone_or_student_id ? invitation.invited_phone_or_student_id : undefined}
                  right={(
                    <View style={memberStyles.inviteActions}>
                      <Pill label={reusable ? 'Reusable' : invitation.status} tone={invitation.status === 'Accepted' ? 'good' : invitation.status === 'Pending' ? 'warn' : 'neutral'} />
                      {invitation.invite_code ? (
                        <Pressable
                          onPress={handleShareInvite}
                          android_ripple={{ color: '#dce6f3', borderless: true }}
                          accessibilityRole="button"
                          accessibilityLabel="Share group join link"
                          style={memberStyles.iconAction}
                        >
                          <Icon name="share" size={iconSize.sm} color={palette.primaryDark} />
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                  leadingIcon="mail"
                />
              );
            })}
          </View>
        </SectionCard>
      ) : null}
      <SectionCard variant="soft">
        <Text style={memberStyles.sectionTitle}>Accepted participants</Text>
        <View style={memberStyles.listGroup}>
          {data.joinRequests.filter(join => join.status === 'Accepted').map(join => (
            <ListRow key={join.id} title={join.user_id === request.creator_id ? 'Creator' : `Member ${join.user_id.slice(-4)}`} subtitle={join.decision_reason ?? 'Accepted'} leadingIcon="verified" />
          ))}
        </View>
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA
        label={request.status === 'PendingApproval' ? 'Waiting For Admin' : request.status === 'Approved' ? (isPrivate ? 'Started' : 'Approved') : isPrivate ? 'Start Private Group' : 'Submit For Approval'}
        onPress={handleSubmit}
        loading={submitFormationForApproval.isPending}
        disabled={!canSubmit || submitFormationForApproval.isPending || request.status !== 'Forming'}
      />
    </ScreenScroll>
  );
}
