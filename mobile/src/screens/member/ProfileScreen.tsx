import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GeneratedAvatar } from '../../components/GeneratedAvatar';
import { Icon } from '../../components/Icon';
import { AppScreen, LoadingState, Pill, SectionCard, StatusBanner } from '../../components/ui';
import { useAccountSlotsQuery, useDashboardQuery, useProfileQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { iconSize, palette } from '../../theme/tokens';
import { memberStyles } from './styles';

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

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { session, logout, switchAccount } = useAuth();
  const { data: dashboard } = useDashboardQuery();
  const { data: profile } = useProfileQuery();
  const { data: accountSlots } = useAccountSlotsQuery();

  if (!session) {
    return <LoadingState title="Loading profile" subtitle="Preparing account and settings." />;
  }

  const kycStatus = dashboard?.kycState?.status ?? session.user.kycStatus;
  const isVerified = kycStatus === 'Verified';
  const memberId = `UEQ-M-${session.user.userId.slice(-5).toUpperCase()}`;

  function confirmLogout() {
    Alert.alert('Log out', 'End this saved session on the device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => { logout().catch(() => undefined); } },
    ]);
  }

  return (
    <AppScreen contentStyle={memberStyles.profileScreenContent}>
      <View style={memberStyles.profileHero}>
        <View style={memberStyles.profileAvatarLarge}>
          <GeneratedAvatar descriptor={profile?.avatar} labelSeed={session.user.fullName} size={92} verified={isVerified} />
        </View>
        <Text style={memberStyles.profileHeroName}>{session.user.fullName}</Text>
        <View style={memberStyles.profileHeroMetaRow}>
          <Text style={memberStyles.profileHeroMeta}>Member · {isVerified ? 'Verified' : kycStatus}</Text>
          {isVerified ? <Icon name="verified" size={16} color={palette.primary} /> : null}
        </View>
      </View>

      {dashboard?.reliabilityProfile?.public_status === 'Restricted' || dashboard?.reliabilityProfile?.public_status === 'Banned' ? (
        <StatusBanner tone="danger" title="Account actions are limited." body="Create, join, payment, or payout actions may be blocked until admin recovery is complete." />
      ) : null}

      <SectionCard style={memberStyles.profileSectionCard}>
        <ProfileCardHeader
          icon="badge"
          title="Account overview"
          subtitle="Your key account details at a glance"
          action={(
            <Pressable accessibilityRole="button" onPress={() => undefined} style={memberStyles.profileViewButton}>
              <Text style={memberStyles.profileViewButtonText}>View profile</Text>
              <Icon name="chevron-right" size={iconSize.sm} color={palette.primary} />
            </Pressable>
          )}
        />
        <View style={memberStyles.profileOverviewGrid}>
          <OverviewItem icon="school" label="University" value={profile?.university ?? 'Not set'} />
          <OverviewItem icon="calendar-month" label="Year" value={profile?.academicYear ?? 'Not set'} />
          <OverviewItem icon="phone" label="Phone" value={maskPhone(session.user.phoneNumber)} />
          <OverviewItem icon="badge" label="Member ID" value={memberId} />
          <OverviewItem icon="schedule" label="Joined" value={monthYear(dashboard?.kycState?.submittedAt)} />
        </View>
      </SectionCard>

      <SectionCard style={memberStyles.profileSectionCard}>
        <ProfileCardHeader icon="shield" title="Verification & security" subtitle="Your account is secure and verified" />
        <ProfileOptionRow
          icon="person"
          title="KYC status"
          verified={isVerified}
          rightLabel={!isVerified ? kycStatus : undefined}
          onPress={dashboard?.kycState?.canSubmit ? () => navigation.navigate(routes.kyc) : undefined}
        />
        <ProfileOptionRow icon="lock" title="Security" rightLabel="Biometric lock enabled" />
        <ProfileOptionRow icon="account-balance-wallet" title="Wallet link" rightLabel="Telebirr connected" onPress={() => navigation.navigate(routes.wallet)} />
      </SectionCard>

      <SectionCard style={memberStyles.profileSectionCard}>
        <ProfileCardHeader icon="settings" title="Preferences" subtitle="Customize your app experience" />
        <ProfileOptionRow icon="notifications" title="Notifications" rightLabel="Push and SMS reminders on" onPress={() => navigation.navigate(routes.notifications)} />
        <ProfileOptionRow icon="language" title="Language" rightLabel={profile?.language ?? 'English'} />
        <ProfileOptionRow icon="wb-sunny" title="Theme" rightLabel={profile?.theme ?? 'Light'} />
        <ProfileOptionRow icon="shield" title="Privacy" rightLabel="Manage visibility" />
      </SectionCard>

      {accountSlots?.length ? (
        <SectionCard style={memberStyles.profileMenuCard}>
          <ProfileCardHeader icon="switch-account" title="Account switching" subtitle="Saved accounts on this device" />
          {accountSlots.map(slot => (
            <ProfileOptionRow
              key={slot.userId}
              icon="account-circle"
              title={slot.displayName}
              subtitle={slot.phoneNumber}
              rightLabel={slot.userId === session.user.userId ? 'Current' : slot.tokenState === 'Available' ? 'Switch' : 'Sign in'}
              onPress={slot.userId === session.user.userId ? undefined : () => { switchAccount(slot.userId).catch(error => Alert.alert('Account switch', error instanceof Error ? error.message : 'Unable to switch accounts.')); }}
            />
          ))}
        </SectionCard>
      ) : null}

      <SectionCard style={memberStyles.profileMenuCard}>
        <ProfileOptionRow icon="help-outline" title="Help Center" />
        <ProfileOptionRow icon="description" title="Terms & privacy" />
        <ProfileOptionRow icon="logout" title="Log out" danger onPress={confirmLogout} />
      </SectionCard>
    </AppScreen>
  );
}
