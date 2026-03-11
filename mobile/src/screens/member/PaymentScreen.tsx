import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, ListRow, LoadingState, MetricTile, PrimaryCTA, ScreenScroll, SecondaryCTA, SegmentedTabs, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useGroupQuery, useMemberActions } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import type { PaymentMethod } from '../../types/domain';
import { formatCurrency, paymentMethodLabel } from './shared';
import { memberStyles } from './styles';

export function PaymentScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data: group } = useGroupQuery(route.params.groupId);
  const { payContribution } = useMemberActions();
  const [method, setMethod] = useState<PaymentMethod>('Telebirr');
  const [error, setError] = useState('');

  if (!group) {
    return <LoadingState title="Loading payment" subtitle="Preparing contribution details and available provider paths." />;
  }
  const safeGroup = group;
  const usesNativeTestFlow = method === 'Telebirr' || method === 'MockUSSD';

  async function handleConfirm() {
    try {
      setError('');
      if (usesNativeTestFlow) {
        navigation.navigate(routes.mockUssd, { groupId: safeGroup.Group_ID, method });
        return;
      }
      const result = await payContribution.mutateAsync({ groupId: safeGroup.Group_ID, method });
      navigation.navigate(routes.paymentSuccess, {
        autoDrawTriggered: result.autoDrawTriggered,
        payoutAmount: result.payoutAmount,
        receiptRef: result.receiptRef,
        amount: result.amount,
        method: result.method,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Contribution payment failed.');
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Pay Contribution" onBack={() => navigation.goBack()} rightLabel={safeGroup.Frequency} />
      <TitleBlock title={formatCurrency(safeGroup.Amount)} subtitle={`${safeGroup.Group_Name} • reference ${safeGroup.Virtual_Acc_Ref}`} />
      <View style={memberStyles.metricsGrid}>
        <MetricTile label="Payment" value={paymentMethodLabel(method)} tone="active" />
        <MetricTile label="Cycle" value={safeGroup.Frequency} />
      </View>
      <SectionCard>
        <TitleBlock title="Choose the payment path" subtitle="Telebirr and USSD Lab both use the same native testing shortcut in this build. Chapa stays separate." />
        <SegmentedTabs
          options={[
            { key: 'Telebirr', label: 'Telebirr' },
            { key: 'MockUSSD', label: 'USSD Lab' },
            { key: 'ChapaSandbox', label: 'Chapa' },
          ]}
          selectedKey={method}
          onSelect={key => setMethod(key as PaymentMethod)}
        />
      </SectionCard>
      {usesNativeTestFlow ? (
        <StatusBanner tone="warning" title="Testing shortcut enabled" body="UniEqub opens *127# natively. The contribution is marked successful when you close the native dialup and return to the app." />
      ) : (
        <SectionCard variant="soft">
          <ListRow title={`${paymentMethodLabel(method)} selected`} subtitle="This provider stays separate from the native *127# testing shortcut." leadingIcon="payments" />
        </SectionCard>
      )}
      <InlineError message={error} />
      <PrimaryCTA label={usesNativeTestFlow ? 'Open Native *127# Test' : `Confirm ${paymentMethodLabel(method)} Payment`} onPress={handleConfirm} loading={payContribution.isPending} disabled={payContribution.isPending} />
      <SecondaryCTA label="Back To Group" onPress={() => navigation.goBack()} disabled={payContribution.isPending} />
    </ScreenScroll>
  );
}
