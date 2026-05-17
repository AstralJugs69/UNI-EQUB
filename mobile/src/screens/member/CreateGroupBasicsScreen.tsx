import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InputField, MetricTile, PrimaryCTA, ScreenScroll, SectionCard, SegmentedTabs, TopAppBar, TitleBlock } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

export function CreateGroupBasicsScreen() {
  const navigation = useNavigation<any>();
  const [groupName, setGroupName] = useState('Dorm A Savings Group');
  const [amount, setAmount] = useState('500');
  const [frequency, setFrequency] = useState<'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly'>('Weekly');
  const [maxMembers, setMaxMembers] = useState('10');

  const parsedAmount = Number(amount || 0);
  const parsedMembers = Number(maxMembers || 0);
  const estimatedPot = useMemo(() => parsedAmount * parsedMembers, [parsedAmount, parsedMembers]);

  return (
    <ScreenScroll>
      <TopAppBar title="Create New Equb" subtitle="Step 1 of 2" onBack={() => navigation.goBack()} />
      <TitleBlock title="Set the basics" subtitle="This starts a Phase 2 formation request. The final Equb group is created only after enough members join and an admin approves it." />
      <SectionCard>
        <InputField label="Group Name" value={groupName} onChangeText={setGroupName} leadingIcon="groups" />
        <InputField label="Contribution Amount (ETB)" value={amount} onChangeText={setAmount} keyboardType="number-pad" leadingIcon="payments" />
        <InputField label="Max Members" value={maxMembers} onChangeText={setMaxMembers} keyboardType="number-pad" leadingIcon="group" />
      </SectionCard>
      <SectionCard variant="soft">
        <TitleBlock title="Choose the cadence" subtitle="Keep this simple and consistent for members." />
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
      </View>
      {parsedMembers > 0 && parsedMembers < 5 ? (
        <Text style={memberStyles.mutedText}>Use at least 5 members for the current Phase 2 policy default.</Text>
      ) : null}
      <PrimaryCTA
        label="Continue To Rules"
        onPress={() => navigation.navigate(routes.createRules, { groupName, amount: parsedAmount, frequency, maxMembers: parsedMembers })}
        disabled={!groupName || parsedAmount <= 0 || parsedMembers < 5}
      />
    </ScreenScroll>
  );
}
