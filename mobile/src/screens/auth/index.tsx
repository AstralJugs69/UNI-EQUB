import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InputField, Panel, PrimaryButton, ScreenScroll, SplitPhoneField, TitleBlock, TopBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { palette, radii, spacing } from '../../theme/tokens';

const heroStudents = require('../../assets/students-hero.jpg');

export function SplashScreen() {
  const navigation = useNavigation<any>();
  return (
    <ScreenScroll contentStyle={{ justifyContent: 'center', flexGrow: 1 }}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#eaf4ff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 22 }}>U</Text>
          </View>
          <TitleBlock title="Digitize Your Equb" subtitle="Secure, transparent, and rotating savings designed for university life." align="center" />
        </View>
        <View style={{ height: 220, borderRadius: radii.xl, overflow: 'hidden' }}>
          <Image source={heroStudents} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
        <Panel>
          <Text style={{ color: palette.text, fontWeight: '700' }}>Addis Ababa student circles</Text>
          <Text style={{ color: palette.muted, marginTop: 4 }}>Campus-first rotating savings for trusted groups.</Text>
        </Panel>
        <PrimaryButton label="Get Started" onPress={() => navigation.navigate(routes.login)} />
        <PrimaryButton label="Admin Sign In" variant="secondary" onPress={() => navigation.navigate(routes.login, { roleHint: 'Admin' })} />
      </View>
    </ScreenScroll>
  );
}

export function LoginScreen({ route }: { route?: { params?: { roleHint?: 'Admin' } } }) {
  const navigation = useNavigation<any>();
  const { beginLogin } = useAuth();
  const [role, setRole] = useState<'Member' | 'Admin'>(route?.params?.roleHint === 'Admin' ? 'Admin' : 'Member');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    try {
      setError('');
      setSubmitting(true);
      await beginLogin(phoneNumber, password, role);
      navigation.navigate(routes.otp, { mode: 'login' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll contentStyle={{ justifyContent: 'center', flexGrow: 1 }}>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#eef3f8', borderRadius: radii.lg, padding: 6, gap: 8 }}>
          {(['Member', 'Admin'] as const).map(option => (
            <PrimaryButton
              key={option}
              label={option}
              variant={role === option ? 'primary' : 'secondary'}
              onPress={() => {
                setRole(option);
                setPhoneNumber('');
                setPassword('');
                setError('');
              }}
            />
          ))}
        </View>
        <TitleBlock title={role === 'Admin' ? 'Platform Admin' : 'Welcome Back'} subtitle={role === 'Admin' ? 'Review KYC, approve groups, and oversee automated platform flow.' : 'Sign in to manage your Equb savings securely.'} align="center" />
        <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
        <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Panel>
          <Text style={{ color: palette.muted }}>
            Every login now requires an OTP verification step. Inactive sessions older than 7 days are signed out automatically.
          </Text>
        </Panel>
        {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
        <PrimaryButton label={role === 'Admin' ? 'Send Admin OTP' : 'Send Login OTP'} onPress={handleLogin} loading={submitting} disabled={!phoneNumber || !password} />
        {role === 'Member' ? <PrimaryButton label="Create New Account" variant="secondary" onPress={() => navigation.navigate(routes.signup)} disabled={submitting} /> : null}
      </View>
    </ScreenScroll>
  );
}

export function SignupScreen() {
  const navigation = useNavigation<any>();
  const { register, requestOtp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    try {
      setError('');
      setSubmitting(true);
      await register(fullName, phoneNumber, password);
      await requestOtp(phoneNumber);
      navigation.navigate(routes.otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll>
      <TopBar title="Create Account" onBack={() => navigation.goBack()} rightLabel="Step 1" />
      <TitleBlock title="Start your student savings profile" subtitle="Create an account, verify identity, then join or launch Equb groups." />
      <InputField label="Full Name" value={fullName} onChangeText={setFullName} />
      <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
      <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Panel>
        <Text style={{ color: palette.primaryDark, fontWeight: '800' }}>Student ID upload happens in the next step, after OTP verification.</Text>
      </Panel>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <PrimaryButton label="Create Account" onPress={handleSubmit} loading={submitting} disabled={!fullName || !phoneNumber || !password} />
    </ScreenScroll>
  );
}

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
    <ScreenScroll>
      <TopBar title="Verify Number" onBack={() => navigation.goBack()} />
      <TitleBlock title="Enter the 4-digit code" subtitle={targetPhone ? `We sent a verification code to ${targetPhone}.` : 'We sent a verification code to your registered phone number.'} />
      <InputField label="OTP Code" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
      <Panel>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Code expires in 01:24</Text>
        <Text style={{ color: palette.muted, marginTop: 4 }}>{mode === 'login' ? 'A fresh OTP is required on every login and after automatic 7-day inactivity sign-out.' : 'This OTP verifies your number before KYC submission.'}</Text>
      </Panel>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <PrimaryButton label={mode === 'login' ? 'Complete Sign In' : 'Continue'} onPress={handleContinue} loading={submitting} disabled={!otp || submitting || resending} />
      <PrimaryButton label="Resend Code" variant="secondary" onPress={handleResend} loading={resending} disabled={submitting || resending} />
    </ScreenScroll>
  );
}

export function KycScreen() {
  const { submitPendingKyc, pendingUser } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    try {
      setError('');
      setSubmitting(true);
      const imageRef = `storage://student-ids/${pendingUser?.userId ?? 'pending-user'}/kyc-${Date.now()}.jpg`;
      await submitPendingKyc(imageRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'KYC submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll>
      <TopBar title="KYC Verification" rightLabel="3 steps" />
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: palette.muted, fontWeight: '700' }}>Progress</Text>
        <View style={{ height: 10, borderRadius: 999, backgroundColor: '#e5ebf3', overflow: 'hidden' }}>
          <View style={{ width: '72%', height: '100%', backgroundColor: palette.primary }} />
        </View>
      </View>
      <TitleBlock title="Complete identity review" subtitle="Verification is required before group creation and payout withdrawal." />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {['Front ID', 'Back ID', 'Selfie'].map(label => (
          <Panel key={label} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: palette.primaryDark, fontWeight: '800' }}>{label}</Text>
            <Text style={{ color: palette.muted, marginTop: 6, textAlign: 'center' }}>Ready for secure upload</Text>
          </Panel>
        ))}
      </View>
      <Panel>
        <Text style={{ color: palette.warning, fontWeight: '800' }}>Verification review runs through the admin queue.</Text>
        <Text style={{ color: palette.muted, marginTop: 6 }}>{pendingUser?.fullName ? `${pendingUser.fullName} will be signed into the member workspace after KYC submission.` : 'Your account will move to pending review after submission.'}</Text>
      </Panel>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <PrimaryButton label="Submit For Review" onPress={handleSubmit} loading={submitting} disabled={submitting} />
    </ScreenScroll>
  );
}

export function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const [phoneNumber, setPhoneNumber] = useState('');
  return (
    <ScreenScroll>
      <TopBar title="Reset Password" onBack={() => navigation.goBack()} />
      <TitleBlock title="Recover your account securely" subtitle="Enter the phone number attached to your account and receive a recovery code." />
      <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
      <PrimaryButton label="Send Recovery Code" onPress={() => navigation.navigate(routes.login)} disabled={!phoneNumber} />
      <PrimaryButton label="Return To Login" variant="secondary" onPress={() => navigation.navigate(routes.login)} />
    </ScreenScroll>
  );
}

