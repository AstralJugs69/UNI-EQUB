import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { AuthErrorBanner } from '../../components/AppErrors';
import { InputField, PrimaryCTA, ScreenScroll, SecondaryCTA, SegmentedTabs, StatusBanner, SplitPhoneField, TitleBlock, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { authStyles } from './styles';

export function ResetPasswordScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { getOtpGate, requestOtp, requestPasswordResetEmail, resetPassword } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(route?.params?.phoneNumber ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'Otp' | 'Email'>('Email');
  const [requiresOtp, setRequiresOtp] = useState<boolean | null>(null);
  const [sentCode, setSentCode] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRequiresOtp(null);
    setSentCode(false);
    setOtp('');
    setEmailCode('');
    setSuccess('');
    setError('');
  }, [phoneNumber, verificationMethod]);

  async function prepareVerification() {
    try {
      setSubmitting(true);
      setError('');
      if (verificationMethod === 'Email') {
        await requestPasswordResetEmail(phoneNumber);
        setRequiresOtp(false);
        setSentCode(true);
        setSuccess('Email code sent. Enter it below to reset this password.');
        return;
      }
      const gate = await getOtpGate({ phoneNumber });
      setRequiresOtp(gate.requiresOtp);
      if (gate.requiresOtp) {
        await requestOtp(phoneNumber);
        setSentCode(true);
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
      await resetPassword(phoneNumber, newPassword, {
        method: verificationMethod,
        otp: verificationMethod === 'Otp' && requiresOtp ? otp : undefined,
        emailCode: verificationMethod === 'Email' ? emailCode : undefined,
      });
      setSuccess('Password reset. Sign in with the new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  const canReset = !!phoneNumber
    && !!newPassword
    && requiresOtp !== null
    && (verificationMethod === 'Email' ? !!emailCode : (!requiresOtp || !!otp));

  return (
    <ScreenScroll contentStyle={authStyles.centeredContent}>
      <TopAppBar title="Reset Password" onBack={() => navigation.goBack()} />
      <TitleBlock title="Recover your account securely" subtitle="Choose email code or phone OTP, then set a new password." />
      <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
      <SegmentedTabs
        selectedKey={verificationMethod}
        onSelect={key => setVerificationMethod(key as 'Otp' | 'Email')}
        options={[
          { key: 'Email', label: 'Email code' },
          { key: 'Otp', label: 'Phone OTP' },
        ]}
      />
      <InputField label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry leadingIcon="lock" />
      {verificationMethod === 'Email' && sentCode ? <InputField label="Email Code" value={emailCode} onChangeText={setEmailCode} keyboardType="number-pad" leadingIcon="mark-email-read" /> : null}
      {verificationMethod === 'Otp' && requiresOtp ? <InputField label="OTP Code" value={otp} onChangeText={setOtp} keyboardType="number-pad" leadingIcon="password" /> : null}
      {verificationMethod === 'Otp' && requiresOtp === false ? <StatusBanner tone="info" title="OTP not required" body="Only the first registered test account is OTP-gated for this flow." /> : null}
      {verificationMethod === 'Otp' && sentCode ? <StatusBanner tone="info" title="OTP required" body="Only the first registered test account must confirm OTP before reset." /> : null}
      {verificationMethod === 'Email' && sentCode ? <StatusBanner tone="info" title="Check your email" body="Enter the 6-digit code from the UniEqub password reset email." /> : null}
      {success ? <StatusBanner tone="success" title={success} /> : null}
      <AuthErrorBanner error={error} />
      {requiresOtp === null ? (
        <PrimaryCTA label={verificationMethod === 'Email' ? 'Send Email Code' : 'Continue With OTP'} onPress={prepareVerification} loading={submitting} disabled={!phoneNumber || submitting} />
      ) : (
        <PrimaryCTA label="Reset Password" onPress={handleReset} loading={submitting} disabled={!canReset || submitting} />
      )}
      <SecondaryCTA label="Return To Login" onPress={() => navigation.navigate(routes.login)} />
    </ScreenScroll>
  );
}
