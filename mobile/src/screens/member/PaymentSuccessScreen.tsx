import React from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Pill, PrimaryCTA, ScreenScroll, SectionCard, SecondaryCTA, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { routes } from '../../navigation/routes';
import type { PaymentMethod } from '../../types/domain';
import { paymentMethodLabel } from './shared';
import { memberStyles } from './styles';

export function PaymentSuccessScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const payoutAmount = route.params?.payoutAmount ?? 0;
  const amount = route.params?.amount ?? 0;
  const method: PaymentMethod = route.params?.method ?? 'Telebirr';
  const receiptRef = route.params?.receiptRef ?? 'TXN-882913';
  const nativeUssdResponse = route.params?.nativeUssdResponse as string | undefined;

  return (
    <ScreenScroll>
      <TopAppBar title="Contribution Recorded" onBack={() => navigation.navigate(routes.groupStatus)} rightLabel="Success" />
      <TitleBlock title="Payment received" subtitle="Your contribution is now visible to the rest of the group and the round state has been updated." align="center" />
      <SectionCard>
        <Pill label={paymentMethodLabel(method)} tone="active" />
        <Text style={memberStyles.sectionTitle}>{amount.toLocaleString()} ETB</Text>
        <Text style={memberStyles.mutedText}>Reference {receiptRef}</Text>
      </SectionCard>
      {route.params?.autoDrawTriggered ? (
        <StatusBanner tone="success" title="This payment completed the round." body={`Winner selection happened automatically and ${payoutAmount.toLocaleString()} ETB is now ready for withdrawal.`} />
      ) : null}
      {nativeUssdResponse ? (
        <SectionCard variant="soft">
          <Text style={memberStyles.sectionTitle}>Carrier response</Text>
          <Text style={memberStyles.mutedText}>{nativeUssdResponse}</Text>
        </SectionCard>
      ) : null}
      <PrimaryCTA label="View Wallet" onPress={() => navigation.navigate(routes.wallet)} />
      <SecondaryCTA label="Back To Group" onPress={() => navigation.navigate(routes.groupStatus)} />
    </ScreenScroll>
  );
}
