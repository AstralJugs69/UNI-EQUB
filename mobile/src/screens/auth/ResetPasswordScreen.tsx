import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { AuthErrorBanner } from '../../components/AppErrors';
import { InputField, PrimaryCTA, ScreenScroll, SecondaryCTA, StatusBanner, SplitPhoneField, TitleBlock, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { authStyles } from './styles';

export function ResetPasswordScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { getOtpGate, requestOtp, resetPassword } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(route?.params?.phoneNumber ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [requiresOtp, setRequiresOtp] = useState<boolean | null>(null);
  const [sentOtp, setSentOtp] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRequiresOtp(null);
    setSentOtp(false);
    setOtp('');
    setSuccess('');
    setError('');
  }, [phoneNumber]);

  async function checkGateAndSend() {
    try {
      setSubmitting(true);
      setError('');
      const gate = await getOtpGate({ phoneNumber });
      setRequiresOtp(gate.requiresOtp);
      if (gate.requiresOtp) {
        await requestOtp(phoneNumber);
        setSentOtp(true);
        setSuccess('OTP sent. Enter it below to reset this password.');
      } else {
        setSuccess('This test account can reset without OTP.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to prepare password reset.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    try {
      setSubmitting(true);
      setError('');
      await resetPassword(phoneNumber, newPassword, requiresOtp ? otp : undefined);
      setSuccess('Password reset. Sign in with the new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  const canReset = !!phoneNumber && !!newPassword && requiresOtp !== null && (!requiresOtp || !!otp);

  return (
    <ScreenScroll contentStyle={authStyles.centeredContent}>
      <TopAppBar title="Reset Password" onBack={() => navigation.goBack()} />
      <TitleBlock title="Recover your account securely" subtitle="Enter the phone number, verify OTP only when required, then set a new password." />
      <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
      <InputField label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry leadingIcon="lock" />
      {requiresOtp ? <InputField label="OTP Code" value={otp} onChangeText={setOtp} keyboardType="number-pad" leadingIcon="password" /> : null}
      {requiresOtp === false ? <StatusBanner tone="info" title="OTP not required" body="Only the first registered test account is OTP-gated for this flow." /> : null}
      {sentOtp ? <StatusBanner tone="info" title="OTP required" body="Only the first registered test account must confirm OTP before reset." /> : null}
      {success ? <StatusBanner tone="success" title={success} /> : null}
      <AuthErrorBanner error={error} />
      {requiresOtp === null ? (
        <PrimaryCTA label="Continue" onPress={checkGateAndSend} loading={submitting} disabled={!phoneNumber || submitting} />
      ) : (
        <PrimaryCTA label="Reset Password" onPress={handleReset} loading={submitting} disabled={!canReset || submitting} />
      )}
      <SecondaryCTA label="Return To Login" onPress={() => navigation.navigate(routes.login)} />
    </ScreenScroll>
  );
}
