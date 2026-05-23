import React, { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProfileErrorBanner } from '../../components/AppErrors';
import { AppScreen, LoadingState, PrimaryCTA, SecondaryCTA, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useProfileActions, useProfileQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { palette } from '../../theme/tokens';
import { validateEmail } from '../../utils/validation';
import { memberStyles } from './styles';

export function ProfileEmailScreen() {
  const { session } = useAuth();
  const navigation = useNavigation<any>();
  const { data: profile } = useProfileQuery();
  const { updateProfile } = useProfileActions();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setEmail(profile?.email ?? session?.user.email ?? '');
  }, [profile?.email, session?.user.email]);

  if (!session) {
    return <LoadingState title="Loading email settings" subtitle="Preparing account verification." />;
  }

  const currentSession = session;
  const currentEmail = profile?.email ?? currentSession.user.email ?? '';
  const verified = !!profile?.emailVerifiedAt || !!currentSession.user.emailVerifiedAt;
  const changed = email.trim().toLowerCase() !== currentEmail.trim().toLowerCase();

  async function handleSaveAndVerify() {
    const nextError = validateEmail(email);
    setFieldError(nextError);
    if (nextError) {
      return;
    }
    try {
      setError('');
      const normalized = email.trim().toLowerCase();
      await updateProfile.mutateAsync({ email: normalized });
      navigation.navigate(routes.emailVerify, { userId: currentSession.user.userId, email: normalized });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save email address.');
    }
  }

  function verifyExisting() {
    const targetEmail = currentEmail.trim().toLowerCase();
    if (!targetEmail) {
      setFieldError('Enter an email address first.');
      return;
    }
    navigation.navigate(routes.emailVerify, { userId: currentSession.user.userId, email: targetEmail });
  }

  return (
    <AppScreen>
      <TopAppBar title={currentEmail ? 'Email Settings' : 'Add Email'} subtitle="Profile" onBack={() => navigation.goBack()} rightLabel={verified ? 'Verified' : 'Unverified'} />
      <TitleBlock
        title={currentEmail ? 'Manage your email' : 'Add an email address'}
        subtitle={currentEmail ? 'Change your email or complete verification for account recovery and important notices.' : 'Existing accounts need an email before verification can continue.'}
      />
      {!currentEmail ? (
        <StatusBanner tone="warning" title="Email required" body="Add an email address and UniEqub will send a verification code immediately." />
      ) : !verified ? (
        <StatusBanner tone="warning" title="Email not verified" body="Verify this email before using it for account recovery and important account notices." />
      ) : (
        <StatusBanner tone="success" title="Email verified" body="This email is ready for account recovery and important UniEqub notices." />
      )}
      <ProfileErrorBanner error={error} />
      <SectionCard style={memberStyles.profileSectionCard}>
        <Text style={memberStyles.sectionTitle}>Email address</Text>
        <TextInput
          value={email}
          onChangeText={value => {
            setEmail(value);
            setFieldError('');
          }}
          placeholder="you@example.com"
          placeholderTextColor={palette.textSoft}
          style={memberStyles.profileTextInput}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        {fieldError ? <Text style={memberStyles.inlineDangerText}>{fieldError}</Text> : null}
        <PrimaryCTA
          label={changed || !currentEmail ? 'Save And Verify Email' : verified ? 'Email Already Verified' : 'Send Verification Code'}
          onPress={changed || !currentEmail ? handleSaveAndVerify : verifyExisting}
          loading={updateProfile.isPending}
          disabled={updateProfile.isPending || (!!currentEmail && verified && !changed)}
          icon="mark-email-read"
        />
        <SecondaryCTA label="Back To Profile" onPress={() => navigation.goBack()} icon="person" />
      </SectionCard>
    </AppScreen>
  );
}
