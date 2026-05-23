import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthErrorBanner } from '../../components/AppErrors';
import { InputField, PrimaryCTA, ScreenScroll, SecondaryCTA, StatusBanner, TitleBlock, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { authStyles } from './styles';

export function EmailVerificationScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const {
    pendingUser,
    session,
    requestEmailVerification,
    verifyEmail,
    requestOtp,
  } = useAuth();
  const [code, setCode] = useState(route?.params?.code ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const userId = route?.params?.userId ?? pendingUser?.userId ?? session?.user.userId;
  const email = route?.params?.email ?? pendingUser?.email ?? session?.user.email;
  const fromProfile = !!session;

  const subtitle = useMemo(
    () => email ? `We sent a 6-digit verification code and app link to ${email}.` : 'Open the verification email and enter the 6-digit code.',
    [email],
  );

  useEffect(() => {
    if (route?.params?.code) {
      setCode(route.params.code);
    }
  }, [route?.params?.code]);

  if (!userId || !email) {
    const signedInMissingEmail = !!session?.user.userId && !email;
    return (
      <ScreenScroll contentStyle={authStyles.centeredContent}>
        <TopAppBar title="Verify Email" onBack={() => navigation.goBack()} />
        <TitleBlock
          title={signedInMissingEmail ? 'Add an email first' : 'No email verification found'}
          subtitle={signedInMissingEmail
            ? 'Add an email address to your profile, then UniEqub will send a verification code.'
            : 'Create an account or update your profile email first.'}
        />
        {signedInMissingEmail ? (
          <PrimaryCTA label="Add Email Address" onPress={() => navigation.navigate(routes.profileEmail)} />
        ) : (
          <>
            <PrimaryCTA label="Create Account" onPress={() => navigation.navigate(routes.signup)} />
            <SecondaryCTA label="Back To Login" onPress={() => navigation.navigate(routes.login)} />
          </>
        )}
      </ScreenScroll>
    );
  }

  async function handleVerify() {
    try {
      setError('');
      setSuccess('');
      setSubmitting(true);
      const result = await verifyEmail({ userId, code });
      setSuccess('Email verified.');
      if (fromProfile) {
        navigation.navigate(routes.memberTabs, { screen: routes.profile, params: { flash: 'Email verified.' } });
        return;
      }
      if (result.requiresOtp) {
        await requestOtp(pendingUser?.phoneNumber ?? '');
        navigation.navigate(routes.otp);
        return;
      }
      navigation.navigate(routes.kyc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email verification failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      setError('');
      setSuccess('');
      setResending(true);
      await requestEmailVerification({ userId, email });
      setSuccess('A new verification email was sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend the verification email.');
    } finally {
      setResending(false);
    }
  }

  return (
    <ScreenScroll contentStyle={authStyles.centeredContent}>
      <TopAppBar title="Verify Email" onBack={() => navigation.goBack()} />
      <TitleBlock title="Check your email" subtitle={subtitle} />
      {success ? <StatusBanner tone="success" title={success} /> : null}
      <StatusBanner tone="info" title="Email verification comes first" body="After email verification, UniEqub will continue to phone OTP only for the first registered test account, then KYC." />
      <InputField label="Email Code" value={code} onChangeText={setCode} keyboardType="number-pad" leadingIcon="mark-email-read" />
      <AuthErrorBanner error={error} />
      <View style={authStyles.footerActions}>
        <PrimaryCTA label="Verify Email" onPress={handleVerify} loading={submitting} disabled={code.trim().length < 6 || submitting || resending} />
        <SecondaryCTA label="Resend Email" onPress={handleResend} loading={resending} disabled={submitting || resending} />
      </View>
    </ScreenScroll>
  );
}
