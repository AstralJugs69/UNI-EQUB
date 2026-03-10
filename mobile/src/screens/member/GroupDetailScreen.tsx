import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useGroupQuery, useMemberActions } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { formatCurrency, groupStudents } from './shared';
import { memberStyles } from './styles';

export function GroupDetailScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data } = useGroupQuery(route.params?.groupId ?? '');
  const { joinGroup } = useMemberActions();
  const [error, setError] = useState('');

  if (!data) {
    return <LoadingState title="Loading group" subtitle="Pulling membership rules, amount, and round state." />;
  }
  const safeGroup = data;

  async function handleJoin() {
    try {
      setError('');
      await joinGroup.mutateAsync(safeGroup.Group_ID);
      navigation.navigate(routes.groupStatus, { groupId: safeGroup.Group_ID });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join this group right now.');
    }
  }

  const joinDisabled = safeGroup.Status !== 'Active' || joinGroup.isPending;

  return (
    <ScreenScroll>
      <TopAppBar title="Group Details" onBack={() => navigation.goBack()} />
      <View style={memberStyles.imageHeroWrap}>
        <Image source={groupStudents} style={memberStyles.imageHero} resizeMode="cover" />
      </View>
      <TitleBlock title={safeGroup.Group_Name} subtitle={safeGroup.Description} />
      <View style={memberStyles.rowWrap}>
        <Pill label={safeGroup.Status} tone={safeGroup.Status === 'Active' ? 'good' : safeGroup.Status === 'Pending' ? 'warn' : 'bad'} />
        <Pill label={safeGroup.Frequency} tone="active" />
        <Pill label={`${safeGroup.Max_Members} members`} tone="neutral" />
      </View>
      {safeGroup.Status !== 'Active' ? <StatusBanner tone="warning" title="This group is not joinable yet." body="Only active groups can accept new members." /> : null}
      <View style={memberStyles.twoCol}>
        <MetricTile label="Contribution" value={formatCurrency(safeGroup.Amount)} />
        <MetricTile label="Virtual Ref" value={safeGroup.Virtual_Acc_Ref || 'Pending'} helper="Assigned after approval" />
      </View>
      <SectionCard>
        <TitleBlock title="Membership rules" subtitle="These are the expectations every member is accepting before joining." />
        <View style={memberStyles.listGroup}>
          <ListRow title="Verified payment required every round" subtitle="Only paid members are eligible for the draw." leadingIcon="verified" />
          <ListRow title="Winner cannot win twice in the same cycle" subtitle="Previous winners are excluded until the cycle resets." leadingIcon="casino" />
          <ListRow title="Automatic payout creation" subtitle="The payout record is generated immediately after the draw completes." leadingIcon="payments" />
        </View>
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA label={safeGroup.Status === 'Active' ? 'Join Group' : 'Waiting For Approval'} onPress={handleJoin} loading={joinGroup.isPending} disabled={joinDisabled} />
    </ScreenScroll>
  );
}
