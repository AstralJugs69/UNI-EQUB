import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { AppScreen, EmptyState, InlineError, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, SecondaryCTA, SectionCard, StatusBanner, TopAppBar } from '../../components/ui';
import { useGroupStatusQuery, useMemberActions } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { iconSize, palette, spacing } from '../../theme/tokens';
import type { GroupResolutionPollOptionRecord, GroupResolutionPollSummary } from '../../types/domain';
import { formatTimeLeft } from './shared';

function optionIcon(action: GroupResolutionPollOptionRecord['resolution_action']) {
  switch (action) {
    case 'ContinueWithReserveFrozen':
      return 'groups';
    case 'CreateRefundTickets':
      return 'payments';
    default:
      return 'gpp-maybe';
  }
}

function resultTitle(option?: GroupResolutionPollOptionRecord | null, expired?: boolean) {
  if (expired) {
    return 'No majority reached';
  }
  switch (option?.resolution_action) {
    case 'ContinueWithReserveFrozen':
      return option.option_label.includes('another') ? 'Continue another cycle' : 'Continue with missing member';
    case 'CreateRefundTickets':
      return 'Refund this round';
    case 'KeepFrozenForReview':
      return 'Freeze and escalate';
    default:
      return 'Voting result';
  }
}

function winningOption(poll: GroupResolutionPollSummary) {
  return poll.options.find(option => option.id === poll.poll.winning_option_id)
    ?? poll.options.find(option => (poll.voteCounts[option.id] ?? 0) >= poll.requiredVotes)
    ?? null;
}

function VoteBreakdown({ poll }: { poll: GroupResolutionPollSummary }) {
  const totalVotes = Object.values(poll.voteCounts).reduce((sum, count) => sum + count, 0);
  return (
    <View style={styles.breakdown}>
      {poll.options.map(option => {
        const count = poll.voteCounts[option.id] ?? 0;
        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return (
          <View key={option.id} style={styles.breakdownRow}>
            <View style={styles.breakdownLabel}>
              <Icon name={optionIcon(option.resolution_action)} size={16} color={palette.white} />
              <Text style={styles.breakdownText} numberOfLines={1}>{option.option_label}</Text>
            </View>
            <View style={styles.breakdownTrack}>
              <View style={[styles.breakdownFill, { width: `${percent}%` }]} />
            </View>
            <Text style={styles.breakdownCount}>{count} vote{count === 1 ? '' : 's'}</Text>
            <Text style={styles.breakdownPercent}>{percent}%</Text>
          </View>
        );
      })}
    </View>
  );
}

export function ResolutionVoteScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const groupId = route.params?.groupId ?? '';
  const { data: status } = useGroupStatusQuery(groupId);
  const { voteResolutionPoll } = useMemberActions();
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [error, setError] = useState('');

  const poll = status?.activeResolutionPoll ?? null;
  const latestPoll = status?.latestResolutionPoll ?? poll;
  const selectedOption = poll?.options.find(option => option.id === selectedOptionId) ?? null;
  const winner = latestPoll ? winningOption(latestPoll) : null;
  const totalVotes = latestPoll ? Object.values(latestPoll.voteCounts).reduce((sum, count) => sum + count, 0) : 0;
  const approvalRate = latestPoll && totalVotes > 0 && winner ? Math.round(((latestPoll.voteCounts[winner.id] ?? 0) / totalVotes) * 100) : 0;

  useEffect(() => {
    if (!selectedOptionId && poll?.options[0]) {
      setSelectedOptionId(poll.options[0].id);
    }
  }, [poll?.options, selectedOptionId]);

  if (!groupId || !status) {
    return <LoadingState title="Loading vote" subtitle="Opening the current group resolution state." />;
  }

  if (!poll && latestPoll) {
    const expired = latestPoll.poll.status === 'Expired' && !winner;
    return (
      <AppScreen>
        <TopAppBar title="Voting Result" onBack={() => navigation.goBack()} rightLabel={expired ? 'No consensus' : winner?.option_label ?? 'Closed'} />
        <View style={styles.resultHero}>
          <View style={styles.heroPill}>
            <Icon name="groups" size={16} color={palette.white} />
            <Text style={styles.heroPillText}>{status.group.Group_Name}</Text>
          </View>
          <Text style={styles.resultTitle}>{resultTitle(winner, expired)}</Text>
          <Text style={styles.resultBody}>
            {expired
              ? 'Voting ended without a majority. This case has been escalated for admin review.'
              : winner?.resolution_action === 'CreateRefundTickets'
                ? 'This round will be cancelled and eligible contributions will be returned as refund tickets.'
                : winner?.resolution_action === 'ContinueWithReserveFrozen'
                  ? 'The group approved a continuation path. The next round will reopen from the database state.'
                  : 'The group remains paused until an admin resolves the case.'}
          </Text>
          <View style={styles.resultMetrics}>
            <MetricTile label="Total votes" value={String(totalVotes)} helper={`${latestPoll.eligibleVoterCount} eligible`} />
            <MetricTile label="Approval rate" value={`${approvalRate}%`} helper={winner ? 'Winning option' : 'No majority'} />
          </View>
          <VoteBreakdown poll={latestPoll} />
        </View>
        <SectionCard>
          <ListRow title="Outcome" subtitle={expired ? 'Admin review required' : resultTitle(winner)} leadingIcon={expired ? 'gpp-maybe' : 'task-alt'} />
          <ListRow title="Group status" subtitle={status.group.Status === 'Frozen' ? 'Paused' : status.group.Status} leadingIcon="pause-circle" />
          <ListRow title="Next review" subtitle={expired ? 'Within 2 business days' : 'Applied automatically when possible'} leadingIcon="event" />
        </SectionCard>
        <StatusBanner tone={expired ? 'warning' : 'success'} title="Next steps" body={expired ? 'Admins will review this outcome and decide the next action. Members will be notified once a decision is made.' : 'The result has been recorded. Open the group status page to see the updated cycle state.'} />
        <PrimaryCTA label="View Group Status" icon="groups" onPress={() => navigation.navigate(routes.groupStatus, { groupId })} />
        <SecondaryCTA label="Back to Home" icon="home" onPress={() => navigation.navigate(routes.memberTabs, { screen: routes.dashboard })} />
      </AppScreen>
    );
  }

  if (!poll) {
    return (
      <AppScreen>
        <TopAppBar title="Round Resolution Vote" onBack={() => navigation.goBack()} />
        <EmptyState icon="how-to-vote" title="No vote is open" subtitle="This group does not currently need member resolution." />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <TopAppBar title="Round Resolution Vote" onBack={() => navigation.goBack()} rightLabel="Open" />
      <SectionCard>
        <View style={styles.voteIntro}>
          <View style={styles.voteIntroIcon}>
            <Icon name="gpp-maybe" size={iconSize.md} color={palette.primary} />
          </View>
          <Text style={styles.voteIntroText}>
            {poll.poll.metadata?.source === 'roundLifecycle.cycleComplete'
              ? 'This Equb cycle has completed. Eligible members must vote on whether to continue, refund, or escalate.'
              : 'A paused contribution case needs a member decision before the group can move forward.'}
          </Text>
        </View>
        <View style={styles.voteMetrics}>
          <MetricTile label="Eligible voters" value={String(poll.eligibleVoterCount)} />
          <MetricTile label="Votes cast" value={`${Object.values(poll.voteCounts).reduce((sum, count) => sum + count, 0)}/${poll.eligibleVoterCount}`} />
          <MetricTile label="Ends in" value={formatTimeLeft(poll.poll.closes_at)} />
        </View>
      </SectionCard>
      <Text style={styles.sectionHeading}>Vote on the next action</Text>
      {poll.options.map((option, index) => {
        const selected = selectedOptionId === option.id;
        return (
          <Pressable key={option.id} accessibilityRole="radio" onPress={() => setSelectedOptionId(option.id)} style={[styles.optionCard, selected && styles.optionCardSelected]}>
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.optionIcon}>
              <Icon name={optionIcon(option.resolution_action)} size={iconSize.md} color={palette.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{option.option_label}</Text>
              <Text style={styles.optionBody}>{option.option_description}</Text>
            </View>
            {index === 0 ? <Pill label="Recommended" tone="active" /> : null}
          </Pressable>
        );
      })}
      <InlineError message={error} />
      <PrimaryCTA
        label="Submit Vote"
        icon="how-to-vote"
        loading={voteResolutionPoll.isPending}
        disabled={!selectedOption}
        onPress={() => {
          if (!selectedOption) {
            return;
          }
          setError('');
          voteResolutionPoll.mutate({ groupId, pollId: poll.poll.id, optionId: selectedOption.id }, {
            onError: err => setError(err instanceof Error ? err.message : 'Unable to submit vote.'),
          });
        }}
      />
      <SecondaryCTA label="View voting rules" icon="description" onPress={() => undefined} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  voteIntro: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  voteIntroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primarySoft,
  },
  voteIntroText: {
    flex: 1,
    color: palette.text,
    fontWeight: '700',
    lineHeight: 21,
  },
  voteMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sectionHeading: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: palette.white,
  },
  optionCardSelected: {
    borderColor: palette.primary,
    backgroundColor: '#f5f9ff',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: palette.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.primary,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primarySoft,
  },
  optionText: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    color: palette.text,
    fontWeight: '900',
  },
  optionBody: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  resultHero: {
    gap: spacing.md,
    borderRadius: 14,
    padding: spacing.lg,
    backgroundColor: palette.primary,
  },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  heroPillText: {
    color: palette.white,
    fontWeight: '800',
    fontSize: 12,
  },
  resultTitle: {
    color: palette.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  resultBody: {
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 21,
    fontWeight: '700',
  },
  resultMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  breakdown: {
    gap: spacing.sm,
  },
  breakdownRow: {
    gap: 6,
  },
  breakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breakdownText: {
    flex: 1,
    color: palette.white,
    fontSize: 12,
    fontWeight: '900',
  },
  breakdownTrack: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.success,
  },
  breakdownCount: {
    position: 'absolute',
    right: 44,
    top: 0,
    color: palette.white,
    fontSize: 12,
    fontWeight: '800',
  },
  breakdownPercent: {
    position: 'absolute',
    right: 0,
    top: 0,
    color: palette.white,
    fontSize: 12,
    fontWeight: '900',
  },
});
