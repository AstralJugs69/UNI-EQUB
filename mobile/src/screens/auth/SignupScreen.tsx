import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, PrimaryCTA, ScreenScroll, SectionCard, SplitPhoneField, SecondaryCTA, TitleBlock, TopAppBar } from '../../components/ui';
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
      <TopAppBar title="Create Account" subtitle="Step 1 of 3" onBack={() => navigation.goBack()} />
      <TitleBlock title="Start your student savings profile" subtitle="Create your account first. OTP and KYC happen in the next steps." />
      <SectionCard>
        <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
        <InputField label="Full Name" value={fullName} onChangeText={setFullName} leadingIcon="person" />
      </SectionCard>
      <SectionCard variant="soft">
        <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry leadingIcon="lock" helper="Use a password you can remember during the defense demo." />
      </SectionCard>
      <SectionCard variant="raised">
        <TitleBlock title="What happens next" subtitle="We verify your phone number first, then collect your KYC images before unlocking member actions." />
      </SectionCard>
      <InlineError message={error} />
      <View style={authStyles.footerActions}>
        <PrimaryCTA label="Create Account" onPress={handleSubmit} loading={submitting} disabled={!fullName || !phoneNumber || !password} />
        <SecondaryCTA label="Back To Login" onPress={() => navigation.navigate(routes.login)} disabled={submitting} />
      </View>
    </ScreenScroll>
  );
}
