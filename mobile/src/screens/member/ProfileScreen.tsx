import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ProfileErrorBanner } from '../../components/AppErrors';
import { GeneratedAvatar } from '../../components/GeneratedAvatar';
import { Icon } from '../../components/Icon';
import { AppScreen, LoadingState, MetricTile, Pill, PrimaryCTA, SectionCard, StatusBanner } from '../../components/ui';
import { useAccountSlotsQuery, useDashboardQuery, useProfileActions, useProfileQuery, useRefreshMemberData } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { useAppPreferences } from '../../providers/PreferencesProvider';
import { iconSize, palette } from '../../theme/tokens';
import type { UserProfile } from '../../types/domain';
import { validateEmail, validateEthiopianPhone } from '../../utils/validation';
import { memberStyles } from './styles';

type ProfilePanel = 'details' | 'notifications' | 'language' | 'theme' | 'privacy' | 'help' | 'terms' | null;

const notificationLabels: Record<UserProfile['notificationPreference'], string> = {
  PushAndSms: 'Push and SMS reminders',
  PushOnly: 'Push reminders only',
  SmsOnly: 'SMS reminders only',
  None: 'Off',
};

const notificationOptions: Array<{ value: UserProfile['notificationPreference']; label: string }> = [
  { value: 'PushAndSms', label: notificationLabels.PushAndSms },
  { value: 'PushOnly', label: notificationLabels.PushOnly },
  { value: 'SmsOnly', label: notificationLabels.SmsOnly },
  { value: 'None', label: notificationLabels.None },
];

const themeOptions: UserProfile['theme'][] = ['Light', 'Dark', 'System'];
const languageOptions = ['English', 'Amharic'];

function maskPhone(phone: string) {
  const compact = phone.replace(/\s+/g, '');
  if (compact.length < 7) {
    return phone || '09XX XXX XXX';
  }
  return `${compact.slice(0, 4)} XXX ${compact.slice(-3)}`;
}

function monthYear(value?: string | null) {
  if (!value) {
    return 'Mar 2026';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Mar 2026';
  }
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function ProfileCardHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={memberStyles.profileCardHeader}>
      <View style={memberStyles.profileCardIcon}>
        <Icon name={icon} size={iconSize.md} color={palette.primary} />
      </View>
      <View style={memberStyles.profileCardTitleWrap}>
        <Text style={memberStyles.profileCardTitle}>{title}</Text>
        <Text style={memberStyles.profileCardSubtitle}>{subtitle}</Text>
      </View>
      {action}
    </View>
  );
}

function OverviewItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={memberStyles.profileOverviewItem}>
      <Icon name={icon} size={iconSize.sm} color={palette.primary} />
      <View style={memberStyles.profileOverviewText}>
        <Text style={memberStyles.profileOverviewLabel}>{label}</Text>
        <Text style={memberStyles.profileOverviewValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function ProfileOptionRow({
  icon,
  title,
  subtitle,
  rightLabel,
  verified,
  danger,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  rightLabel?: string;
  verified?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => undefined)}
      android_ripple={{ color: '#E4EDF8' }}
      style={memberStyles.profileOptionRow}
    >
      <View style={memberStyles.profileOptionIcon}>
        <Icon name={icon} size={iconSize.sm} color={danger ? palette.danger : palette.primary} />
      </View>
      <View style={memberStyles.profileOptionText}>
        <Text style={[memberStyles.profileOptionTitle, danger && memberStyles.profileOptionTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={memberStyles.profileOptionSubtitle}>{subtitle}</Text> : null}
      </View>
      {verified ? <Pill label="Verified" tone="good" /> : rightLabel ? <Text style={memberStyles.profileOptionRightLabel}>{rightLabel}</Text> : null}
      <Icon name="chevron-right" size={iconSize.md} color={danger ? palette.danger : palette.textSoft} />
    </Pressable>
  );
}

function ChoicePanel<T extends string>({
  title,
  value,
  options,
  onSelect,
}: {
  title: string;
  value: T;
  options: Array<{ value: T; label: string }> | T[];
  onSelect: (value: T) => void;
}) {
  return (
    <SectionCard style={memberStyles.profileSectionCard} variant="soft">
      <Text style={memberStyles.sectionTitle}>{title}</Text>
      <View style={memberStyles.profileChoiceGrid}>
        {options.map(option => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const label = typeof option === 'string' ? option : option.label;
          const selected = optionValue === value;
          return (
            <Pressable
              key={optionValue}
              accessibilityRole="button"
              onPress={() => onSelect(optionValue)}
              style={[memberStyles.profileChoiceButton, selected && memberStyles.profileChoiceButtonSelected]}
            >
              <Text style={[memberStyles.profileChoiceText, selected && memberStyles.profileChoiceTextSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SectionCard>
  );
}

export function ProfileScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { session, logout, switchAccount } = useAuth();
  const { t } = useAppPreferences();
  const { data: dashboard } = useDashboardQuery();
  const { data: profile } = useProfileQuery();
  const { data: accountSlots } = useAccountSlotsQuery();
  const { updateProfile, uploadProfileImage, removeProfileImage } = useProfileActions();
  const { refreshing, refreshMemberData } = useRefreshMemberData();
  const [activePanel, setActivePanel] = useState<ProfilePanel>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileDraft, setProfileDraft] = useState({
    email: '',
    phoneNumber: '',
    university: '',
    academicYear: '',
  });
  const [profileDraftErrors, setProfileDraftErrors] = useState({ email: '', phoneNumber: '' });

  useEffect(() => {
    setProfileDraft({
      email: profile?.email ?? session?.user.email ?? '',
      phoneNumber: profile?.phoneNumber ?? session?.user.phoneNumber ?? '',
      university: profile?.university ?? '',
      academicYear: profile?.academicYear ?? '',
    });
  }, [profile?.academicYear, profile?.email, profile?.phoneNumber, profile?.university, session?.user.email, session?.user.phoneNumber]);

  useEffect(() => {
    if (route?.params?.flash) {
      setSuccess(String(route.params.flash));
    }
  }, [route?.params?.flash]);

  if (!session) {
    return <LoadingState title="Loading profile" subtitle="Preparing account and settings." />;
  }

  const kycStatus = dashboard?.kycState?.status ?? session.user.kycStatus;
  const isVerified = kycStatus === 'Verified';
  const memberId = `UEQ-M-${session.user.userId.slice(-5).toUpperCase()}`;
  const memberAccountSlots = (accountSlots ?? []).filter(slot => slot.role === 'Member');
  const notificationLabel = notificationLabels[profile?.notificationPreference ?? 'PushAndSms'];
  const preferenceBusy = updateProfile.isPending || uploadProfileImage.isPending || removeProfileImage.isPending;
  const profileEmail = profile?.email ?? session.user.email ?? '';
  const emailVerified = !!profile?.emailVerifiedAt || !!session.user.emailVerifiedAt;

  const avatarNode = useMemo(() => (
    profile?.profileImageUrl ? (
      <View>
        <Image source={{ uri: profile.profileImageUrl }} style={memberStyles.profileUploadedImage} />
        {isVerified ? (
          <View style={memberStyles.profileUploadedVerified}>
            <Icon name="check" size={12} color={palette.white} />
          </View>
        ) : null}
      </View>
    ) : (
      <GeneratedAvatar descriptor={profile?.avatar} labelSeed={session.user.fullName} size={92} verified={isVerified} />
    )
  ), [isVerified, profile?.avatar, profile?.profileImageUrl, session.user.fullName]);

  function confirmLogout() {
    Alert.alert('Log out', 'End this saved session on the device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => { logout().catch(() => undefined); } },
    ]);
  }

  async function handlePickProfileImage() {
    try {
      const currentSession = session;
      if (!currentSession) {
        throw new Error('No active session is available.');
      }
      setError('');
      setSuccess('');
      const result = await launchImageLibrary({ mediaType: 'photo', includeBase64: true, quality: 0.8, selectionLimit: 1 });
      if (result.didCancel) {
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.base64 || !asset.type) {
        throw new Error('The selected image could not be prepared for upload.');
      }
      await uploadProfileImage.mutateAsync({
        fileName: asset.fileName ?? 'profile.jpg',
        contentType: asset.type,
        base64: asset.base64,
      });
      setSuccess('Profile picture updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile picture.');
    }
  }

  async function handleRemoveProfileImage() {
    try {
      setError('');
      setSuccess('');
      await removeProfileImage.mutateAsync();
      setSuccess('Generated avatar is back on your profile.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove profile picture.');
    }
  }

  async function handleSaveDetails() {
    const nextErrors = {
      email: validateEmail(profileDraft.email),
      phoneNumber: validateEthiopianPhone(profileDraft.phoneNumber),
    };
    setProfileDraftErrors(nextErrors);
    if (nextErrors.email || nextErrors.phoneNumber) {
      return;
    }
    try {
      const currentSession = session;
      if (!currentSession) {
        throw new Error('No active session is available.');
      }
      setError('');
      setSuccess('');
      await updateProfile.mutateAsync({
        email: profileDraft.email.trim().toLowerCase(),
        phoneNumber: profileDraft.phoneNumber.trim(),
        university: profileDraft.university.trim() || null,
        academicYear: profileDraft.academicYear.trim() || null,
      });
      setSuccess('Profile details saved. Email or phone changes stay unverified until confirmation is completed.');
      setActivePanel(null);
      if (profileDraft.email.trim().toLowerCase() !== (profile?.email ?? currentSession.user.email ?? '').trim().toLowerCase()) {
        navigation.navigate(routes.emailVerify, {
          userId: currentSession.user.userId,
          email: profileDraft.email.trim().toLowerCase(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile details.');
    }
  }

  async function handleUpdatePreference(input: Parameters<typeof updateProfile.mutateAsync>[0], message: string) {
    try {
      setError('');
      setSuccess('');
      await updateProfile.mutateAsync(input);
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update this setting.');
    }
  }

  return (
    <AppScreen contentStyle={memberStyles.profileScreenContent} refreshing={refreshing} onRefresh={refreshMemberData}>
      <View style={memberStyles.profileHero}>
        <View style={memberStyles.profileAvatarLarge}>{avatarNode}</View>
        <Text style={memberStyles.profileHeroName}>{session.user.fullName}</Text>
        <View style={memberStyles.profileHeroMetaRow}>
          <Text style={memberStyles.profileHeroMeta}>Member - {isVerified ? 'Verified' : kycStatus}</Text>
          {isVerified ? <Icon name="verified" size={16} color={palette.primary} /> : null}
        </View>
        <View style={memberStyles.profilePhotoActions}>
          <Pressable accessibilityRole="button" onPress={handlePickProfileImage} disabled={preferenceBusy} style={memberStyles.profileSmallButton}>
            <Icon name="photo-camera" size={iconSize.sm} color={palette.primary} />
            <Text style={memberStyles.profileSmallButtonText}>{profile?.profileImageUrl ? 'Change photo' : 'Upload photo'}</Text>
          </Pressable>
          {profile?.profileImageUrl ? (
            <Pressable accessibilityRole="button" onPress={handleRemoveProfileImage} disabled={preferenceBusy} style={memberStyles.profileSmallButton}>
              <Icon name="auto-awesome" size={iconSize.sm} color={palette.primary} />
              <Text style={memberStyles.profileSmallButtonText}>Use avatar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {success ? <StatusBanner tone="success" title={success} /> : null}
      <ProfileErrorBanner error={error} />

      {dashboard?.reliabilityProfile?.public_status === 'Restricted' || dashboard?.reliabilityProfile?.public_status === 'Banned' ? (
        <StatusBanner tone="danger" title="Account actions are limited." body="Create, join, payment, or payout actions may be blocked until admin recovery is complete." />
      ) : null}

      {dashboard?.reliabilityProfile ? (
        <SectionCard style={memberStyles.profileSectionCard}>
          <ProfileCardHeader icon="verified-user" title="Reliability profile" subtitle="Public trust label for group safety" />
          <View style={memberStyles.metricsGrid}>
            <MetricTile label="Status" value={dashboard.reliabilityProfile.public_status} tone={dashboard.reliabilityProfile.public_status === 'Trusted' ? 'good' : dashboard.reliabilityProfile.public_status === 'Restricted' || dashboard.reliabilityProfile.public_status === 'Banned' ? 'bad' : 'neutral'} />
            <MetricTile label="Completed" value={String(dashboard.reliabilityProfile.completed_groups_count)} />
            <MetricTile label="Late" value={String(dashboard.reliabilityProfile.late_payment_count)} tone={dashboard.reliabilityProfile.late_payment_count > 0 ? 'warn' : 'good'} />
            <MetricTile label="Defaults" value={String(dashboard.reliabilityProfile.default_count)} tone={dashboard.reliabilityProfile.default_count > 0 ? 'bad' : 'good'} />
          </View>
        </SectionCard>
      ) : null}

      <SectionCard style={memberStyles.profileSectionCard}>
        <ProfileCardHeader
          icon="badge"
          title={t('profile.accountOverview')}
          subtitle={t('profile.accountOverviewSubtitle')}
          action={(
            <Pressable accessibilityRole="button" onPress={() => setActivePanel(activePanel === 'details' ? null : 'details')} style={memberStyles.profileViewButton}>
              <Text style={memberStyles.profileViewButtonText}>{activePanel === 'details' ? 'Close' : 'Edit profile'}</Text>
              <Icon name="chevron-right" size={iconSize.sm} color={palette.primary} />
            </Pressable>
          )}
        />
        <View style={memberStyles.profileOverviewGrid}>
          <OverviewItem icon="school" label="University" value={profile?.university ?? 'Not set'} />
          <OverviewItem icon="calendar-month" label="Year" value={profile?.academicYear ?? 'Not set'} />
          <OverviewItem icon="alternate-email" label="Email" value={profileEmail || 'Not set'} />
          <OverviewItem icon="phone" label="Phone" value={maskPhone(session.user.phoneNumber)} />
          <OverviewItem icon="badge" label="Member ID" value={memberId} />
          <OverviewItem icon="schedule" label="Joined" value={monthYear(dashboard?.kycState?.submittedAt)} />
        </View>
      </SectionCard>

      {activePanel === 'details' ? (
        <SectionCard style={memberStyles.profileSectionCard} variant="soft">
          <Text style={memberStyles.sectionTitle}>Profile details</Text>
          <TextInput value={session.user.fullName} editable={false} placeholder="Full name" placeholderTextColor={palette.textSoft} style={memberStyles.profileTextInput} />
          <TextInput value={profileDraft.email} onChangeText={value => setProfileDraft(current => ({ ...current, email: value }))} placeholder="Email address" placeholderTextColor={palette.textSoft} style={memberStyles.profileTextInput} autoCapitalize="none" keyboardType="email-address" />
          {profileDraftErrors.email ? <Text style={memberStyles.inlineDangerText}>{profileDraftErrors.email}</Text> : null}
          <TextInput value={profileDraft.phoneNumber} onChangeText={value => setProfileDraft(current => ({ ...current, phoneNumber: value }))} placeholder="Phone number" placeholderTextColor={palette.textSoft} style={memberStyles.profileTextInput} keyboardType="phone-pad" />
          {profileDraftErrors.phoneNumber ? <Text style={memberStyles.inlineDangerText}>{profileDraftErrors.phoneNumber}</Text> : null}
          <TextInput value={profileDraft.university} onChangeText={value => setProfileDraft(current => ({ ...current, university: value }))} placeholder="University" placeholderTextColor={palette.textSoft} style={memberStyles.profileTextInput} />
          <TextInput value={profileDraft.academicYear} onChangeText={value => setProfileDraft(current => ({ ...current, academicYear: value }))} placeholder="Academic year" placeholderTextColor={palette.textSoft} style={memberStyles.profileTextInput} />
          <PrimaryCTA label="Save Profile" onPress={handleSaveDetails} loading={updateProfile.isPending} disabled={updateProfile.isPending} />
        </SectionCard>
      ) : null}

      <SectionCard style={memberStyles.profileSectionCard}>
        <ProfileCardHeader icon="shield" title={t('profile.verificationSecurity')} subtitle="Your account is secure and verified" />
        <ProfileOptionRow icon="person" title="KYC status" verified={isVerified} rightLabel={!isVerified ? kycStatus : undefined} onPress={() => navigation.navigate(routes.kyc)} />
        <ProfileOptionRow
          icon="alternate-email"
          title={profileEmail ? 'Email address' : 'Add email address'}
          subtitle={profileEmail || 'Required for verification and account recovery.'}
          verified={emailVerified}
          rightLabel={emailVerified ? undefined : profileEmail ? 'Verify' : 'Add'}
          onPress={() => navigation.navigate(routes.profileEmail)}
        />
        <ProfileOptionRow icon="lock" title="Security" rightLabel="Device protected" onPress={() => Alert.alert('Security', 'Biometric lock and session expiry are controlled by the secure device session.')} />
        <ProfileOptionRow icon="password" title="Reset password" rightLabel="OTP when required" onPress={() => navigation.navigate(routes.reset, { phoneNumber: session.user.phoneNumber })} />
      </SectionCard>

      <SectionCard style={memberStyles.profileSectionCard}>
        <ProfileCardHeader icon="settings" title={t('profile.preferences')} subtitle="Customize your app experience" />
        <ProfileOptionRow icon="notifications" title={t('profile.notifications')} rightLabel={notificationLabel} onPress={() => setActivePanel(activePanel === 'notifications' ? null : 'notifications')} />
        <ProfileOptionRow icon="language" title={t('profile.language')} rightLabel={profile?.language ?? 'English'} onPress={() => setActivePanel(activePanel === 'language' ? null : 'language')} />
        <ProfileOptionRow icon="wb-sunny" title={t('profile.theme')} rightLabel={profile?.theme ?? 'Light'} onPress={() => setActivePanel(activePanel === 'theme' ? null : 'theme')} />
        <ProfileOptionRow icon="shield" title={t('profile.privacy')} rightLabel="Group-only profile" onPress={() => setActivePanel(activePanel === 'privacy' ? null : 'privacy')} />
      </SectionCard>

      {activePanel === 'notifications' ? (
        <ChoicePanel title="Notification preference" value={profile?.notificationPreference ?? 'PushAndSms'} options={notificationOptions} onSelect={value => { handleUpdatePreference({ notificationPreference: value }, 'Notification preference saved.').catch(() => undefined); }} />
      ) : null}
      {activePanel === 'language' ? (
        <ChoicePanel title="Language" value={profile?.language ?? 'English'} options={languageOptions} onSelect={value => { handleUpdatePreference({ language: value }, 'Language preference saved.').catch(() => undefined); }} />
      ) : null}
      {activePanel === 'theme' ? (
        <ChoicePanel title="Theme" value={profile?.theme ?? 'Light'} options={themeOptions} onSelect={value => { handleUpdatePreference({ theme: value }, 'Theme preference saved.').catch(() => undefined); }} />
      ) : null}
      {activePanel === 'privacy' ? (
        <SectionCard style={memberStyles.profileSectionCard} variant="soft">
          <Text style={memberStyles.sectionTitle}>Privacy</Text>
          <Text style={memberStyles.mutedText}>Your phone, profile details, and trust status are only shown where they help group safety: participant review, KYC review, and active group membership.</Text>
          <ProfileOptionRow icon="visibility" title="Profile visibility" rightLabel="Group safety only" />
          <ProfileOptionRow icon="history" title="Trust history" rightLabel="Visible to creators" />
        </SectionCard>
      ) : null}

      {memberAccountSlots.length ? (
        <SectionCard style={memberStyles.profileMenuCard}>
          <ProfileCardHeader icon="switch-account" title="Account switching" subtitle="Saved accounts on this device" />
          {memberAccountSlots.map(slot => (
            <ProfileOptionRow
              key={slot.userId}
              icon="account-circle"
              title={slot.displayName}
              subtitle={slot.phoneNumber}
              rightLabel={slot.userId === session.user.userId ? 'Current' : slot.tokenState === 'Available' ? 'Switch' : 'Sign in'}
              onPress={slot.userId === session.user.userId ? undefined : () => { switchAccount(slot.userId).catch(switchError => Alert.alert('Account switch', switchError instanceof Error ? switchError.message : 'Unable to switch accounts.')); }}
            />
          ))}
        </SectionCard>
      ) : null}

      <SectionCard style={memberStyles.profileMenuCard}>
        <ProfileOptionRow icon="help-outline" title={t('profile.help')} onPress={() => setActivePanel(activePanel === 'help' ? null : 'help')} />
        <ProfileOptionRow icon="description" title={t('profile.terms')} onPress={() => setActivePanel(activePanel === 'terms' ? null : 'terms')} />
        <ProfileOptionRow icon="logout" title={t('profile.logout')} danger onPress={confirmLogout} />
      </SectionCard>

      {activePanel === 'help' ? (
        <SectionCard style={memberStyles.profileMenuCard} variant="soft">
          <Text style={memberStyles.sectionTitle}>Help Center</Text>
          <ProfileOptionRow icon="groups" title="Group help" subtitle="Create, join, pay, and track an Equb cycle." onPress={() => navigation.navigate(routes.explore)} />
          <ProfileOptionRow icon="payments" title="Payment help" subtitle="Open wallet and contribution history." onPress={() => navigation.navigate(routes.wallet)} />
          <ProfileOptionRow icon="notifications" title="Notification inbox" subtitle="Review account and group events." onPress={() => navigation.navigate(routes.notifications)} />
        </SectionCard>
      ) : null}

      {activePanel === 'terms' ? (
        <SectionCard style={memberStyles.profileMenuCard} variant="soft">
          <Text style={memberStyles.sectionTitle}>Terms & privacy</Text>
          <Text style={memberStyles.mutedText}>UniEqub stores profile details, KYC status, notification preference, optional uploaded profile pictures, and generated avatar seeds to support verified group participation.</Text>
          <Text style={memberStyles.mutedText}>Profile pictures are optional. Removing one immediately falls back to the generated avatar already tied to your account.</Text>
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}
