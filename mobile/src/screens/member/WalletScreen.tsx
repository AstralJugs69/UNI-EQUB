import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { AppScreen, HeroCard, LoadingState, MetricTile, PrimaryCTA, SectionCard, StatusBanner, TopAppBar } from '../../components/ui';
import { useDashboardQuery, useRefreshMemberData, useWalletQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { iconSize, palette } from '../../theme/tokens';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

export function WalletScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data } = useWalletQuery();
  const { data: dashboard } = useDashboardQuery();
  const { refreshing, refreshMemberData } = useRefreshMemberData();

  if (!data) {
    return <LoadingState title="Loading wallet" subtitle="Pulling payout balance and withdrawal state." />;
  }

  return (
    <AppScreen refreshing={refreshing} onRefresh={refreshMemberData}>
      <TopAppBar title="Payouts" subtitle="Wallet" rightLabel={data.readyPayout > 0 ? 'Ready' : data.reservedPayout > 0 ? 'Reserve' : 'Idle'} />
      {route?.params?.flash ? <StatusBanner tone="success" title={route.params.flash} /> : null}
      <HeroCard>
        <Text style={memberStyles.heroBody}>Available balance</Text>
        <Text style={memberStyles.heroValue}>{formatCurrency(data.balance)}</Text>
        <Text style={memberStyles.heroBody}>
          {data.readyPayout > 0
            ? `${formatCurrency(data.readyPayout)} is ready for internal wallet clearance.`
            : data.reservedPayout > 0
              ? `${formatCurrency(data.reservedPayout)} is reserved and releases as later contributions are completed.`
              : 'No pending payout right now.'}
        </Text>
      </HeroCard>
      <SectionCard>
        <View style={memberStyles.metricsGrid}>
          <MetricTile label="Ready Payout" value={formatCurrency(data.readyPayout)} tone={data.readyPayout > 0 ? 'good' : 'neutral'} helper="Available now" />
          <MetricTile label="Reserved" value={formatCurrency(data.reservedPayout)} tone={data.reservedPayout > 0 ? 'warn' : 'neutral'} helper={`${data.pendingReserveReleases} scheduled release${data.pendingReserveReleases === 1 ? '' : 's'}`} />
          <MetricTile label="Clearance Path" value={data.defaultDestination} />
        </View>
      </SectionCard>
      <SectionCard style={memberStyles.walletStateCard}>
        <Text style={memberStyles.sectionTitle}>Payout release state</Text>
        <View style={memberStyles.walletReleaseRow}>
          <View style={[memberStyles.walletReleaseIcon, data.readyPayout > 0 && memberStyles.walletReleaseIconReady]}>
            <Icon name={data.readyPayout > 0 ? 'payments' : 'lock-clock'} size={iconSize.md} color={data.readyPayout > 0 ? palette.success : palette.warning} />
          </View>
          <View style={memberStyles.walletReleaseText}>
            <Text style={memberStyles.walletReleaseTitle}>{data.readyPayout > 0 ? 'Ready to withdraw' : data.reservedPayout > 0 ? 'Reserve still locked' : 'No payout scheduled'}</Text>
            <Text style={memberStyles.walletReleaseBody}>
              {data.readyPayout > 0
                ? `${formatCurrency(data.readyPayout)} can be cleared now.`
                : data.reservedPayout > 0
                  ? `${data.pendingReserveReleases} scheduled release${data.pendingReserveReleases === 1 ? '' : 's'} remain before the reserve is fully available.`
                  : 'Win a round to create a payout and release schedule.'}
            </Text>
          </View>
        </View>
      </SectionCard>
      {dashboard?.reliabilityProfile ? (
        <StatusBanner
          tone={dashboard.reliabilityProfile.public_status === 'Trusted' ? 'success' : dashboard.reliabilityProfile.public_status === 'Restricted' || dashboard.reliabilityProfile.public_status === 'Banned' ? 'danger' : 'info'}
          title={`Reliability: ${dashboard.reliabilityProfile.public_status}`}
          body={`Completed groups: ${dashboard.reliabilityProfile.completed_groups_count}. Late payments: ${dashboard.reliabilityProfile.late_payment_count}. Defaults: ${dashboard.reliabilityProfile.default_count}.`}
        />
      ) : null}
      <PrimaryCTA label={data.readyPayout > 0 ? 'Withdraw Payout' : 'Nothing To Withdraw'} onPress={() => navigation.navigate(routes.withdraw)} disabled={data.readyPayout <= 0} />
    </AppScreen>
  );
}
