import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, InlineError, InputField, PrimaryCTA, SectionCard, SplitPhoneField, SecondaryCTA, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { authStyles } from './styles';

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
      const result = await register(fullName, phoneNumber, password);
      if (result.requiresOtp) {
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
    <AppScreen scroll={false} contentStyle={authStyles.signupScreen}>
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
      <SectionCard>
        <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
        <InputField label="Full Name" value={fullName} onChangeText={setFullName} leadingIcon="person" />
      </SectionCard>
      <SectionCard variant="soft">
        <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry leadingIcon="lock" helper="Use a password you can remember during the defense demo." />
      </SectionCard>
      <InlineError message={error} />
      <View style={authStyles.footerActions}>
        <PrimaryCTA label="Create Account" onPress={handleSubmit} loading={submitting} disabled={!fullName || !phoneNumber || !password} />
        <SecondaryCTA label="Back To Login" onPress={() => navigation.navigate(routes.login)} disabled={submitting} />
      </View>
    </AppScreen>
  );
}
