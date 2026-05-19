import React from 'react';
import { View } from 'react-native';
import { AppScreen, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useDashboardQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { MemberNav } from './shared';
import { memberStyles } from './styles';

export function ProfileScreen() {
  const { session, logout } = useAuth();
  const { data: dashboard } = useDashboardQuery();

  if (!session) {
    return <LoadingState title="Loading profile" subtitle="Preparing account and settings." />;
  }

  return (
    <AppScreen footer={<MemberNav active={routes.profile} />} footerFlush>
      <TopAppBar title="Profile And Settings" />
      <TitleBlock title={session.user.fullName} subtitle={`${session.user.role} - ${session.user.kycStatus}`} align="center" />
      {dashboard?.reliabilityProfile ? (
        <SectionCard>
          <TitleBlock title="Reliability label" subtitle="Public status only. Internal counters stay server-side for admin policy decisions." />
          <Pill
            label={dashboard.reliabilityProfile.public_status}
            tone={dashboard.reliabilityProfile.public_status === 'Trusted' ? 'good' : dashboard.reliabilityProfile.public_status === 'Restricted' || dashboard.reliabilityProfile.public_status === 'Banned' ? 'bad' : 'active'}
          />
          {dashboard.reliabilityProfile.public_status === 'Restricted' || dashboard.reliabilityProfile.public_status === 'Banned' ? (
            <StatusBanner tone="danger" title="Account actions are limited." body="Create, join, payment, or payout actions may be blocked until admin recovery is complete." />
          ) : null}
        </SectionCard>
      ) : null}
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
