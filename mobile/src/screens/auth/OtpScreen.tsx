import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, PrimaryCTA, ScreenScroll, SecondaryCTA, StatusBanner, TitleBlock, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { authStyles } from './styles';

export function OtpScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { pendingUser, requestOtp, verifyOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const targetPhone = route?.params?.phoneNumber ?? pendingUser?.phoneNumber;

  if (!targetPhone) {
    return (
      <ScreenScroll contentStyle={authStyles.centeredContent}>
        <TopAppBar title="Verify Phone" onBack={() => navigation.goBack()} />
        <TitleBlock title="No OTP challenge found" subtitle="Create an account first so UniEqub can send the phone verification code." />
        <PrimaryCTA label="Create Account" onPress={() => navigation.navigate(routes.signup)} />
        <SecondaryCTA label="Back To Login" onPress={() => navigation.navigate(routes.login)} />
      </ScreenScroll>
    );
  }

  async function handleContinue() {
    try {
      setError('');
      setSubmitting(true);
      await verifyOtp(targetPhone, otp);
      navigation.navigate(routes.kyc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      if (!targetPhone) {
        throw new Error('No phone number is available for this OTP request.');
      }
      setError('');
      setResending(true);
      await requestOtp(targetPhone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend the OTP');
    } finally {
      setResending(false);
    }
  }

  return (
    <ScreenScroll contentStyle={authStyles.centeredContent}>
      <TopAppBar title="Verify Phone" onBack={() => navigation.goBack()} />
      <TitleBlock
        title="Enter the verification code"
        subtitle={targetPhone ? `A 4-digit code was sent to ${targetPhone}.` : 'A verification code was sent to your registered phone number.'}
      />
      <InputField label="OTP Code" value={otp} onChangeText={setOtp} keyboardType="number-pad" leadingIcon="password" />
      <StatusBanner
        tone="info"
        title="Phone verification unlocks the KYC step."
        body="After this step, you will capture front ID, back ID, and a selfie."
      />
      <InlineError message={error} />
      <View style={authStyles.footerActions}>
        <PrimaryCTA label="Continue" onPress={handleContinue} loading={submitting} disabled={!otp || submitting || resending} />
        <SecondaryCTA label="Resend Code" onPress={handleResend} loading={resending} disabled={submitting || resending} />
      </View>
    </ScreenScroll>
  );
}
