import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, EmptyState, HeroCard, ListRow, LoadingState, MetricTile, PrimaryCTA, SecondaryCTA, SectionCard, StatusBanner, TopAppBar } from '../../components/ui';
import { useDashboardQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { MemberNav, formatCurrency } from './shared';
import { memberStyles } from './styles';

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { data } = useDashboardQuery();
  const group = data?.currentGroup;
  const recent = data?.recentTransactions?.[0];

  if (!session || !data) {
    return <LoadingState title="Loading dashboard" subtitle="Pulling current group status and savings activity." />;
  }

  const firstName = session.user.fullName.split(' ')[0];

  if (!group) {
    return (
      <AppScreen footer={<MemberNav active={routes.dashboard} />}>
        {session.user.kycStatus !== 'Verified' ? (
          <StatusBanner tone="warning" title="KYC review is still pending." body="Group creation and payout withdrawal stay locked until an admin approves your ID review." />
        ) : null}
        <TopAppBar title={firstName} subtitle="Welcome to UniEqub" rightLabel="New member" />
        <HeroCard>
          <Text style={memberStyles.heroValue}>Start your first cycle</Text>
          <Text style={memberStyles.heroBody}>Browse open groups or submit your own request when you are ready to begin saving.</Text>
          <View style={memberStyles.actionGroup}>
            <SecondaryCTA label="Browse Groups" onPress={() => navigation.navigate(routes.explore)} />
            <SecondaryCTA label="Create Equb" onPress={() => navigation.navigate(routes.createBasics)} />
          </View>
        </HeroCard>
        <View style={memberStyles.twoCol}>
          <MetricTile label="KYC Status" value={session.user.kycStatus} tone={session.user.kycStatus === 'Verified' ? 'good' : 'warn'} />
          <MetricTile label="Saved So Far" value={formatCurrency(data.totalSaved)} />
        </View>
        <EmptyState
          icon="groups-2"
          title="No active groups yet"
          subtitle="Once you join or create an approved Equb, your current round, payment status, reminders, and payouts will appear here."
        />
        <SectionCard>
          <Text style={memberStyles.sectionTitle}>What happens next</Text>
          <View style={memberStyles.listGroup}>
            <ListRow title="Join an active Equb" subtitle="Browse currently approved groups and take an open slot." leadingIcon="group-add" />
            <ListRow title="Create your own request" subtitle="Submit a verified group for admin approval and publication." leadingIcon="playlist-add-circle" />
            <ListRow title="Track every contribution" subtitle="Your history, reminders, and payout state will appear here once you start participating." leadingIcon="insights" />
          </View>
        </SectionCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen footer={<MemberNav active={routes.dashboard} />}>
      {session.user.kycStatus !== 'Verified' ? (
        <StatusBanner tone="warning" title="KYC review is still pending." body="You can view your cycle, but group creation and payout withdrawal remain restricted until approval." />
      ) : null}
      <TopAppBar title={firstName} subtitle="Member dashboard" rightLabel="Live" />
      <HeroCard>
        <Text style={memberStyles.heroValue}>{formatCurrency(group.Amount)}</Text>
        <Text style={memberStyles.heroBody}>{group.Group_Name} is at {data.paidCount}/{data.totalMembers} paid. Your contribution is the fastest way to push the round forward.</Text>
        <PrimaryCTA label="Pay This Round" onPress={() => navigation.navigate(routes.payment, { groupId: group.Group_ID })} />
      </HeroCard>
      <View style={memberStyles.twoCol}>
        <MetricTile label="Total Saved" value={formatCurrency(data.totalSaved)} helper="Successful contributions only" />
        <MetricTile label="Ready Payout" value={formatCurrency(data.readyPayout)} tone={data.readyPayout > 0 ? 'good' : 'neutral'} helper={data.readyPayout > 0 ? 'Available in wallet' : 'No pending payout'} />
      </View>
      <SectionCard variant="soft">
        <Text style={memberStyles.sectionTitle}>Current cycle</Text>
        <View style={memberStyles.listGroup}>
          <ListRow title={group.Group_Name} subtitle={`${group.Frequency} contribution cycle`} right={<Text style={memberStyles.strongText}>Round {data.currentRound?.Round_Number ?? '-'}</Text>} leadingIcon="savings" />
          <ListRow title="Progress" subtitle={`${data.paidCount} of ${data.totalMembers} members verified this round`} leadingIcon="pie-chart" />
          <ListRow title="Automation" subtitle="Winner selection and payout creation happen automatically when all verified payments are in." leadingIcon="auto-awesome" />
        </View>
      </SectionCard>
      <SectionCard>
        <Text style={memberStyles.sectionTitle}>Quick actions</Text>
        <View style={memberStyles.actionGroup}>
          <SecondaryCTA label="Open Group" onPress={() => navigation.navigate(routes.groupStatus, { groupId: group.Group_ID })} />
          <SecondaryCTA label="Explore More Groups" onPress={() => navigation.navigate(routes.explore)} />
          <SecondaryCTA label="Notifications" onPress={() => navigation.navigate(routes.notifications)} />
        </View>
      </SectionCard>
      <SectionCard>
        <Text style={memberStyles.sectionTitle}>Recent activity</Text>
        {recent ? (
          <ListRow
            title={`${recent.Type} ${recent.Status.toLowerCase()}`}
            subtitle={`${recent.Payment_Method} • ${formatCurrency(recent.Amount)}`}
            right={<Text style={memberStyles.mutedText}>{recent.Date.slice(0, 10)}</Text>}
            leadingIcon={recent.Type === 'Payout' ? 'payments' : 'account-balance'}
          />
        ) : (
          <EmptyState icon="schedule" title="No activity yet" subtitle="Your latest contribution or payout will appear here once the current cycle starts moving." />
        )}
      </SectionCard>
    </AppScreen>
  );
}
