import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { GeneratedAvatar } from '../../components/GeneratedAvatar';
import { AppButton, AppScreen, ListRow, LoadingState, Pill, SectionCard, TitleBlock, TopAppBar } from '../../components/ui';
import { useAccountSlotsQuery, useProfileQuery } from '../../hooks/useAppQueries';
import { useAuth } from '../../providers/AuthProvider';
import { palette, radii, spacing } from '../../theme/tokens';

function maskPhone(phone: string) {
  const compact = phone.replace(/\s+/g, '');
  if (compact.length < 7) {
    return phone || '09XX XXX XXX';
  }
  return `${compact.slice(0, 4)} XXX ${compact.slice(-3)}`;
}

export function AdminProfileScreen() {
  const { session, logout, switchAccount } = useAuth();
  const { data: profile } = useProfileQuery();
  const { data: accountSlots } = useAccountSlotsQuery();

  if (!session) {
    return <LoadingState title="Loading admin profile" subtitle="Preparing account controls." />;
  }

  const adminAccountSlots = (accountSlots ?? []).filter(slot => slot.role === 'Admin');

  function confirmLogout() {
    Alert.alert('Log out', 'End this admin session on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => { logout().catch(() => undefined); } },
    ]);
  }

  return (
    <AppScreen>
      <TopAppBar title="Admin Profile" subtitle="Workspace account" rightLabel="Admin" />

      <SectionCard style={styles.heroCard}>
        <GeneratedAvatar descriptor={profile?.avatar} labelSeed={session.user.fullName} size={82} verified />
        <View style={styles.heroText}>
          <Text style={styles.name}>{session.user.fullName}</Text>
          <View style={styles.metaRow}>
            <Pill label="Admin" tone="active" />
            <Pill label={session.user.kycStatus} tone={session.user.kycStatus === 'Verified' ? 'good' : 'warn'} />
          </View>
          <Text style={styles.phone}>{maskPhone(session.user.phoneNumber)}</Text>
        </View>
      </SectionCard>

      <SectionCard>
        <TitleBlock title="Account details" subtitle="Operational profile used for admin audit actions." />
        <ListRow title="Phone number" subtitle={session.user.phoneNumber} leadingIcon="phone" />
        <ListRow title="University" subtitle={profile?.university ?? 'Not set'} leadingIcon="school" />
        <ListRow title="Role" subtitle="Admin workspace access" leadingIcon="admin-panel-settings" right={<Pill label="Active" tone="good" />} />
      </SectionCard>

      {adminAccountSlots.length ? (
        <SectionCard>
          <TitleBlock title="Saved accounts" subtitle="Switch between accounts stored on this device." />
          {adminAccountSlots.map(slot => (
            <ListRow
              key={slot.userId}
              title={slot.displayName}
              subtitle={slot.phoneNumber}
              leadingIcon="account-circle"
              right={<Pill label={slot.userId === session.user.userId ? 'Current' : slot.tokenState === 'Available' ? 'Switch' : 'Sign in'} tone={slot.userId === session.user.userId ? 'active' : 'neutral'} />}
              onPress={slot.userId === session.user.userId ? undefined : () => {
                switchAccount(slot.userId).catch(error => Alert.alert('Account switch', error instanceof Error ? error.message : 'Unable to switch accounts.'));
              }}
            />
          ))}
        </SectionCard>
      ) : null}

      <SectionCard>
        <TitleBlock title="Session" subtitle="Use this before handing the device to another reviewer." />
        <AppButton label="Log Out" icon="logout" variant="danger" onPress={confirmLogout} />
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  name: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  phone: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
