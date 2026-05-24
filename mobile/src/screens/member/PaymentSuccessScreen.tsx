import React from 'react';
import { Text, View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { Pill, PrimaryCTA, ScreenScroll, SectionCard, SecondaryCTA, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { iconSize, palette } from '../../theme/tokens';
import type { PaymentMethod } from '../../types/domain';
import { paymentMethodLabel } from './shared';
import { memberStyles } from './styles';

export function PaymentSuccessScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const payoutAmount = route.params?.payoutAmount ?? 0;
  const amount = route.params?.amount ?? 0;
  const method: PaymentMethod = route.params?.method ?? 'Telebirr';
  const receiptRef = route.params?.receiptRef ?? 'TXN-882913';
  const groupId = route.params?.groupId ?? '';
  const resetToGroup = () => {
    navigation.dispatch(CommonActions.reset({
      index: 1,
      routes: [
        { name: routes.memberTabs },
        { name: routes.groupStatus, params: { groupId } },
      ],
    }));
  };

  if (!groupId) {
    return (
      <ScreenScroll>
        <TopAppBar title="Contribution Recorded" onBack={() => navigation.navigate(routes.memberTabs, { screen: routes.dashboard })} rightLabel="Success" />
        <StatusBanner tone="warning" title="Group context missing" body="The payment was recorded, but no group was attached to this success route. Open Home to continue." />
        <PrimaryCTA label="Back To Home" onPress={() => navigation.navigate(routes.memberTabs, { screen: routes.dashboard })} />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Contribution Recorded" onBack={resetToGroup} rightLabel="Success" />
      <SectionCard style={memberStyles.paymentSuccessHero}>
        <View style={memberStyles.transactionHeroIconWrap}>
          <View style={memberStyles.transactionHeroIcon}>
            <Icon name="check-circle" size={iconSize.lg} color={palette.success} />
          </View>
        </View>
        <Pill label="Contribution - Successful" tone="good" />
        <Text style={memberStyles.transactionHeroAmount}>{amount.toLocaleString()} ETB</Text>
        <Text style={memberStyles.transactionHeroSubtitle}>Round contribution recorded</Text>
        <Text style={memberStyles.paymentSuccessReference}>Reference {receiptRef}</Text>
      </SectionCard>
      {route.params?.autoDrawTriggered ? (
        <StatusBanner tone="success" title="This payment completed the round." body={`Winner selection happened automatically. The payout total is ${payoutAmount.toLocaleString()} ETB; probationary winners may see part of it reserved until later contributions are completed.`} />
      ) : null}
      <SectionCard>
        <TitleBlock title="Round impact" subtitle="Your payment is now visible in the group cycle and in your transaction ledger." />
        <View style={memberStyles.paymentSuccessTimeline}>
          <Pill label={paymentMethodLabel(method)} tone="active" />
          <Text style={memberStyles.mutedText}>Wallet and group history have been updated.</Text>
        </View>
      </SectionCard>
      <PrimaryCTA label="Back To Group Cycle" onPress={resetToGroup} />
      <SecondaryCTA label="View Wallet" onPress={() => navigation.navigate(routes.memberTabs, { screen: routes.wallet })} />
    </ScreenScroll>
  );
}
