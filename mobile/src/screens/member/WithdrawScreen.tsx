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
      <StatusBanner tone="warning" title="Internal clearance only" body="This MVP does not hit an external payout gateway yet. The action clears the approved payout from the wallet ledger until legal payout integration is available." />
      <SectionCard>
        <TitleBlock title="Before you continue" subtitle="Only use this when the payout is already visible in your wallet and approved by the system." />
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA label="Clear Wallet Balance" onPress={handleWithdraw} loading={withdrawPayout.isPending} disabled={withdrawPayout.isPending || data.readyPayout <= 0} />
      <SecondaryCTA label="Back To Wallet" onPress={() => navigation.goBack()} />
    </ScreenScroll>
  );
}
