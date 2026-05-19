import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, ScreenScroll, SegmentedTabs, SplitPhoneField, StatusBanner, PrimaryCTA, SecondaryCTA, TitleBlock } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { authStyles } from './styles';

export function LoginScreen({ route }: { route?: { params?: { roleHint?: 'Admin' } } }) {
  const navigation = useNavigation<any>();
  const { login } = useAuth();
  const [role, setRole] = useState<'Member' | 'Admin'>(route?.params?.roleHint === 'Admin' ? 'Admin' : 'Member');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    try {
      setError('');
      setSubmitting(true);
      await login(phoneNumber, password, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll contentStyle={authStyles.centeredContent}>
      <TitleBlock
        title={role === 'Admin' ? 'Platform Admin' : 'Welcome Back'}
        subtitle={role === 'Admin' ? 'Approve groups, review KYC, and monitor the automated cycle flow.' : 'Sign in with your phone number and password.'}
      />
      <View style={authStyles.segmentedWrap}>
        <SegmentedTabs
          options={[
            { key: 'Member', label: 'Member' },
            { key: 'Admin', label: 'Admin' },
          ]}
          selectedKey={role}
          onSelect={key => {
            setRole(key as 'Member' | 'Admin');
            setPhoneNumber('');
            setPassword('');
            setError('');
          }}
        />
      </View>
      <View style={authStyles.fieldGroup}>
        <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
        <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry leadingIcon="lock" />
      </View>
      <StatusBanner
        tone="info"
        title="Session stays on this device."
        body="Saved sessions that stay inactive for 7 days are signed out automatically."
      />
      <InlineError message={error} />
      <View style={authStyles.footerActions}>
        <PrimaryCTA label="Sign In" onPress={handleLogin} loading={submitting} disabled={!phoneNumber || !password} />
        <SecondaryCTA label="Forgot Password" onPress={() => navigation.navigate(routes.reset)} disabled={submitting} />
        {role === 'Member' ? <SecondaryCTA label="Create New Account" onPress={() => navigation.navigate(routes.signup)} disabled={submitting} /> : null}
      </View>
    </ScreenScroll>
  );
}
