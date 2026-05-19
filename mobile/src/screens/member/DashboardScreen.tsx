import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DemoModeBanner } from '../../components/DemoModeBanner';
import { Icon } from '../../components/Icon';
import { AppScreen, EmptyState, HeroCard, ListRow, LoadingState, MetricTile, SecondaryCTA, SectionCard, StatusBanner } from '../../components/ui';
import { useDashboardQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { iconSize, palette } from '../../theme/tokens';
import type { SessionUser } from '../../types/domain';
import { MemberNav, formatCurrency } from './shared';
import { memberStyles } from './styles';

function ProfileHeader({
  user,
  expanded,
  onToggle,
}: {
  user: SessionUser;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <View style={memberStyles.dashboardHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show profile details"
          onPress={onToggle}
          style={memberStyles.profileIconButton}
        >
          <Icon name="person" size={iconSize.md} color={palette.primaryDark} />
        </Pressable>
      </View>
      {expanded ? (
        <View style={memberStyles.profileDetailsPanel}>
          <View>
            <Text style={memberStyles.profileName}>{user.fullName}</Text>
            <Text style={memberStyles.profileMeta}>{user.phoneNumber}</Text>
          </View>
          <View style={memberStyles.profileStatusPill}>
            <Text style={memberStyles.profileStatusText}>{user.kycStatus}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

function MiniMetric({
  icon,
  label,
  value,
  helper,
  active,
}: {
  icon: string;
  label: string;
  value: string;
  helper: string;
  active?: boolean;
}) {
  return (
    <View style={memberStyles.miniMetricCard}>
      <View style={[memberStyles.miniMetricIcon, active && memberStyles.miniMetricIconActive]}>
        <Icon name={icon} size={18} color={active ? palette.success : palette.primaryDark} />
      </View>
      <View style={memberStyles.miniMetricText}>
        <Text style={memberStyles.miniMetricLabel}>{label}</Text>
        <Text style={memberStyles.miniMetricValue}>{value}</Text>
        <Text style={memberStyles.miniMetricHelper} numberOfLines={1}>{helper}</Text>
      </View>
    </View>
  );
}

function QuickActionTile({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={memberStyles.quickActionTile}>
      <View style={memberStyles.quickActionIcon}>
        <Icon name={icon} size={iconSize.sm} color={palette.primary} />
      </View>
      <Text style={memberStyles.quickActionText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { data } = useDashboardQuery();
  const [profileExpanded, setProfileExpanded] = useState(false);
  const group = data?.currentGroup;
  const recent = data?.recentTransactions?.[0];

  if (!session || !data) {
    return <LoadingState title="Loading dashboard" subtitle="Pulling current group status and savings activity." />;
  }

  const firstName = session.user.fullName.split(' ')[0];

  if (!group) {
    return (
      <AppScreen footer={<MemberNav active={routes.dashboard} />} footerFlush>
        <DemoModeBanner />
        {session.user.kycStatus !== 'Verified' ? (
          <StatusBanner tone="warning" title="KYC review is still pending." body="Group creation and payout withdrawal stay locked until an admin approves your ID review." />
        ) : null}
        <ProfileHeader user={session.user} expanded={profileExpanded} onToggle={() => setProfileExpanded(current => !current)} />
        <HeroCard>
          <Text style={memberStyles.heroValue}>Hi {firstName}</Text>
          <Text style={memberStyles.heroBody}>Browse open groups or submit your own request when you are ready to begin saving.</Text>
          <View style={memberStyles.actionGroup}>
            <SecondaryCTA label="Browse Groups" onPress={() => navigation.navigate(routes.explore)} />
            <SecondaryCTA label="Create Equb" onPress={() => navigation.navigate(routes.createBasics)} />
          </View>
        </HeroCard>
        <View style={memberStyles.metricsGrid}>
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

  const roundNumber = data.currentRound?.Round_Number ?? '-';
  const progressPercent = data.totalMembers > 0 ? Math.round((data.paidCount / data.totalMembers) * 100) : 0;

  return (
    <AppScreen footer={<MemberNav active={routes.dashboard} />} footerFlush>
      <DemoModeBanner />
      {session.user.kycStatus !== 'Verified' ? (
        <StatusBanner tone="warning" title="KYC review is still pending." body="You can view your cycle, but group creation and payout withdrawal remain restricted until approval." />
      ) : null}
      <ProfileHeader user={session.user} expanded={profileExpanded} onToggle={() => setProfileExpanded(current => !current)} />
      <View style={memberStyles.dashboardHeroCard}>
        <View pointerEvents="none" style={memberStyles.dashboardHeroArt}>
          <View style={memberStyles.dashboardVaultBody}>
            <View style={memberStyles.dashboardVaultDoor}>
              <View style={memberStyles.dashboardVaultDial} />
            </View>
          </View>
          <View style={memberStyles.dashboardCoinStack}>
            <View style={memberStyles.dashboardCoin} />
            <View style={[memberStyles.dashboardCoin, memberStyles.dashboardCoinOffset]} />
            <View style={[memberStyles.dashboardCoin, memberStyles.dashboardCoinLower]} />
          </View>
        </View>
        <View style={memberStyles.dashboardHeroTopRow}>
          <View style={memberStyles.dashboardHeroPill}>
            <Icon name="groups" size={18} color={palette.white} />
            <Text style={memberStyles.dashboardHeroPillText} numberOfLines={1}>{group.Group_Name}</Text>
          </View>
          <View style={memberStyles.dashboardRoundPill}>
            <Text style={memberStyles.dashboardRoundText}>Cycle {roundNumber}</Text>
          </View>
        </View>
        <Text style={memberStyles.dashboardHeroAmount}>{formatCurrency(group.Amount)}</Text>
        <Text style={memberStyles.dashboardHeroBody}>
          {group.Group_Name} is at <Text style={memberStyles.dashboardHeroBodyStrong}>{data.paidCount}/{data.totalMembers}</Text> paid. Your contribution is the fastest way to push the round forward.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate(routes.payment, { groupId: group.Group_ID })}
          style={memberStyles.heroPayButton}
        >
          <Text style={memberStyles.heroPayButtonText}>Pay This Round</Text>
          <Icon name="arrow-forward" size={iconSize.md} color={palette.primary} />
        </Pressable>
        <View style={memberStyles.dashboardHeroDivider} />
        <View style={memberStyles.dashboardHeroDetailRow}>
          <View style={memberStyles.dashboardHeroIcon}>
            <Icon name="calendar-month" size={iconSize.md} color={palette.primaryDark} />
          </View>
          <View style={memberStyles.dashboardHeroDetailText}>
            <Text style={memberStyles.dashboardHeroDetailTitle}>Cycle</Text>
            <Text style={memberStyles.dashboardHeroDetailBody}>{group.Frequency} contribution cycle</Text>
          </View>
          <Icon name="chevron-right" size={iconSize.md} color="rgba(255,255,255,0.86)" />
        </View>
        <View style={memberStyles.dashboardHeroDetailRow}>
          <View style={memberStyles.dashboardHeroIcon}>
            <Icon name="pie-chart" size={iconSize.md} color={palette.primaryDark} />
          </View>
          <View style={memberStyles.dashboardHeroDetailText}>
            <Text style={memberStyles.dashboardHeroDetailTitle}>Progress</Text>
            <Text style={memberStyles.dashboardHeroDetailBody}>{data.paidCount} of {data.totalMembers} members verified this round</Text>
          </View>
          <View style={memberStyles.dashboardProgressPill}>
            <Text style={memberStyles.dashboardProgressText}>{progressPercent}%</Text>
          </View>
        </View>
      </View>
      <View style={memberStyles.dashboardMiniMetrics}>
        <MiniMetric icon="trending-up" label="Total Saved" value={formatCurrency(data.totalSaved)} helper="Contributions only" />
        <MiniMetric
          icon="account-balance-wallet"
          label="Ready Payout"
          value={formatCurrency(data.readyPayout)}
          helper={data.readyPayout > 0 ? 'Released payout' : 'No released payout'}
          active={data.readyPayout > 0}
        />
      </View>
      {data.reliabilityProfile ? (
        <StatusBanner
          tone={data.reliabilityProfile.public_status === 'Trusted' ? 'success' : data.reliabilityProfile.public_status === 'Restricted' || data.reliabilityProfile.public_status === 'Banned' ? 'danger' : 'info'}
          title={`Reliability: ${data.reliabilityProfile.public_status}`}
          body={data.reliabilityProfile.public_status === 'Trusted'
            ? 'Your public label supports full standard payout handling.'
            : 'This public label is based on completed cycles and payment reliability.'}
        />
      ) : null}
      <SectionCard style={memberStyles.dashboardPanel}>
        <Text style={memberStyles.dashboardSectionTitle}>Quick actions</Text>
        <View style={memberStyles.quickActionGrid}>
          <QuickActionTile icon="groups" label="Open Group" onPress={() => navigation.navigate(routes.groupStatus, { groupId: group.Group_ID })} />
          <QuickActionTile icon="travel-explore" label="Explore Groups" onPress={() => navigation.navigate(routes.explore)} />
          <QuickActionTile icon="add-box" label="Create Equb" onPress={() => navigation.navigate(routes.createBasics)} />
          <QuickActionTile icon="notifications" label="Notifications" onPress={() => navigation.navigate(routes.notifications)} />
        </View>
      </SectionCard>
      <SectionCard style={memberStyles.dashboardPanel}>
        <Text style={memberStyles.dashboardSectionTitle}>Recent activity</Text>
        {recent ? (
          <View style={memberStyles.recentActivityRow}>
            <View style={memberStyles.recentActivityIcon}>
              <Icon name={recent.Type === 'Payout' ? 'payments' : 'account-balance'} size={iconSize.sm} color={palette.primary} />
            </View>
            <View style={memberStyles.recentActivityText}>
              <Text style={memberStyles.recentActivityTitle}>{recent.Type} {recent.Status.toLowerCase()}</Text>
              <Text style={memberStyles.recentActivityMeta}>{recent.Payment_Method} - {formatCurrency(recent.Amount)}</Text>
            </View>
            <Text style={memberStyles.recentActivityDate}>{recent.Date.slice(0, 10)}</Text>
          </View>
        ) : (
          <EmptyState icon="schedule" title="No activity yet" subtitle="Your latest contribution or payout will appear here once the current cycle starts moving." />
        )}
      </SectionCard>
    </AppScreen>
  );
}
