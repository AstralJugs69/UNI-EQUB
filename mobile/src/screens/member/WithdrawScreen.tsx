import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { InlineError, LoadingState, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useMemberActions, useWalletQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { formatCurrency } from './shared';

export function WithdrawScreen() {
  const navigation = useNavigation<any>();
  const { data } = useWalletQuery();
  const { withdrawPayout } = useMemberActions();
  const [error, setError] = useState('');

  if (!data) {
    return <LoadingState title="Loading payout" subtitle="Preparing withdrawal details." />;
  }

  async function handleWithdraw() {
    try {
      setError('');
      await withdrawPayout.mutateAsync();
      navigation.navigate(routes.wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to clear the wallet payout.');
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Withdraw Payout" onBack={() => navigation.goBack()} rightLabel="Winner" />
      <TitleBlock title={formatCurrency(data.readyPayout)} subtitle={`Destination • ${data.defaultDestination}`} />
      <StatusBanner tone="warning" title="Internal clearance only" body="This capstone build does not send money through an external payout gateway. The action clears only the released payout amount from the internal ledger." />
      {data.reservedPayout > 0 ? (
        <StatusBanner tone="info" title="Reserve remains scheduled." body={`${formatCurrency(data.reservedPayout)} is still reserved across ${data.pendingReserveReleases} future release${data.pendingReserveReleases === 1 ? '' : 's'}. It is not part of this clearance.`} />
      ) : null}
      <SectionCard>
        <TitleBlock title="Before you continue" subtitle="Clear only amounts that are visible as ready payout. Reserved payout releases later after successful contribution obligations." />
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA label="Clear Wallet Balance" onPress={handleWithdraw} loading={withdrawPayout.isPending} disabled={withdrawPayout.isPending || data.readyPayout <= 0} />
      <SecondaryCTA label="Back To Wallet" onPress={() => navigation.goBack()} />
    </ScreenScroll>
  );
}
