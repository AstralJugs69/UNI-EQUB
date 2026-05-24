import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { AppScreen, EmptyState, HeroCard, ListRow, LoadingState, MetricTile, Pill, SecondaryCTA, SectionCard, StatusBanner } from '../../components/ui';
import { useDashboardQuery, useGroupStatusQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { iconSize, palette } from '../../theme/tokens';
import { formatCurrency, formatTimeLeft } from './shared';
import { memberStyles } from './styles';

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

export function DashboardScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { data } = useDashboardQuery();
  const group = data?.currentGroup;
  const { data: groupStatus } = useGroupStatusQuery(group?.Group_ID ?? '');
  const recent = data?.recentTransactions?.[0];

  if (!session || !data) {
    return <LoadingState title="Loading dashboard" subtitle="Pulling current group status and savings activity." />;
  }

  const firstName = session.user.fullName.split(' ')[0];
  const kycState = data.kycState ?? { status: session.user.kycStatus === 'Verified' ? 'Verified' : session.user.kycStatus === 'Banned' ? 'Banned' : 'PendingReview', canSubmit: session.user.kycStatus === 'Unverified' };
  const kycBanner = kycState.status === 'NeedsResubmission'
    ? { title: 'KYC needs resubmission.', body: kycState.decisionNote ?? 'Upload clearer student ID documents to unlock full member actions.' }
    : kycState.status !== 'Verified'
      ? { title: 'KYC review is still pending.', body: 'Group creation and payout withdrawal stay locked until an admin approves your ID review.' }
      : null;

  if (!group) {
    const completedGroups = data.completedGroups ?? [];
    return (
      <AppScreen>
        {route?.params?.flash ? <StatusBanner tone="success" title={route.params.flash} /> : null}
        {kycBanner ? <StatusBanner tone="warning" title={kycBanner.title} body={kycBanner.body} /> : null}
        <HeroCard>
          <Text style={memberStyles.heroValue}>Hi {firstName}</Text>
          <Text style={memberStyles.heroBody}>Browse open groups or submit your own request when you are ready to begin saving.</Text>
          <View style={memberStyles.actionGroup}>
            <SecondaryCTA label="Browse Groups" onPress={() => navigation.navigate(routes.explore)} />
            <SecondaryCTA label="Create Equb" onPress={() => navigation.navigate(routes.explore)} />
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
        {completedGroups.length ? (
          <SectionCard>
            <Text style={memberStyles.sectionTitle}>Past Equbs</Text>
            <View style={memberStyles.listGroup}>
              {completedGroups.map(item => (
                <ListRow
                  key={item.Group_ID}
                  title={item.Group_Name}
                  subtitle={`${item.Frequency} - ${formatCurrency(item.Amount)}`}
                  right={<Pill label="Completed" tone="good" />}
                  leadingIcon="history"
                />
              ))}
            </View>
          </SectionCard>
        ) : null}
      </AppScreen>
    );
  }

  const currentRound = groupStatus?.currentRound ?? data.currentRound;
  const paidCount = groupStatus?.paidCount ?? data.paidCount;
  const totalMembers = groupStatus?.totalMembers ?? data.totalMembers;
  const contributionDeadlineAt = groupStatus?.contributionDeadlineAt ?? data.contributionDeadlineAt;
  const roundNumber = currentRound?.Round_Number ?? '-';
  const progressPercent = totalMembers > 0 ? Math.round((paidCount / totalMembers) * 100) : 0;
  const timeLeft = formatTimeLeft(contributionDeadlineAt);
  const voteActive = !!data.activeResolutionPoll;
  const votesCast = data.activeResolutionPoll ? Object.values(data.activeResolutionPoll.voteCounts).reduce((sum, count) => sum + count, 0) : 0;
  const votePercent = data.activeResolutionPoll?.eligibleVoterCount ? Math.round((votesCast / data.activeResolutionPoll.eligibleVoterCount) * 100) : 0;
  const cycleActive = group.Status === 'Active' && !!currentRound;
  const frozen = groupStatus?.isFrozen || group.Status === 'Frozen';
  const allPaidWaiting = cycleActive && paidCount === totalMembers && totalMembers > 0 && !groupStatus?.roundReadyForDraw && !groupStatus?.latestDraw;
  const drawFinalizing = cycleActive && !!groupStatus?.roundReadyForDraw && !groupStatus?.latestDraw;
  const alreadyPaid = cycleActive && groupStatus ? !groupStatus.canCurrentUserPay : false;
  const completed = group.Status === 'Completed' || (!currentRound && group.Status !== 'Active' && group.Status !== 'Pending');
  const heroPrimaryLabel = voteActive
    ? 'Vote'
    : frozen
      ? 'View Status'
      : completed
        ? 'History'
        : cycleActive
          ? alreadyPaid
            ? 'Already Paid'
            : 'Pay'
          : 'History';
  const heroPrimaryIcon = voteActive
    ? 'how-to-vote'
    : frozen || alreadyPaid
      ? 'task-alt'
      : completed
        ? 'receipt-long'
        : cycleActive
          ? 'account-balance-wallet'
          : 'receipt-long';
  const heroPrimaryTarget = () => {
    if (voteActive) {
      navigation.navigate(routes.resolutionVote, { groupId: group.Group_ID });
      return;
    }
    if (cycleActive && !alreadyPaid && !frozen) {
      navigation.navigate(routes.payment, { groupId: group.Group_ID });
      return;
    }
    if (frozen || alreadyPaid) {
      navigation.navigate(routes.groupStatus, { groupId: group.Group_ID });
      return;
    }
    navigation.navigate(routes.memberTabs, { screen: routes.history });
  };
  const heroBody = voteActive
    ? 'This round is now in voting. All eligible members must vote to resolve the round and move forward.'
    : frozen
      ? 'This Equb is paused for recovery review. Payments and draws stay locked until the case is resolved.'
      : completed
        ? 'This Equb cycle is complete. You can review past rounds, payouts, and contribution history.'
        : drawFinalizing
          ? 'All contributions are in. The winner draw is finalizing from the group cycle page.'
          : allPaidWaiting
            ? 'Everyone has paid. The draw waits for the contribution window to close.'
            : cycleActive
              ? alreadyPaid
                ? 'Your contribution is recorded. Track the remaining time and group progress until the draw opens.'
                : `${group.Group_Name} is at ${paidCount}/${totalMembers} paid. Your contribution keeps the round moving.`
              : `${group.Group_Name} has no open round. Review your history or open another active group.`;
  const detailLabel = voteActive ? 'Details' : frozen ? 'Review' : completed ? 'Groups' : 'Details';

  return (
    <AppScreen>
      {route?.params?.flash ? <StatusBanner tone="success" title={route.params.flash} /> : null}
      {kycBanner ? <StatusBanner tone="warning" title={kycBanner.title} body={kycBanner.body} /> : null}
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
            <Text style={memberStyles.dashboardRoundText}>Round {roundNumber}</Text>
          </View>
        </View>
        <Text style={memberStyles.dashboardHeroAmount}>{formatCurrency(group.Amount)}</Text>
        <Text style={memberStyles.dashboardHeroBody}>
          {cycleActive && !voteActive && !frozen && !completed && !drawFinalizing && !allPaidWaiting && !alreadyPaid
            ? <>{group.Group_Name} is at <Text style={memberStyles.dashboardHeroBodyStrong}>{paidCount}/{totalMembers}</Text> paid. Your contribution keeps the round moving.</>
            : heroBody}
        </Text>
        <View style={memberStyles.dashboardHeroActions}>
          {voteActive ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={heroPrimaryTarget}
                style={memberStyles.heroPayButton}
              >
                <Icon name={heroPrimaryIcon} size={iconSize.md} color={palette.primary} />
                <Text style={memberStyles.heroPayButtonText}>{heroPrimaryLabel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate(routes.groupStatus, { groupId: group.Group_ID })}
                style={memberStyles.heroDetailsButton}
              >
                <Icon name="description" size={iconSize.md} color={palette.white} />
                <Text style={memberStyles.heroDetailsButtonText}>Details</Text>
              </Pressable>
            </>
          ) : cycleActive || frozen ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={heroPrimaryTarget}
                style={memberStyles.heroPayButton}
              >
                <Icon name={heroPrimaryIcon} size={iconSize.md} color={palette.primary} />
                <Text style={memberStyles.heroPayButtonText}>{heroPrimaryLabel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate(routes.groupStatus, { groupId: group.Group_ID })}
                style={memberStyles.heroDetailsButton}
              >
                <Icon name="description" size={iconSize.md} color={palette.white} />
                <Text style={memberStyles.heroDetailsButtonText}>{detailLabel}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate(routes.memberTabs, { screen: routes.history })}
                style={memberStyles.heroPayButton}
              >
                <Icon name="receipt-long" size={iconSize.md} color={palette.primary} />
                <Text style={memberStyles.heroPayButtonText}>History</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate(routes.activeGroups)}
                style={memberStyles.heroDetailsButton}
              >
                <Icon name="groups" size={iconSize.md} color={palette.white} />
                <Text style={memberStyles.heroDetailsButtonText}>Groups</Text>
              </Pressable>
            </>
          )}
        </View>
        <View style={memberStyles.dashboardHeroDivider} />
        <View style={memberStyles.dashboardHeroDetailRow}>
          <View style={memberStyles.dashboardHeroIcon}>
            <Icon name="schedule" size={iconSize.md} color={palette.primaryDark} />
          </View>
          <View style={memberStyles.dashboardHeroDetailText}>
            <Text style={memberStyles.dashboardHeroDetailTitle}>Time left</Text>
            <Text style={memberStyles.dashboardHeroDetailBody}>
              {voteActive
                ? formatTimeLeft(data.activeResolutionPoll?.poll.closes_at)
                : frozen
                  ? 'Paused for review'
                  : completed
                    ? 'Cycle complete'
                    : timeLeft}
            </Text>
          </View>
        </View>
        <View style={memberStyles.dashboardHeroDetailRow}>
          <View style={memberStyles.dashboardHeroIcon}>
            <Icon name="pie-chart" size={iconSize.md} color={palette.primaryDark} />
          </View>
          <View style={memberStyles.dashboardHeroDetailText}>
            <Text style={memberStyles.dashboardHeroDetailTitle}>Progress</Text>
            <Text style={memberStyles.dashboardHeroDetailBody}>
              {voteActive
                ? `${votesCast} of ${data.activeResolutionPoll?.eligibleVoterCount ?? totalMembers} members have voted`
                : completed
                  ? 'All cycle rounds are complete'
                  : `${paidCount} of ${totalMembers} members verified this round`}
            </Text>
          </View>
          <View style={memberStyles.dashboardProgressPill}>
            <Text style={memberStyles.dashboardProgressText}>{voteActive ? votePercent : progressPercent}%</Text>
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
      <SectionCard style={memberStyles.dashboardPanel}>
        <Text style={memberStyles.dashboardSectionTitle}>Quick actions</Text>
        <View style={memberStyles.quickActionGrid}>
          <QuickActionTile icon="groups" label="Open Group" onPress={() => navigation.navigate(routes.groupStatus, { groupId: group.Group_ID })} />
          <QuickActionTile icon="travel-explore" label="Explore Groups" onPress={() => navigation.navigate(routes.explore)} />
          <QuickActionTile icon="add-box" label="Create Equb" onPress={() => navigation.navigate(routes.explore)} />
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
