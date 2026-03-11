import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, HeroCard, LoadingState, MetricTile, PrimaryCTA, SectionCard, StatusBanner, TopAppBar } from '../../components/ui';
import { useWalletQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { MemberNav, formatCurrency } from './shared';
import { memberStyles } from './styles';

export function WalletScreen() {
  const navigation = useNavigation<any>();
  const { data } = useWalletQuery();

  if (!data) {
    return <LoadingState title="Loading wallet" subtitle="Pulling payout balance and withdrawal state." />;
  }

  return (
    <AppScreen footer={<MemberNav active={routes.wallet} />}>
      <TopAppBar title="Payouts" subtitle="Wallet" rightLabel={data.readyPayout > 0 ? 'Ready' : 'Idle'} />
      <HeroCard>
        <Text style={memberStyles.heroBody}>Available balance</Text>
        <Text style={memberStyles.heroValue}>{formatCurrency(data.balance)}</Text>
        <Text style={memberStyles.heroBody}>{data.readyPayout > 0 ? `${formatCurrency(data.readyPayout)} is ready for wallet clearance after winner selection.` : 'No pending payout right now.'}</Text>
      </HeroCard>
      <SectionCard>
        <View style={memberStyles.metricsGrid}>
          <MetricTile label="Ready Payout" value={formatCurrency(data.readyPayout)} tone={data.readyPayout > 0 ? 'good' : 'neutral'} />
          <MetricTile label="Clearance Path" value={data.defaultDestination} />
        </View>
      </SectionCard>
      {data.readyPayout > 0 ? (
        <StatusBanner tone="success" title="Payout is ready." body="Open the withdrawal screen to clear it from the wallet ledger." />
      ) : (
        <StatusBanner tone="info" title="No payout available right now." body="This area becomes active only after a round draw selects you as winner." />
      )}
      <PrimaryCTA label={data.readyPayout > 0 ? 'Withdraw Payout' : 'Nothing To Withdraw'} onPress={() => navigation.navigate(routes.withdraw)} disabled={data.readyPayout <= 0} />
    </AppScreen>
  );
}
