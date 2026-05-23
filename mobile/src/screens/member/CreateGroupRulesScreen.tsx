import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FormationErrorBanner } from '../../components/AppErrors';
import { Icon } from '../../components/Icon';
import { InlineError, InputField, MetricTile, PrimaryCTA, ScreenScroll, SectionCard, SegmentedTabs, StatusBanner, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useMemberActions } from '../../hooks/useAppQueries';
import { iconSize, palette } from '../../theme/tokens';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

function CreationProgress() {
  return (
    <SectionCard style={memberStyles.creationProgressCard}>
      <View style={memberStyles.creationStepRow}>
        <View style={memberStyles.creationStep}>
          <View style={memberStyles.creationStepTop}>
            <View style={[memberStyles.creationStepDot, memberStyles.creationStepDotActive]}>
              <Text style={[memberStyles.creationStepNumber, memberStyles.creationStepNumberActive]}>1</Text>
            </View>
            <Text style={memberStyles.creationStepLabel}>Basics</Text>
          </View>
          <Text style={memberStyles.creationStepHelper}>Group shape is ready</Text>
        </View>
        <View style={memberStyles.creationStepLine} />
        <View style={memberStyles.creationStep}>
          <View style={memberStyles.creationStepTop}>
            <View style={[memberStyles.creationStepDot, memberStyles.creationStepDotActive]}>
              <Text style={[memberStyles.creationStepNumber, memberStyles.creationStepNumberActive]}>2</Text>
            </View>
            <Text style={memberStyles.creationStepLabel}>Rules</Text>
          </View>
          <Text style={memberStyles.creationStepHelper}>Decide how joining starts</Text>
        </View>
      </View>
    </SectionCard>
  );
}

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[memberStyles.formationActionButton, selected && memberStyles.formationActionButtonPrimary]}
    >
      <Text style={[memberStyles.formationActionButtonText, selected && memberStyles.formationActionButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

export function CreateGroupRulesScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { createFormation } = useMemberActions();
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'Public' | 'Private'>('Public');
  const [privateRiskAccepted, setPrivateRiskAccepted] = useState(false);
  const [minMembers, setMinMembers] = useState(String(Math.min(5, route.params?.maxMembers ?? 5)));
  const [joinWindowHours, setJoinWindowHours] = useState('72');
  const [gracePeriodHours, setGracePeriodHours] = useState('6');
  const [error, setError] = useState('');
  const parsedMinMembers = Number(minMembers || 0);
  const parsedJoinWindowHours = Number(joinWindowHours || 0);
  const parsedGracePeriodHours = Number(gracePeriodHours || 0);
  const maxMembers = Number(route.params.maxMembers || 0);
  const amount = Number(route.params.amount || 0);

  const firstCyclePot = useMemo(() => amount * maxMembers, [amount, maxMembers]);

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
        amount,
        frequency: route.params.frequency,
        minMembers: parsedMinMembers,
        maxMembers,
        visibility,
        inviteMode: visibility === 'Public' ? 'PublicRequest' : 'InviteCodeAndDirect',
        vestingEnabled: visibility === 'Public',
        riskWarningAccepted: visibility === 'Private' ? privateRiskAccepted : undefined,
        gracePeriodHours: parsedGracePeriodHours,
        joinWindowHours: parsedJoinWindowHours,
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
      <CreationProgress />
      <View style={memberStyles.previewHeroCard}>
        <View style={memberStyles.previewHeroTitleRow}>
          <Text style={memberStyles.previewHeroTitle}>{route.params.groupName}</Text>
          <View style={memberStyles.formationHubIcon}>
            <Icon name="rule" size={iconSize.md} color={palette.primary} />
          </View>
        </View>
        <Text style={memberStyles.previewHeroBody}>Set the rules members see before they request to join. The group enters admin review first, then opens a join window before contributions begin.</Text>
        <View style={memberStyles.metricsGrid}>
          <MetricTile label="Contribution" value={formatCurrency(amount)} />
          <MetricTile label="First Pot" value={formatCurrency(firstCyclePot)} helper={`${maxMembers} members`} tone="active" />
          <MetricTile label="Frequency" value={route.params.frequency} />
        </View>
      </View>
      <SectionCard>
        <Text style={memberStyles.sectionTitle}>Member-facing summary</Text>
        <InputField label="Short Description" value={description} onChangeText={setDescription} multiline helper="Keep it specific: audience, purpose, and contribution expectation." />
      </SectionCard>
      <SectionCard variant="soft">
        <Text style={memberStyles.sectionTitle}>Joining rules</Text>
        <InputField label="Minimum Members" value={minMembers} onChangeText={setMinMembers} keyboardType="number-pad" leadingIcon="group" />
        <InputField label="Join Window" value={joinWindowHours} onChangeText={setJoinWindowHours} keyboardType="number-pad" leadingIcon="hourglass-empty" helper="Hours after approval before contributions and draws begin." />
        <View style={memberStyles.formationActionStrip}>
          {['24', '72', '168'].map(value => (
            <OptionChip key={value} label={`${value}h`} selected={joinWindowHours === value} onPress={() => setJoinWindowHours(value)} />
          ))}
        </View>
        <InputField label="Late Grace Period" value={gracePeriodHours} onChangeText={setGracePeriodHours} keyboardType="number-pad" leadingIcon="schedule" helper="Hours after the contribution deadline before default handling begins." />
        <View style={memberStyles.formationActionStrip}>
          {['6', '12', '24'].map(value => (
            <OptionChip key={value} label={`${value}h grace`} selected={gracePeriodHours === value} onPress={() => setGracePeriodHours(value)} />
          ))}
        </View>
      </SectionCard>
      <SectionCard variant="soft">
        <Text style={memberStyles.sectionTitle}>Visibility</Text>
        <SegmentedTabs
          options={[
            { key: 'Public', label: 'Public' },
            { key: 'Private', label: 'Private' },
          ]}
          selectedKey={visibility}
          onSelect={handleVisibilitySelect}
        />
        <StatusBanner
          tone={visibility === 'Private' ? 'warning' : 'info'}
          title={visibility === 'Private' ? 'Private invite group' : 'Public request'}
          body={visibility === 'Private'
            ? 'Private groups skip admin discovery and should only be used for trusted circles.'
            : 'Members can discover the request in Explore, then you accept or reject each participant.'}
        />
      </SectionCard>
      <SectionCard variant="soft">
        <Text style={memberStyles.sectionTitle}>Lifecycle preview</Text>
        <View style={memberStyles.listGroup}>
          <StatusBanner tone="info" title="1. Gather requests" body="Members request to join and the creator accepts participants." />
          <StatusBanner tone="info" title="2. Admin review" body="Public groups are checked before they become joinable." />
          <StatusBanner tone="success" title="3. Join window" body="Approved groups wait for the configured time, or start instantly if max members join." />
        </View>
      </SectionCard>
      {parsedMinMembers > maxMembers ? (
        <InlineError message="Minimum members cannot be greater than max members." />
      ) : parsedMinMembers < 5 ? (
        <InlineError message="Current Phase 2 policy requires at least 5 accepted members before admin submission." />
      ) : parsedJoinWindowHours < 1 || parsedJoinWindowHours > 168 ? (
        <InlineError message="Join window must be between 1 and 168 hours." />
      ) : parsedGracePeriodHours < 1 || parsedGracePeriodHours > 72 ? (
        <InlineError message="Grace period must be between 1 and 72 hours." />
      ) : null}
      <FormationErrorBanner error={error} />
      <PrimaryCTA
        label="Create Request And Manage Participants"
        onPress={handleSubmit}
        loading={createFormation.isPending}
        disabled={parsedMinMembers < 5 || parsedMinMembers > maxMembers || parsedJoinWindowHours < 1 || parsedJoinWindowHours > 168 || parsedGracePeriodHours < 1 || parsedGracePeriodHours > 72 || (visibility === 'Private' && !privateRiskAccepted) || createFormation.isPending}
      />
    </ScreenScroll>
  );
}
