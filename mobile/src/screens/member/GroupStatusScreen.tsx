import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmptyState, ListRow, LoadingState, Pill, PrimaryCTA, ScreenScroll, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useDashboardQuery, useGroupStatusQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { memberStyles } from './styles';

export function GroupStatusScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data: dashboard } = useDashboardQuery();
  const groupId = route.params?.groupId ?? dashboard?.currentGroup?.Group_ID ?? '';
  const { data: status } = useGroupStatusQuery(groupId);

  if (!status) {
    return <LoadingState title="Loading group" subtitle="Pulling round progress, payment status, and winner history." />;
  }

  const progressTone = status.paidCount === status.totalMembers ? 'good' : status.isFrozen ? 'bad' : 'warn';

  return (
    <ScreenScroll>
      <TopAppBar title={status.group.Group_Name} onBack={() => navigation.goBack()} rightLabel={status.group.Status} />
      <SectionCard>
        <View style={memberStyles.rowWrap}>
          <Pill label={`Round ${status.currentRound?.Round_Number ?? '-'}`} tone="active" />
          <Pill label={status.paidCount === status.totalMembers ? 'Auto-drawing' : status.isFrozen ? 'Frozen' : 'Waiting'} tone={progressTone} />
        </View>
        <TitleBlock title={`${status.paidCount} of ${status.totalMembers} paid`} subtitle="Progress updates from verified contribution records only." />
      </SectionCard>
      {status.isFrozen ? <StatusBanner tone="danger" title="This group is currently frozen." body="Payments and round advancement stay paused until the compliance review is lifted." /> : null}
      <SectionCard>
        <Text style={memberStyles.sectionTitle}>Round behavior</Text>
        <View style={memberStyles.listGroup}>
          <ListRow title="All verified contributions lock the round" subtitle="The round closes only when every active member is paid." leadingIcon="lock-clock" />
          <ListRow title="Winner selection is automatic" subtitle="The draw runs server-side as soon as the round is complete." leadingIcon="casino" />
          <ListRow title="Payout record is created immediately" subtitle="The winner sees a pending payout in the wallet after the draw." leadingIcon="account-balance-wallet" />
        </View>
      </SectionCard>
      <SectionCard variant="soft">
        <Text style={memberStyles.sectionTitle}>Winner history</Text>
        {status.winnerHistory.length ? (
          <View style={memberStyles.listGroup}>
            {status.winnerHistory.map(item => (
              <ListRow key={`${item.roundNumber}-${item.winnerName}`} title={`Round ${item.roundNumber}`} subtitle={item.winnerName} leadingIcon="emoji-events" />
            ))}
          </View>
        ) : (
          <EmptyState icon="hourglass-top" title="No winners yet" subtitle="Winner history starts populating after the first round closes." />
        )}
      </SectionCard>
      <PrimaryCTA label={status.canCurrentUserPay ? 'Pay Contribution' : 'Contribution Not Available'} onPress={() => navigation.navigate(routes.payment, { groupId: status.group.Group_ID })} disabled={!status.canCurrentUserPay} />
    </ScreenScroll>
  );
}
