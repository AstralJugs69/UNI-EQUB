import React, { useState } from 'react';
import { Alert } from 'react-native';
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
      navigation.navigate(routes.memberTabs, { screen: routes.wallet, params: { flash: 'Payout clearance recorded.' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record this payout clearance.');
    }
  }

  function confirmWithdraw() {
    Alert.alert('Confirm payout clearance', 'Record this released payout as cleared from your UniEqub wallet?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm Clearance', style: 'destructive', onPress: () => { handleWithdraw().catch(() => undefined); } },
    ]);
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Withdraw Payout" onBack={() => navigation.goBack()} rightLabel="Winner" />
      <TitleBlock title={formatCurrency(data.readyPayout)} subtitle={`Destination - ${data.defaultDestination}`} />
      <StatusBanner tone="info" title="Released payout only" body="This action records the released payout as cleared. Reserved funds remain locked until their scheduled release." />
      {data.reservedPayout > 0 ? (
        <StatusBanner tone="info" title="Reserve remains scheduled." body={`${formatCurrency(data.reservedPayout)} is still reserved across ${data.pendingReserveReleases} future release${data.pendingReserveReleases === 1 ? '' : 's'}. It is not part of this clearance.`} />
      ) : null}
      <SectionCard>
        <TitleBlock title="Before you continue" subtitle="Confirm only after the released payout has been handled. This does not touch reserved payout balances." />
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA label="Confirm Payout Clearance" onPress={confirmWithdraw} loading={withdrawPayout.isPending} disabled={withdrawPayout.isPending || data.readyPayout <= 0} />
      <SecondaryCTA label="Back To Wallet" onPress={() => navigation.goBack()} />
    </ScreenScroll>
  );
}
