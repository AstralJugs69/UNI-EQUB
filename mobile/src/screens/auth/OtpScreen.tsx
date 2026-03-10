import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, PrimaryCTA, ScreenScroll, SecondaryCTA, StatusBanner, TitleBlock, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { authStyles } from './styles';

export function OtpScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { pendingLogin, pendingUser, completeLogin, requestOtp, verifyOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const mode = route?.params?.mode ?? 'registration';
  const targetPhone = mode === 'login' ? pendingLogin?.phoneNumber : pendingUser?.phoneNumber;

  async function handleContinue() {
    try {
      if (!targetPhone) {
        throw new Error('No active OTP challenge was found. Start again.');
      }
      setError('');
      setSubmitting(true);
      if (mode === 'login') {
        await completeLogin(otp);
      } else {
        await verifyOtp(targetPhone, otp);
        navigation.navigate(routes.kyc);
      }
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
      <TopAppBar title="Verify Number" onBack={() => navigation.goBack()} />
      <TitleBlock
        title="Enter the verification code"
        subtitle={targetPhone ? `A 4-digit code was sent to ${targetPhone}.` : 'A verification code was sent to your registered phone number.'}
      />
      <InputField label="OTP Code" value={otp} onChangeText={setOtp} keyboardType="number-pad" leadingIcon="password" />
      <StatusBanner
        tone="info"
        title={mode === 'login' ? 'Fresh OTP required for every login.' : 'Phone verification unlocks the KYC step.'}
        body={mode === 'login' ? 'The app signs inactive sessions out after 7 days and asks for OTP again.' : 'After this step, you will capture front ID, back ID, and a selfie.'}
      />
      <InlineError message={error} />
      <View style={authStyles.footerActions}>
        <PrimaryCTA label={mode === 'login' ? 'Complete Sign In' : 'Continue'} onPress={handleContinue} loading={submitting} disabled={!otp || submitting || resending} />
        <SecondaryCTA label="Resend Code" onPress={handleResend} loading={resending} disabled={submitting || resending} />
      </View>
    </ScreenScroll>
  );
}
