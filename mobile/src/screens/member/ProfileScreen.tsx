import React from 'react';
import { View } from 'react-native';
import { AppScreen, ListRow, LoadingState, MetricTile, PrimaryCTA, SectionCard, TopAppBar, TitleBlock } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { MemberNav } from './shared';
import { memberStyles } from './styles';

export function ProfileScreen() {
  const { session, logout } = useAuth();

  if (!session) {
    return <LoadingState title="Loading profile" subtitle="Preparing account and settings." />;
  }

  return (
    <AppScreen footer={<MemberNav active={routes.profile} />} footerFlush>
      <TopAppBar title="Profile And Settings" />
      <TitleBlock title={session.user.fullName} subtitle={`${session.user.role} - ${session.user.kycStatus}`} align="center" />
      <SectionCard>
        <TitleBlock title="Account snapshot" subtitle="Keep the most important profile details visible without pushing the settings sections too far down the screen." />
        <View style={memberStyles.metricsGrid}>
          <MetricTile label="University" value="Addis Ababa University" />
          <MetricTile label="Year" value="3rd Year" />
        </View>
      </SectionCard>
      <SectionCard variant="soft">
        <TitleBlock title="Preferences" subtitle="These values describe the current Android demo setup for the member account." />
        <ListRow title="Notifications" subtitle="Push and SMS reminders enabled" leadingIcon="notifications" />
        <ListRow title="Security" subtitle="Secure token storage enabled" leadingIcon="lock" />
        <ListRow title="KYC state" subtitle={session.user.kycStatus} leadingIcon="badge" />
      </SectionCard>
      <PrimaryCTA label="Log Out" onPress={logout} icon="logout" />
    </AppScreen>
  );
}
