import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useFormationGroupQuery, useMemberActions } from '../../hooks/useAppQueries';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

export function FormationCreatorScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const requestId = route.params?.requestId ?? '';
  const { data } = useFormationGroupQuery(requestId);
  const {
    acceptFormationJoin,
    inviteFormation,
    removeFormationParticipant,
    submitFormationForApproval,
  } = useMemberActions();
  const [inviteTarget, setInviteTarget] = useState('');
  const [error, setError] = useState('');

  const pendingRequests = useMemo(
    () => data?.joinRequests.filter(item => item.status === 'Requested') ?? [],
    [data?.joinRequests],
  );

  if (!data) {
    return <LoadingState title="Loading request" subtitle="Preparing creator controls and participant state." />;
  }

  const request = data.groupRequest;
  const canInvite = request.status === 'Forming' && request.invite_mode !== 'PublicRequest';
  const canSubmit = request.status === 'Forming' && data.accepted_participant_count >= request.min_members;
  const acceptedRemaining = Math.max(request.min_members - data.accepted_participant_count, 0);

  async function handleInvite() {
    try {
      setError('');
      await inviteFormation.mutateAsync({
        requestId: request.id,
        invitedPhoneOrStudentId: inviteTarget.trim() || undefined,
      });
      setInviteTarget('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create invitation.');
    }
  }

  async function handleAccept(joinRequestId: string) {
    try {
      setError('');
      await acceptFormationJoin.mutateAsync({ joinRequestId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept participant.');
    }
  }

  async function handleRemove(joinRequestId: string) {
    try {
      setError('');
      await removeFormationParticipant.mutateAsync({ joinRequestId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update participant.');
    }
  }

  async function handleSubmit() {
    try {
      setError('');
      await submitFormationForApproval.mutateAsync(request.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit for approval.');
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Manage Request" subtitle="Creator setup" onBack={() => navigation.goBack()} />
      <TitleBlock title={request.proposed_group_name} subtitle={request.description ?? 'Review participants before admin submission.'} />
      <View style={memberStyles.rowWrap}>
        <Pill label={request.status} tone={request.status === 'Forming' ? 'good' : request.status === 'PendingApproval' ? 'warn' : 'neutral'} />
        <Pill label={request.visibility} tone="active" />
        <Pill label={request.invite_mode} tone="neutral" />
      </View>
      <View style={memberStyles.metricsGrid}>
        <MetricTile label="Contribution" value={formatCurrency(request.contribution_amount)} />
        <MetricTile label="Accepted" value={`${data.accepted_participant_count}/${request.min_members}`} helper={`${data.remaining_slots} slots left`} tone={canSubmit ? 'good' : 'neutral'} />
      </View>
      {request.status === 'PendingApproval' ? (
        <StatusBanner tone="success" title="Submitted for admin approval" body="An admin can now review the request and create the canonical Equb group." />
      ) : null}
      {request.status === 'Approved' ? (
        <StatusBanner tone="success" title="Approved" body="Admin approval created the canonical Equb group. It is now available as an active cycle." />
      ) : null}
      {request.status === 'Rejected' ? (
        <StatusBanner tone="danger" title="Request was not approved" body={request.rejection_reason ?? 'Review the reason and create a revised request when ready.'} />
      ) : null}
      {request.status === 'Forming' && acceptedRemaining > 0 ? (
        <StatusBanner tone="info" title={`${acceptedRemaining} more accepted member${acceptedRemaining === 1 ? '' : 's'} needed`} body="Invite participants or accept public join requests before submitting this group for admin approval." />
      ) : null}
      {canInvite ? (
        <SectionCard>
          <Text style={memberStyles.sectionTitle}>Invite participant</Text>
          <InputField label="Phone or Student ID" value={inviteTarget} onChangeText={setInviteTarget} leadingIcon="person-add" />
          <PrimaryCTA label="Create Invitation" onPress={handleInvite} loading={inviteFormation.isPending} disabled={inviteFormation.isPending} />
        </SectionCard>
      ) : null}
      <SectionCard>
        <Text style={memberStyles.sectionTitle}>Join requests</Text>
        <View style={memberStyles.listGroup}>
          {!pendingRequests.length ? (
            <Text style={memberStyles.mutedText}>No pending participant requests.</Text>
          ) : pendingRequests.map(join => (
            <View key={join.id} style={memberStyles.itemBlock}>
              <ListRow title={`Member ${join.user_id.slice(-4)}`} subtitle={join.decision_reason ?? 'Awaiting creator decision'} leadingIcon="person" />
              <View style={memberStyles.twoCol}>
                <SecondaryCTA label="Accept" onPress={() => handleAccept(join.id)} loading={acceptFormationJoin.isPending} />
                <SecondaryCTA label="Remove" onPress={() => handleRemove(join.id)} loading={removeFormationParticipant.isPending} />
              </View>
            </View>
          ))}
        </View>
      </SectionCard>
      {data.invitations.length ? (
        <SectionCard variant="soft">
          <Text style={memberStyles.sectionTitle}>Invitations</Text>
          <View style={memberStyles.listGroup}>
            {data.invitations.map(invitation => (
              <ListRow
                key={invitation.id}
                title={invitation.invited_phone_or_student_id ?? invitation.invite_code ?? 'Invitation'}
                subtitle={invitation.invite_code ? `Code ${invitation.invite_code}` : 'Direct invitation'}
                right={<Pill label={invitation.status} tone={invitation.status === 'Accepted' ? 'good' : invitation.status === 'Pending' ? 'warn' : 'neutral'} />}
                leadingIcon="mail"
              />
            ))}
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
        label={request.status === 'PendingApproval' ? 'Waiting For Admin' : request.status === 'Approved' ? 'Approved' : 'Submit For Approval'}
        onPress={handleSubmit}
        loading={submitFormationForApproval.isPending}
        disabled={!canSubmit || submitFormationForApproval.isPending || request.status !== 'Forming'}
      />
    </ScreenScroll>
  );
}
