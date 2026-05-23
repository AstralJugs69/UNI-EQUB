import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { PaymentErrorBanner } from '../../components/AppErrors';
import { InputField, LoadingState, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner, TopAppBar } from '../../components/ui';
import { useGroupQuery, useGroupStatusQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
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
  const { session, getOtpGate, requestOtp, verifyOtp } = useAuth();
  const groupId = route.params?.groupId ?? '';
  const { data: group } = useGroupQuery(groupId);
  const { data: status } = useGroupStatusQuery(groupId);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [checkingOtp, setCheckingOtp] = useState(true);
  const [otpBusy, setOtpBusy] = useState(false);
  const method: PaymentMethod = 'Telebirr';
  const resetToGroup = () => {
    if (!groupId) {
      navigation.goBack();
      return;
    }
    navigation.dispatch(CommonActions.reset({
      index: 1,
      routes: [
        { name: routes.memberTabs },
        { name: routes.groupStatus, params: { groupId } },
      ],
    }));
  };

  useEffect(() => {
    let cancelled = false;
    async function prepareOtpGate() {
      if (!session?.token) {
        setCheckingOtp(false);
        return;
      }
      try {
        setCheckingOtp(true);
        const gate = await getOtpGate({ token: session.token });
        if (cancelled) {
          return;
        }
        setOtpRequired(gate.requiresOtp);
        setOtpVerified(!gate.requiresOtp);
        if (gate.requiresOtp) {
          await requestOtp(gate.phoneNumber ?? session.user.phoneNumber);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to prepare payment verification.');
        }
      } finally {
        if (!cancelled) {
          setCheckingOtp(false);
        }
      }
    }
    prepareOtpGate();
    return () => {
      cancelled = true;
    };
  }, [getOtpGate, requestOtp, session?.token, session?.user.phoneNumber]);

  async function handleVerifyPaymentOtp() {
    try {
      setOtpBusy(true);
      setError('');
      await verifyOtp(session?.user.phoneNumber ?? '', otp);
      setOtpVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify payment OTP.');
    } finally {
      setOtpBusy(false);
    }
  }

  if (!groupId) {
    return (
      <ScreenScroll>
        <TopAppBar title="Pay Contribution" onBack={() => navigation.navigate(routes.memberTabs, { screen: routes.dashboard })} />
        <StatusBanner tone="warning" title="No group selected" body="Open a group cycle first, then start the payment from that group." />
        <SecondaryCTA label="Back To Home" onPress={() => navigation.navigate(routes.memberTabs, { screen: routes.dashboard })} />
      </ScreenScroll>
    );
  }

  if (!group || !status) {
    return <LoadingState title="Loading payment" subtitle="Preparing Telebirr contribution details." />;
  }
  const safeGroup = group;

  if (!status.currentRound || safeGroup.Status !== 'Active') {
    return (
      <ScreenScroll>
        <TopAppBar title="Pay Contribution" onBack={resetToGroup} rightLabel="Closed" />
        <StatusBanner tone="warning" title="No open round" body="This Equb cycle is not accepting contributions. It may already be completed." />
        <SecondaryCTA label="Back to Group" onPress={resetToGroup} />
      </ScreenScroll>
    );
  }

  if (!status.canCurrentUserPay) {
    return (
      <ScreenScroll>
        <TopAppBar title="Pay Contribution" onBack={resetToGroup} rightLabel="Paid" />
        <StatusBanner tone="success" title="Already paid this round" body="Your contribution is already recorded for the current open round." />
        <SecondaryCTA label="Back to Group" onPress={resetToGroup} />
      </ScreenScroll>
    );
  }

  if (checkingOtp) {
    return <LoadingState title="Checking payment verification" subtitle="Preparing the secure payment gate." />;
  }

  if (otpRequired && !otpVerified) {
    return (
      <ScreenScroll>
        <TopAppBar title="Payment Verification" onBack={resetToGroup} rightLabel="OTP" />
        <StatusBanner tone="info" title="OTP required before payment" body="Only the first registered test account is challenged before opening the payment screen." />
        <SectionCard>
          <InputField label="OTP Code" value={otp} onChangeText={setOtp} keyboardType="number-pad" leadingIcon="password" />
        </SectionCard>
        <PaymentErrorBanner error={error} />
        <PrimaryCTA label="Verify And Continue" onPress={handleVerifyPaymentOtp} loading={otpBusy} disabled={!otp || otpBusy} />
        <SecondaryCTA label="Back to Group" onPress={resetToGroup} />
      </ScreenScroll>
    );
  }

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
      <TopAppBar title="Pay Contribution" onBack={resetToGroup} rightLabel={safeGroup.Frequency} />
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

      <PaymentErrorBanner error={error} />
      <PrimaryCTA label="Pay with Telebirr" icon="open-in-new" onPress={handleTelebirrPay} />
      <SecondaryCTA label="Back to Group" onPress={resetToGroup} />
    </ScreenScroll>
  );
}
