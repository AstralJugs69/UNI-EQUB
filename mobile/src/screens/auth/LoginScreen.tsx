import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { AuthErrorBanner } from '../../components/AppErrors';
import { AppScreen } from '../../components/ui';
import { useAccountSlotsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { iconSize, palette } from '../../theme/tokens';
import { validateEmail, validateEthiopianPhone, validatePassword } from '../../utils/validation';
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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ identifier: '', password: '' });
  const roleAccountSlots = (accountSlots ?? []).filter(slot => slot.role === role);

  function validateIdentifier(value: string) {
    const trimmed = value.trim();
    return trimmed.includes('@') ? validateEmail(trimmed) : validateEthiopianPhone(trimmed);
  }

  async function handleLogin() {
    const nextErrors = {
      identifier: validateIdentifier(identifier),
      password: validatePassword(password),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.identifier || nextErrors.password) {
      return;
    }
    try {
      setError('');
      setSubmitting(true);
      await login(identifier.trim().toLowerCase(), password, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  function selectRole(nextRole: 'Member' | 'Admin') {
    setRole(nextRole);
    setIdentifier('');
    setPassword('');
    setAccountDropdownOpen(false);
    setError('');
  }

  const disabled = submitting || !identifier || !password;

  return (
    <AppScreen scroll={false} contentStyle={authStyles.loginScreen}>
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
          <Text style={authStyles.loginFieldLabel}>Email or phone number</Text>
          <View style={[authStyles.loginInputWrap, !!fieldErrors.identifier && authStyles.loginInputWrapError]}>
            <Icon name="alternate-email" size={iconSize.sm} color={palette.textSoft} />
            <TextInput
              value={identifier}
              onChangeText={value => {
                setIdentifier(value);
                if (fieldErrors.identifier) {
                  setFieldErrors(current => ({ ...current, identifier: validateIdentifier(value) }));
                }
              }}
              placeholder="you@example.com or 0911 00 00 00"
              placeholderTextColor={palette.textSoft}
              style={authStyles.loginInput}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          {fieldErrors.identifier ? <Text style={authStyles.loginFieldError}>{fieldErrors.identifier}</Text> : null}
        </View>

        <View style={authStyles.loginFieldGroup}>
          <Text style={authStyles.loginFieldLabel}>Password</Text>
          <View style={[authStyles.loginInputWrap, !!fieldErrors.password && authStyles.loginInputWrapError]}>
            <Icon name="lock-outline" size={iconSize.sm} color={palette.textSoft} />
            <TextInput
              value={password}
              onChangeText={value => {
                setPassword(value);
                if (fieldErrors.password) {
                  setFieldErrors(current => ({ ...current, password: validatePassword(value) }));
                }
              }}
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
          {fieldErrors.password ? <Text style={authStyles.loginFieldError}>{fieldErrors.password}</Text> : null}
        </View>
      </View>

      <AuthErrorBanner error={error} />

      {roleAccountSlots.length ? (
        <View style={authStyles.savedAccountDropdown}>
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => setAccountDropdownOpen(open => !open)}
            style={authStyles.loginSecondaryButton}
          >
            <Icon name="switch-account" size={iconSize.sm} color={palette.primary} />
            <Text style={authStyles.loginSecondaryButtonText}>Saved {role} Accounts</Text>
            <Icon name={accountDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={iconSize.sm} color={palette.primary} />
          </Pressable>
          {accountDropdownOpen ? roleAccountSlots.slice(0, 5).map(slot => (
            <Pressable
              key={slot.userId}
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => switchAccount(slot.userId).catch(err => Alert.alert('Saved account', err instanceof Error ? err.message : 'Sign in again to use this account.'))}
              style={authStyles.savedAccountOption}
            >
              <Icon name="switch-account" size={iconSize.sm} color={palette.primary} />
              <Text style={authStyles.loginSecondaryButtonText}>{slot.displayName}</Text>
            </Pressable>
          )) : null}
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
    </AppScreen>
  );
}
