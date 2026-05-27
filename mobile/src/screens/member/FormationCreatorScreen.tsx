import React, { useMemo, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { FormationErrorBanner } from '../../components/AppErrors';
import { InputField, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner, TopAppBar } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useFormationGroupQuery, useGroupAnnouncementsQuery, useMemberActions } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { iconSize, palette } from '../../theme/tokens';
import type { GroupJoinRequestRecord, KycStatus, ReliabilityPublicStatus } from '../../types/domain';
import { formatCurrency, formatTimeLeft } from './shared';
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
  ].filter(Boolean).join(' - ');
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

function initialsFor(value: string) {
  return value
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function CreatorActionButton({
  label,
  icon,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  icon: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[memberStyles.formationActionButton, primary && memberStyles.formationActionButtonPrimary, disabled && { opacity: 0.55 }]}
    >
      <Icon name={icon} size={iconSize.sm} color={primary ? palette.white : palette.primary} />
      <Text style={[memberStyles.formationActionButtonText, primary && memberStyles.formationActionButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
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
  const maxRemaining = Math.max(request.max_members - data.accepted_participant_count, 0);
  const approvedOpen = request.status === 'Approved' && request.approved_group_id && !request.activated_at;
  const activated = request.status === 'Approved' && request.approved_group_id && !!request.activated_at;
  const acceptedPercent = request.max_members > 0 ? Math.min(100, Math.round((data.accepted_participant_count / request.max_members) * 100)) : 0;
  const primaryStatusCopy = request.status === 'Forming'
    ? `${acceptedRemaining} more accepted member${acceptedRemaining === 1 ? '' : 's'} until submission`
    : approvedOpen
      ? `Join window closes ${formatTimeLeft(request.join_window_ends_at)}`
      : activated
        ? 'Contribution cycle is active'
        : request.status === 'PendingApproval'
          ? 'Waiting for admin review'
          : request.status;

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

  async function handleShareInvite(inviteCode?: string | null) {
    try {
      setError('');
      setSuccess('');
      const link = inviteCode ? `uniequb:///join-code/${encodeURIComponent(inviteCode)}` : `uniequb:///formation/${request.id}`;
      await Share.share({
        title: 'UniEqub group invitation',
        message: inviteCode
          ? `Join ${request.proposed_group_name} on UniEqub.\nLink: ${link}\nJoin code: ${inviteCode}`
          : `Join ${request.proposed_group_name} on UniEqub: ${link}`,
        url: link,
      } as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share this group link.');
    }
  }

  function handleCopyInviteCode(inviteCode: string) {
    Clipboard.setString(inviteCode);
    setError('');
    setSuccess('Invite code copied.');
  }

  return (
    <ScreenScroll>
      <TopAppBar title="My Forming Group" onBack={() => navigation.goBack()} />
      {success ? <StatusBanner tone="success" title={success} /> : null}
      <View style={memberStyles.formationHubCard}>
        <View style={memberStyles.formationHubHeader}>
          <View style={memberStyles.formationHubIcon}>
            <Icon name={activated ? 'play-circle' : approvedOpen ? 'hourglass-empty' : 'playlist-add-check'} size={iconSize.md} color={palette.primary} />
          </View>
          <View style={memberStyles.formationHubText}>
            <Text style={memberStyles.formationHubTitle}>{request.proposed_group_name}</Text>
            <Text style={memberStyles.formationHubBody}>{request.description || 'Creator-managed request. Accept trusted participants, submit for review, then open the join window.'}</Text>
          </View>
          <Pill label={request.status} tone={request.status === 'Forming' ? 'good' : request.status === 'PendingApproval' ? 'warn' : 'neutral'} />
        </View>
        <Text style={memberStyles.mutedText}>{primaryStatusCopy}</Text>
        <View style={memberStyles.formationProgressTrack}>
          <View style={[memberStyles.formationProgressFill, { width: `${acceptedPercent}%` }]} />
        </View>
        <View style={memberStyles.formationActionStrip}>
          {request.status === 'Approved' && request.approved_group_id ? (
            <CreatorActionButton
              primary
              icon={activated ? 'cycle' : 'travel-explore'}
              label={activated ? 'Open Cycle' : 'Open Preview'}
              onPress={() => navigation.navigate(activated ? routes.groupStatus : routes.groupDetail, { groupId: request.approved_group_id })}
            />
          ) : (
            <CreatorActionButton
              primary={canSubmit}
              disabled={!canSubmit || submitFormationForApproval.isPending}
              icon="send"
              label={isPrivate ? 'Start Join Window' : 'Submit Review'}
              onPress={handleSubmit}
            />
          )}
          <CreatorActionButton icon="share" label="Share Link" onPress={() => handleShareInvite(data.invitations.find(item => item.invite_code)?.invite_code)} />
        </View>
      </View>
      <View style={memberStyles.metricsGrid}>
        <MetricTile label="Contribution" value={formatCurrency(request.contribution_amount)} />
        <MetricTile label="Accepted" value={`${data.accepted_participant_count}/${request.max_members}`} helper={request.status === 'Forming' ? `${acceptedRemaining} until submit` : `${maxRemaining} open slots`} tone={canSubmit || request.status === 'Approved' ? 'good' : 'neutral'} />
        <MetricTile label="Join Window" value={request.status === 'Approved' ? formatTimeLeft(request.join_window_ends_at) : `${request.join_window_hours ?? 72}h`} helper="Max members starts immediately" tone="active" />
        <MetricTile label="Completion" value="One win each" helper="Members vote after the first full cycle" tone="active" />
      </View>
      {request.status === 'PendingApproval' ? (
        <StatusBanner tone="success" title={isPrivate ? 'Starting private group' : 'Submitted for admin approval'} />
      ) : null}
      {request.status === 'Approved' ? (
        <StatusBanner
          tone="success"
          title={activated ? 'Cycle started' : 'Approved and open for joining'}
          body={activated
            ? 'The member set is locked and contribution obligations are active.'
            : 'Members can still join until the wait time ends. If max members join first, the cycle starts immediately.'}
        />
      ) : null}
      {request.status === 'Rejected' ? (
        <StatusBanner tone="danger" title="Request was not approved" body={request.rejection_reason ?? 'Review the reason and create a revised request when ready.'} />
      ) : null}
      {request.status === 'Forming' && acceptedRemaining > 0 ? (
        <StatusBanner tone="info" title={`${acceptedRemaining} more accepted member${acceptedRemaining === 1 ? '' : 's'} needed`} />
      ) : null}
      <SectionCard variant={pendingRequests.length ? 'raised' : 'default'}>
        <View style={memberStyles.rowBetween}>
          <Text style={memberStyles.sectionTitle}>Participant requests</Text>
          <Pill label={`${pendingRequests.length} waiting`} tone={pendingRequests.length ? 'warn' : 'neutral'} />
        </View>
        {pendingRequests.length ? (
          <>
            <StatusBanner tone="info" title={`${pendingRequests.length} member${pendingRequests.length === 1 ? '' : 's'} waiting for your decision`} body="Accept members you trust into the forming group, or reject requests that do not fit this cycle." />
            <View style={memberStyles.listGroup}>
              {pendingRequests.map(join => (
                <View key={join.id} style={memberStyles.participantCard}>
                  <View style={memberStyles.participantHeader}>
                    <View style={memberStyles.participantAvatar}>
                      <Text style={memberStyles.participantAvatarText}>{initialsFor(participantDisplayName(join))}</Text>
                    </View>
                    <View style={memberStyles.participantInfo}>
                      <Text style={memberStyles.participantName}>{participantDisplayName(join)}</Text>
                      <Text style={memberStyles.participantMeta}>{participantProfileSummary(join)}</Text>
                    </View>
                    <Pill label={join.participantProfile?.reliability?.public_status ?? 'New'} tone={trustTone(join.participantProfile?.reliability?.public_status)} />
                  </View>
                  <View style={memberStyles.rowWrap}>
                    <Pill label={`KYC ${join.participantProfile?.kycStatus ?? 'Unknown'}`} tone={kycTone(join.participantProfile?.kycStatus)} />
                    <Pill label={`${join.participantProfile?.reliability?.completed_groups_count ?? 0} completed`} tone="neutral" />
                    <Pill label={`${join.participantProfile?.reliability?.late_payment_count ?? 0} late`} tone={(join.participantProfile?.reliability?.late_payment_count ?? 0) > 0 ? 'warn' : 'good'} />
                    <Pill label={`${join.participantProfile?.reliability?.default_count ?? 0} defaults`} tone={(join.participantProfile?.reliability?.default_count ?? 0) > 0 ? 'bad' : 'good'} />
                  </View>
                  <Text style={memberStyles.mutedText}>
                    {join.participantProfile
                      ? `Profile: ${join.participantProfile.university ?? 'University not set'} - ${join.participantProfile.academicYear ?? 'Year not set'} - Requested ${new Date(join.requested_at).toLocaleDateString()}`
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
              const link = invitation.invite_code ? `uniequb:///join-code/${invitation.invite_code}` : null;
              if (invitation.invite_code && link) {
                return (
                  <View key={invitation.id} style={memberStyles.inviteCodeCard}>
                    <View style={memberStyles.rowBetween}>
                      <View style={memberStyles.inviteCodeHeaderText}>
                        <Text style={memberStyles.inviteCodeTitle}>Group join link</Text>
                        <Text style={memberStyles.inviteLinkText}>{link}</Text>
                      </View>
                      <View style={memberStyles.inviteActions}>
                        <Pill label={reusable ? 'Reusable' : invitation.status} tone={invitation.status === 'Accepted' ? 'good' : invitation.status === 'Pending' ? 'warn' : 'neutral'} />
                        <Pressable
                          onPress={() => handleShareInvite(invitation.invite_code)}
                          android_ripple={{ color: '#dce6f3', borderless: true }}
                          accessibilityRole="button"
                          accessibilityLabel="Share group join link"
                          style={memberStyles.iconAction}
                        >
                          <Icon name="share" size={iconSize.sm} color={palette.primaryDark} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={memberStyles.inviteCodeCopyCard}>
                      <View style={memberStyles.inviteCodeBadge}>
                        <Icon name="key" size={iconSize.sm} color={palette.primaryDark} />
                      </View>
                      <View style={memberStyles.inviteCodeTextBlock}>
                        <Text style={memberStyles.inviteCodeLabel}>Join code</Text>
                        <Text selectable style={memberStyles.inviteCodeValue}>{invitation.invite_code}</Text>
                      </View>
                      <View style={memberStyles.inviteCodeButtonRow}>
                        <Pressable
                          onPress={() => handleCopyInviteCode(invitation.invite_code!)}
                          android_ripple={{ color: '#dce6f3', borderless: true }}
                          accessibilityRole="button"
                          accessibilityLabel="Copy join code"
                          style={memberStyles.inviteCodeSmallButton}
                        >
                          <Icon name="content-copy" size={iconSize.sm} color={palette.primaryDark} />
                          <Text style={memberStyles.inviteCodeSmallButtonText}>Copy</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleShareInvite(invitation.invite_code)}
                          android_ripple={{ color: '#dce6f3', borderless: true }}
                          accessibilityRole="button"
                          accessibilityLabel="Share join code"
                          style={memberStyles.inviteCodeSmallButton}
                        >
                          <Icon name="ios-share" size={iconSize.sm} color={palette.primaryDark} />
                          <Text style={memberStyles.inviteCodeSmallButtonText}>Share</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              }
              return (
                <ListRow
                  key={invitation.id}
                  title={invitation.invite_code ? 'Group join link' : invitation.invited_phone_or_student_id ?? 'Invitation'}
                  subtitle={invitation.invite_code ? `uniequb://join-code/${invitation.invite_code}` : undefined}
                  right={(
                    <View style={memberStyles.inviteActions}>
                      <Pill label={reusable ? 'Reusable' : invitation.status} tone={invitation.status === 'Accepted' ? 'good' : invitation.status === 'Pending' ? 'warn' : 'neutral'} />
                      {invitation.invite_code ? (
                        <Pressable
                          onPress={() => handleShareInvite(invitation.invite_code)}
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
                  onPress={invitation.invite_code ? () => handleShareInvite(invitation.invite_code) : undefined}
                />
              );
            })}
          </View>
        </SectionCard>
      ) : null}
      <SectionCard variant="soft">
        <View style={memberStyles.rowBetween}>
          <Text style={memberStyles.sectionTitle}>Accepted participants</Text>
          <Pill label={`${data.accepted_participant_count}/${request.max_members}`} tone="good" />
        </View>
        <View style={memberStyles.listGroup}>
          {data.joinRequests.filter(join => join.status === 'Accepted').map(join => (
            <ListRow
              key={join.id}
              title={join.user_id === request.creator_id ? 'Creator' : participantDisplayName(join)}
              subtitle={join.decision_reason ?? 'Accepted into the draw pool'}
              leadingIcon="verified"
              right={<Pill label={join.user_id === request.creator_id ? 'Owner' : 'Accepted'} tone="good" />}
            />
          ))}
        </View>
      </SectionCard>
      <FormationErrorBanner error={error} />
      <PrimaryCTA
        label={request.status === 'PendingApproval' ? 'Waiting For Admin' : request.status === 'Approved' ? (activated ? 'Open Group Cycle' : 'Open Group Preview') : isPrivate ? 'Start Join Window' : 'Submit For Approval'}
        onPress={request.status === 'Approved' && request.approved_group_id ? () => navigation.navigate(activated ? routes.groupStatus : routes.groupDetail, { groupId: request.approved_group_id }) : handleSubmit}
        loading={submitFormationForApproval.isPending}
        disabled={(request.status === 'Forming' && !canSubmit) || submitFormationForApproval.isPending || (request.status !== 'Forming' && request.status !== 'Approved')}
      />
    </ScreenScroll>
  );
}
