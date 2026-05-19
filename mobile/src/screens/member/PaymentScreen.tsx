import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { InlineError, LoadingState, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner, TopAppBar } from '../../components/ui';
import { useGroupQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { iconSize, palette } from '../../theme/tokens';
import type { PaymentMethod } from '../../types/domain';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';

function PaymentMetaTile({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={memberStyles.paymentMetaTile}>
      <View style={memberStyles.paymentMetaIcon}>
        <Icon name={icon} size={iconSize.sm} color={palette.primary} />
      </View>
      <View style={memberStyles.paymentMetaText}>
        <Text style={memberStyles.paymentMetaLabel}>{label}</Text>
        <Text style={memberStyles.paymentMetaValue}>{value}</Text>
      </View>
    </View>
  );
}

export function PaymentScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const groupId = route.params?.groupId ?? '';
  const { data: group } = useGroupQuery(groupId);
  const [error, setError] = useState('');
  const method: PaymentMethod = 'Telebirr';

  if (!groupId) {
    return (
      <ScreenScroll>
        <TopAppBar title="Pay Contribution" onBack={() => navigation.goBack()} />
        <StatusBanner tone="warning" title="No group selected" body="Open a group cycle first, then start the payment from that group." />
        <SecondaryCTA label="Back To Home" onPress={() => navigation.navigate(routes.memberTabs, { screen: routes.dashboard })} />
      </ScreenScroll>
    );
  }

  if (!group) {
    return <LoadingState title="Loading payment" subtitle="Preparing Telebirr contribution details." />;
  }
  const safeGroup = group;

  function handleTelebirrPay() {
    try {
      setError('');
      navigation.navigate(routes.mockUssd, { groupId: safeGroup.Group_ID, method });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Telebirr payment.');
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Pay Contribution" onBack={() => navigation.goBack()} rightLabel={safeGroup.Frequency} />
      <SectionCard style={memberStyles.paymentSummaryCard}>
        <View style={memberStyles.paymentAmountRow}>
          <View style={memberStyles.paymentAmountIcon}>
            <Icon name="account-balance-wallet" size={iconSize.lg} color={palette.primary} />
          </View>
          <View style={memberStyles.paymentAmountText}>
            <Text style={memberStyles.paymentAmount}>{formatCurrency(safeGroup.Amount)}</Text>
            <Text style={memberStyles.paymentGroupName}>{safeGroup.Group_Name}</Text>
            <Text style={memberStyles.paymentReference}>Reference <Text style={memberStyles.paymentReferenceStrong}>{safeGroup.Virtual_Acc_Ref}</Text></Text>
          </View>
        </View>
        <View style={memberStyles.paymentMetaBox}>
          <PaymentMetaTile icon="credit-card" label="Payment method" value="Telebirr" />
          <View style={memberStyles.paymentMetaDivider} />
          <PaymentMetaTile icon="calendar-month" label="Cycle" value={safeGroup.Frequency} />
        </View>
      </SectionCard>

      <SectionCard style={memberStyles.telebirrCard}>
        <View style={memberStyles.telebirrHeader}>
          <View style={memberStyles.telebirrLogo}>
            <Icon name="bolt" size={iconSize.lg} color={palette.primary} />
            <Text style={memberStyles.telebirrLogoText}>telebirr</Text>
          </View>
          <View style={memberStyles.telebirrHeaderText}>
            <Text style={memberStyles.telebirrTitle}>Pay with Telebirr</Text>
            <Text style={memberStyles.telebirrBody}>You will be redirected to Telebirr to complete your contribution securely.</Text>
          </View>
        </View>
        <StatusBanner tone="info" title="Telebirr will open natively" body="You will return to UniEqub after payment confirmation." />
        <StatusBanner tone="warning" title="Testing mode" body="UniEqub opens *127# natively. The contribution is marked successful when you close the native dialup and return to the app." />
      </SectionCard>

      <InlineError message={error} />
      <PrimaryCTA label="Pay with Telebirr" icon="open-in-new" onPress={handleTelebirrPay} />
      <SecondaryCTA label="Back to Group" onPress={() => navigation.navigate(routes.groupStatus, { groupId: safeGroup.Group_ID })} />
    </ScreenScroll>
  );
}
