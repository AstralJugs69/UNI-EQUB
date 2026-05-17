import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, Pill, PrimaryCTA, ScreenScroll, SectionCard, SegmentedTabs, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useMemberActions } from '../../hooks/useAppQueries';
import { memberStyles } from './styles';

export function CreateGroupRulesScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { createFormation } = useMemberActions();
  const [description, setDescription] = useState('Weekly savings circle for verified AAU students with automatic draw and payout tracking.');
  const [visibility, setVisibility] = useState<'Public' | 'Private'>('Public');
  const [privateRiskAccepted, setPrivateRiskAccepted] = useState(false);
  const [minMembers, setMinMembers] = useState(String(Math.min(5, route.params?.maxMembers ?? 5)));
  const [error, setError] = useState('');
  const parsedMinMembers = Number(minMembers || 0);
  const maxMembers = Number(route.params.maxMembers || 0);

  function handleVisibilitySelect(key: string) {
    if (key === 'Public') {
      setVisibility('Public');
      setPrivateRiskAccepted(false);
      return;
    }

    Alert.alert(
      'Private group risk',
      'Payment vesting is not activated on private groups. Members can receive payouts without the standard reserve schedule, so only use this for trusted invite-only circles.',
      [
        { text: 'Keep Public', style: 'cancel', onPress: () => setVisibility('Public') },
        {
          text: 'Use Private',
          style: 'destructive',
          onPress: () => {
            setVisibility('Private');
            setPrivateRiskAccepted(true);
          },
        },
      ],
    );
  }

  async function handleSubmit() {
    try {
      setError('');
      const detail = await createFormation.mutateAsync({
        groupName: route.params.groupName,
        description,
        amount: route.params.amount,
        frequency: route.params.frequency,
        minMembers: parsedMinMembers,
        maxMembers,
        visibility,
        inviteMode: visibility === 'Public' ? 'PublicRequest' : 'InviteCodeAndDirect',
        vestingEnabled: visibility === 'Public',
        riskWarningAccepted: visibility === 'Private' ? privateRiskAccepted : undefined,
        termsVersion: 'phase2-v1',
      });
      navigation.navigate(routes.formationCreator, { requestId: detail.groupRequest.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the group request.');
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Create New Equb" subtitle="Step 2 of 2" onBack={() => navigation.goBack()} />
      <TitleBlock title="Finalize the request" subtitle="Add member-facing terms, gathering mode, and the minimum group size before inviting participants." />
      <SectionCard>
        <InputField label="Short Description" value={description} onChangeText={setDescription} multiline helper="This appears while gathering members and remains visible once the group starts." />
        <InputField label="Minimum Members" value={minMembers} onChangeText={setMinMembers} keyboardType="number-pad" leadingIcon="group" />
      </SectionCard>
      <SectionCard variant="soft">
        <TitleBlock title="Gathering mode" subtitle="Choose how members can find or join this forming group." />
        <SegmentedTabs
          options={[
            { key: 'Public', label: 'Public' },
            { key: 'Private', label: 'Private' },
          ]}
          selectedKey={visibility}
          onSelect={handleVisibilitySelect}
        />
        {visibility === 'Private' ? (
          <StatusBanner tone="warning" title="Vesting off for private groups" body="Private invite groups start without admin review after the accepted-member minimum is met." />
        ) : null}
      </SectionCard>
      <SectionCard variant="soft">
        <TitleBlock title="Built-in automation" subtitle={visibility === 'Private' ? 'Private groups start as soon as the creator has enough accepted members.' : 'Public groups go through admin approval before they start.'} />
        <View style={memberStyles.rowWrap}>
          <Pill label="Creator review" tone="active" />
          {visibility === 'Public' ? <Pill label="Admin approval" tone="active" /> : <Pill label="Invite-only start" tone="active" />}
          <Pill label={visibility === 'Private' ? 'Canonical group on start' : 'Canonical group on approval'} tone="neutral" />
          <Pill label="Simulated payout reserve" tone="neutral" />
        </View>
      </SectionCard>
      {parsedMinMembers > maxMembers ? (
        <InlineError message="Minimum members cannot be greater than max members." />
      ) : parsedMinMembers < 5 ? (
        <InlineError message="Current Phase 2 policy requires at least 5 accepted members before admin submission." />
      ) : null}
      <InlineError message={error} />
      <PrimaryCTA
        label="Create Formation Request"
        onPress={handleSubmit}
        loading={createFormation.isPending}
        disabled={!description || parsedMinMembers < 5 || parsedMinMembers > maxMembers || (visibility === 'Private' && !privateRiskAccepted) || createFormation.isPending}
      />
    </ScreenScroll>
  );
}
