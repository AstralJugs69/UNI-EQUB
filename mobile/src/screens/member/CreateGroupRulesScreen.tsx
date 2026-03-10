import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, Pill, PrimaryCTA, ScreenScroll, SectionCard, TopAppBar, TitleBlock } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useMemberActions } from '../../hooks/useAppQueries';
import { memberStyles } from './styles';

export function CreateGroupRulesScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { createGroup } = useMemberActions();
  const [description, setDescription] = useState('Weekly savings circle for verified AAU students with automatic draw and payout tracking.');
  const [error, setError] = useState('');

  async function handleSubmit() {
    try {
      setError('');
      await createGroup.mutateAsync({
        groupName: route.params.groupName,
        amount: route.params.amount,
        frequency: route.params.frequency,
        maxMembers: route.params.maxMembers,
        description,
      });
      navigation.navigate(routes.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit the group request.');
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Create New Equb" subtitle="Step 2 of 2" onBack={() => navigation.goBack()} />
      <TitleBlock title="Finalize the request" subtitle="Add a short member-facing summary and review the automation rules before you submit for approval." />
      <SectionCard>
        <InputField label="Short Description" value={description} onChangeText={setDescription} multiline helper="This appears in the browse and detail views once the group is approved." />
      </SectionCard>
      <SectionCard variant="soft">
        <TitleBlock title="Built-in automation" subtitle="These behaviors are fixed for the MVP and apply automatically after approval." />
        <View style={memberStyles.rowWrap}>
          <Pill label="Auto draw" tone="active" />
          <Pill label="Reminder queue" tone="active" />
          <Pill label="Immutable ledger" tone="neutral" />
        </View>
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA label="Submit For Approval" onPress={handleSubmit} loading={createGroup.isPending} disabled={!description || createGroup.isPending} />
    </ScreenScroll>
  );
}
