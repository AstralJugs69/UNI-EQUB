import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useMemberActions } from '../../hooks/useAppQueries';
import { useAuth } from '../../providers/AuthProvider';
import type { GroupFormationDetail } from '../../types/domain';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

export function FormationJoinCodeScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { acceptFormationInviteCode, lookupFormationInviteCode } = useMemberActions();
  const [inviteCode, setInviteCode] = useState('');
  const [preview, setPreview] = useState<GroupFormationDetail | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const normalizedCode = inviteCode.trim().toUpperCase();
  const routeInviteCode = String(route?.params?.inviteCode ?? '').trim().toUpperCase();
  const currentUserJoin = useMemo(
    () => preview?.joinRequests.find(item => item.user_id === session?.user.userId) ?? null,
    [preview?.joinRequests, session?.user.userId],
  );

  useEffect(() => {
    if (!routeInviteCode) {
      return;
    }
    let cancelled = false;
    setInviteCode(routeInviteCode);
    setError('');
    setSuccess('');
    setPreview(null);
    lookupFormationInviteCode.mutateAsync(routeInviteCode)
      .then(detail => {
        if (!cancelled) {
          setPreview(detail);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to find that invite code.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [routeInviteCode]);

  if (!session) {
    return <LoadingState title="Loading session" subtitle="Preparing invite-code joining." />;
  }

  async function handleLookup() {
    try {
      setError('');
      setSuccess('');
      const detail = await lookupFormationInviteCode.mutateAsync(normalizedCode);
      setPreview(detail);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Unable to find that invite code.');
    }
  }

  async function handleAccept() {
    if (!preview) {
      return;
    }
    try {
      setError('');
      setSuccess('');
      const detail = await acceptFormationInviteCode.mutateAsync({
        inviteCode: normalizedCode,
        acceptedTermsVersion: preview.groupRequest.terms_version,
      });
      setPreview(detail);
      setSuccess('Invite accepted. You are in the forming group.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join with that invite code.');
    }
  }

  const request = preview?.groupRequest;
  const alreadyAccepted = currentUserJoin?.status === 'Accepted';
  const remainingSlots = preview?.remaining_slots ?? 0;
  const canAccept = request?.status === 'Forming'
    && !alreadyAccepted
    && remainingSlots > 0
    && !acceptFormationInviteCode.isPending;

  return (
    <ScreenScroll>
      <TopAppBar title="Join With Code" onBack={() => navigation.goBack()} />
      <TitleBlock title="Enter invite code" subtitle="Preview the forming group before accepting the current terms." />
      {success ? <StatusBanner tone="success" title={success} /> : null}
      <SectionCard>
        <InputField
          label="Invite Code"
          value={inviteCode}
          onChangeText={value => {
            setInviteCode(value.toUpperCase());
            setPreview(null);
          }}
          autoCapitalize="characters"
          leadingIcon="key"
        />
        <PrimaryCTA
          label="Preview Group"
          onPress={handleLookup}
          loading={lookupFormationInviteCode.isPending}
          disabled={!normalizedCode || lookupFormationInviteCode.isPending}
        />
      </SectionCard>

      {request && preview ? (
        <SectionCard variant="soft">
          <View style={memberStyles.rowWrap}>
            <Pill label={request.status} tone={request.status === 'Forming' ? 'good' : 'warn'} />
            <Pill label={request.visibility} tone="neutral" />
            <Pill label={request.frequency} tone="active" />
          </View>
          <Text style={memberStyles.sectionTitle}>{request.proposed_group_name}</Text>
          {request.description ? <Text style={memberStyles.mutedText}>{request.description}</Text> : null}
          <View style={memberStyles.metricsGrid}>
            <MetricTile label="Contribution" value={formatCurrency(request.contribution_amount)} />
            <MetricTile
              label="Accepted"
              value={`${preview.accepted_participant_count}/${request.min_members}`}
              helper={`${preview.remaining_slots} slots left`}
              tone={preview.accepted_participant_count >= request.min_members ? 'good' : 'neutral'}
            />
          </View>
          <ListRow title="Terms" subtitle={request.terms_version} leadingIcon="rule" />
          {alreadyAccepted ? (
            <StatusBanner tone="success" title="You are accepted" body="This invite code has already added you to the forming group." />
          ) : (
            <PrimaryCTA
              label="Accept Terms And Join"
              onPress={handleAccept}
              loading={acceptFormationInviteCode.isPending}
              disabled={!canAccept}
            />
          )}
        </SectionCard>
      ) : null}

      <InlineError message={error} />
    </ScreenScroll>
  );
}
