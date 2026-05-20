import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { InlineError, ScreenScroll } from '../../components/ui';
import { useAccountSlotsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { iconSize, palette } from '../../theme/tokens';
import { authStyles } from './styles';

function RoleButton({
  selected,
  icon,
  label,
  onPress,
}: {
  selected: boolean;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[authStyles.loginRoleButton, selected && authStyles.loginRoleButtonActive]}
    >
      <Icon name={icon} size={iconSize.sm} color={selected ? palette.primary : palette.textSoft} />
      <Text style={[authStyles.loginRoleButtonText, selected && authStyles.loginRoleButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function LoginScreen({ route }: { route?: { params?: { roleHint?: 'Admin' } } }) {
  const navigation = useNavigation<any>();
  const { login, switchAccount } = useAuth();
  const { data: accountSlots } = useAccountSlotsQuery();
  const [role, setRole] = useState<'Member' | 'Admin'>(route?.params?.roleHint === 'Admin' ? 'Admin' : 'Member');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
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

  function selectRole(nextRole: 'Member' | 'Admin') {
    setRole(nextRole);
    setPhoneNumber('');
    setPassword('');
    setError('');
  }

  const disabled = submitting || !phoneNumber || !password;

  return (
    <ScreenScroll contentStyle={authStyles.loginScreen}>
      <View style={authStyles.loginHeader}>
        <Text style={authStyles.loginTitle}>Welcome Back</Text>
        <Text style={authStyles.loginSubtitle}>Sign in to your Equb {role === 'Admin' ? 'Admin ' : ''}Workspace to continue.</Text>
      </View>

      <View style={authStyles.loginRoleSwitch}>
        <RoleButton selected={role === 'Member'} icon="person-outline" label="Member" onPress={() => selectRole('Member')} />
        <RoleButton selected={role === 'Admin'} icon="shield" label="Admin" onPress={() => selectRole('Admin')} />
      </View>

      <View style={authStyles.loginFormCard}>
        <View style={authStyles.loginFieldGroup}>
          <Text style={authStyles.loginFieldLabel}>Phone number</Text>
          <View style={authStyles.loginPhoneRow}>
            <View style={authStyles.loginCountryBox}>
              <Text style={authStyles.loginFlag}>ET</Text>
              <Text style={authStyles.loginCountryCode}>+251</Text>
              <Icon name="keyboard-arrow-down" size={iconSize.sm} color={palette.text} />
            </View>
            <View style={authStyles.loginInputWrap}>
              <Icon name="phone" size={iconSize.sm} color={palette.textSoft} />
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="911 00 00 00"
                placeholderTextColor={palette.textSoft}
                style={authStyles.loginInput}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        <View style={authStyles.loginFieldGroup}>
          <Text style={authStyles.loginFieldLabel}>Password</Text>
          <View style={authStyles.loginInputWrap}>
            <Icon name="lock-outline" size={iconSize.sm} color={palette.textSoft} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={palette.textSoft}
              style={authStyles.loginInput}
              secureTextEntry={!passwordVisible}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              onPress={() => setPasswordVisible(current => !current)}
              style={authStyles.loginEyeButton}
            >
              <Icon name={passwordVisible ? 'visibility-off' : 'visibility'} size={iconSize.sm} color={palette.textSoft} />
            </Pressable>
          </View>
        </View>

        <View style={authStyles.loginSecurityBox}>
          <View style={authStyles.loginSecurityIcon}>
            <Icon name="shield" size={iconSize.md} color={palette.white} />
          </View>
          <View style={authStyles.loginSecurityText}>
            <Text style={authStyles.loginSecurityTitle}>Your security is our priority.</Text>
            <Text style={authStyles.loginSecurityBody}>Sessions remain active on this device and expire after 7 days of inactivity.</Text>
          </View>
        </View>
      </View>

      <InlineError message={error} />

      {accountSlots?.length ? (
        <View style={authStyles.loginActions}>
          {accountSlots.slice(0, 3).map(slot => (
            <Pressable
              key={slot.userId}
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => switchAccount(slot.userId).catch(err => Alert.alert('Saved account', err instanceof Error ? err.message : 'Sign in again to use this account.'))}
              style={authStyles.loginSecondaryButton}
            >
              <Icon name="switch-account" size={iconSize.sm} color={palette.primary} />
              <Text style={authStyles.loginSecondaryButtonText}>{slot.displayName}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={authStyles.loginActions}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={handleLogin}
          style={[authStyles.loginPrimaryButton, disabled && authStyles.loginButtonDisabled]}
        >
          <Icon name="lock-outline" size={iconSize.sm} color={palette.white} />
          <Text style={authStyles.loginPrimaryButtonText}>{submitting ? 'Signing In...' : 'Sign In'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={submitting} onPress={() => navigation.navigate(routes.reset)} style={authStyles.loginSecondaryButton}>
          <Icon name="vpn-key" size={iconSize.sm} color={palette.primary} />
          <Text style={authStyles.loginSecondaryButtonText}>Forgot Password</Text>
        </Pressable>
        {role === 'Member' ? (
          <Pressable accessibilityRole="button" disabled={submitting} onPress={() => navigation.navigate(routes.signup)} style={authStyles.loginSecondaryButton}>
            <Icon name="person-add" size={iconSize.sm} color={palette.primary} />
            <Text style={authStyles.loginSecondaryButtonText}>Create New Account</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={authStyles.loginFooter}>
        <Icon name="verified-user" size={iconSize.md} color={palette.primary} />
        <Text style={authStyles.loginFooterText}>Secured with industry-leading encryption to protect your data.</Text>
      </View>
    </ScreenScroll>
  );
}
