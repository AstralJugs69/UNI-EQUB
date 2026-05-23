import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { InputField, MetricTile, PrimaryCTA, ScreenScroll, SectionCard, SegmentedTabs, StatusBanner, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { iconSize, palette } from '../../theme/tokens';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

function CreationProgress({ activeStep }: { activeStep: 1 | 2 }) {
  const steps = [
    { step: 1, label: 'Basics', helper: 'Amount, size, cadence' },
    { step: 2, label: 'Rules', helper: 'Join window and review' },
  ];

  return (
    <SectionCard style={memberStyles.creationProgressCard}>
      <View style={memberStyles.creationStepRow}>
        {steps.map((item, index) => {
          const active = item.step <= activeStep;
          return (
            <React.Fragment key={item.step}>
              {index > 0 ? <View style={memberStyles.creationStepLine} /> : null}
              <View style={memberStyles.creationStep}>
                <View style={memberStyles.creationStepTop}>
                  <View style={[memberStyles.creationStepDot, active && memberStyles.creationStepDotActive]}>
                    <Text style={[memberStyles.creationStepNumber, active && memberStyles.creationStepNumberActive]}>{item.step}</Text>
                  </View>
                  <Text style={memberStyles.creationStepLabel}>{item.label}</Text>
                </View>
                <Text style={memberStyles.creationStepHelper}>{item.helper}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </SectionCard>
  );
}

export function CreateGroupBasicsScreen() {
  const navigation = useNavigation<any>();
  const [groupName, setGroupName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly'>('Weekly');
  const [maxMembers, setMaxMembers] = useState('');

  const parsedAmount = Number(amount || 0);
  const parsedMembers = Number(maxMembers || 0);
  const estimatedPot = useMemo(() => parsedAmount * parsedMembers, [parsedAmount, parsedMembers]);

  return (
    <ScreenScroll>
      <TopAppBar title="Create New Equb" subtitle="Step 1 of 2" onBack={() => navigation.goBack()} />
      <CreationProgress activeStep={1} />
      <View style={memberStyles.creationHeroCard}>
        <View style={memberStyles.creationHeroTop}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={memberStyles.creationHeroTitle}>Shape the group before inviting anyone</Text>
            <Text style={memberStyles.creationHeroBody}>Choose the contribution, member cap, and cadence. The draw pool locks only after approval and the join window.</Text>
          </View>
          <View style={memberStyles.creationHeroIcon}>
            <Icon name="groups" size={iconSize.lg} color={palette.white} />
          </View>
        </View>
        <View style={memberStyles.creationHeroPill}>
          <Text style={memberStyles.creationHeroPillText}>Creator setup</Text>
        </View>
      </View>
      <SectionCard>
        <InputField label="Group Name" value={groupName} onChangeText={setGroupName} leadingIcon="groups" />
        <InputField label="Contribution Amount (ETB)" value={amount} onChangeText={setAmount} keyboardType="number-pad" leadingIcon="payments" />
        <InputField label="Max Members" value={maxMembers} onChangeText={setMaxMembers} keyboardType="number-pad" leadingIcon="group" />
      </SectionCard>
      <SectionCard variant="soft">
        <Text style={memberStyles.sectionTitle}>Contribution cadence</Text>
        <Text style={memberStyles.mutedText}>This controls each contribution deadline after the group activates.</Text>
        <SegmentedTabs
          options={[
            { key: 'Daily', label: 'Daily' },
            { key: 'Weekly', label: 'Weekly' },
            { key: 'Bi-weekly', label: 'Bi-weekly' },
            { key: 'Monthly', label: 'Monthly' },
          ]}
          selectedKey={frequency}
          onSelect={key => setFrequency(key as 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly')}
        />
      </SectionCard>
      <View style={memberStyles.metricsGrid}>
        <MetricTile label="Contribution" value={formatCurrency(parsedAmount)} />
        <MetricTile label="Estimated Pot" value={formatCurrency(estimatedPot)} helper={`${parsedMembers || 0} members`} tone="active" />
        <MetricTile label="Completion" value="One win each" helper="Then members vote to continue" />
      </View>
      {parsedMembers > 0 && parsedMembers < 5 ? (
        <StatusBanner tone="warning" title="At least 5 members required" body="The current group formation policy requires five accepted members before admin review." />
      ) : null}
      <PrimaryCTA
        label="Continue To Rules"
        onPress={() => navigation.navigate(routes.createRules, { groupName, amount: parsedAmount, frequency, maxMembers: parsedMembers })}
        disabled={!groupName.trim() || parsedAmount <= 0 || parsedMembers < 5}
      />
    </ScreenScroll>
  );
}
