import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthErrorBanner } from '../../components/AppErrors';
import { AppScreen, InputField, PrimaryCTA, SectionCard, SplitPhoneField, SecondaryCTA, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { validateEmail, validateEthiopianPhone, validateFullName, validatePassword } from '../../utils/validation';
import { authStyles } from './styles';

export function SignupScreen() {
  const navigation = useNavigation<any>();
  const { register, requestOtp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ fullName: '', email: '', phoneNumber: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const nextErrors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      phoneNumber: validateEthiopianPhone(phoneNumber),
      password: validatePassword(password),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.fullName || nextErrors.email || nextErrors.phoneNumber || nextErrors.password) {
      return;
    }
    try {
      setError('');
      setSubmitting(true);
      const result = await register(fullName.trim().replace(/\s+/g, ' '), email.trim().toLowerCase(), phoneNumber, password);
      if (result.requiresEmailVerification) {
        navigation.navigate(routes.emailVerify, {
          userId: result.user.userId,
          email: result.user.email,
          requiresOtp: result.requiresOtp,
        });
      } else if (result.requiresOtp) {
        await requestOtp(phoneNumber);
        navigation.navigate(routes.otp);
      } else {
        navigation.navigate(routes.kyc);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppScreen contentStyle={authStyles.signupScreen}>
      <TopAppBar title="Create Account" subtitle="Step 1 of 3" onBack={() => navigation.goBack()} />
      <View style={authStyles.signupProgressWrap}>
        <View style={authStyles.signupProgressTrack}>
          <View style={[authStyles.signupProgressFill, { width: '33%' }]} />
        </View>
        <Text style={authStyles.signupProgressText}>Account details</Text>
      </View>
      <View style={authStyles.signupTitleWrap}>
        <Text style={authStyles.signupTitle}>Start your student savings profile</Text>
        <Text style={authStyles.signupSubtitle}>Create your account first. OTP and KYC happen in the next steps.</Text>
      </View>
      <SectionCard style={authStyles.signupFormCard}>
        <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
        {fieldErrors.phoneNumber ? <Text style={authStyles.loginFieldError}>{fieldErrors.phoneNumber}</Text> : null}
        <InputField label="Email Address" value={email} onChangeText={setEmail} leadingIcon="alternate-email" autoCapitalize="none" keyboardType="email-address" error={fieldErrors.email} />
        <InputField label="Full Name" value={fullName} onChangeText={setFullName} leadingIcon="person" error={fieldErrors.fullName} />
        <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry leadingIcon="lock" helper="Use at least 8 characters." error={fieldErrors.password} />
      </SectionCard>
      <AuthErrorBanner error={error} />
      <View style={authStyles.footerActions}>
        <PrimaryCTA label="Create Account" onPress={handleSubmit} loading={submitting} disabled={!fullName || !email || !phoneNumber || !password} />
        <SecondaryCTA label="Back To Login" onPress={() => navigation.navigate(routes.login)} disabled={submitting} />
      </View>
    </AppScreen>
  );
}
