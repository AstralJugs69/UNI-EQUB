import React, { memo, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { EmptyState, ListRow, LoadingState, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, StatusBanner } from '../../components/ui';
import { useDashboardQuery, useGroupStatusQuery, useMemberActions } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { iconSize, palette } from '../../theme/tokens';
import type { GroupStatusSnapshot } from '../../types/domain';
import { memberStyles } from './styles';

const MAX_RING_MEMBERS = 10;
const RING_SIZE = 304;
const RING_CENTER = RING_SIZE / 2;

type ContributorState = 'notPaid' | 'paid' | 'winner';

interface RingContributor {
  id: string;
  name: string;
  initials: string;
  joined: string;
  cyclesWon: number;
  hasPaid: boolean;
  isWinner: boolean;
}

function getRingConfig(count: number) {
  return count <= 5
    ? {
        pillRadius: 102,
        winnerRadius: 116,
        buttonW: 30,
        buttonH: 48,
        pillW: 17,
        pillH: 44,
        border: 2.5,
        padding: 2.5,
        outerInset: 46,
        innerInset: 76,
      }
    : {
        pillRadius: 104,
        winnerRadius: 116,
        buttonW: 26,
        buttonH: 44,
        pillW: 15,
        pillH: 40,
        border: 2.25,
        padding: 2.25,
        outerInset: 46,
        innerInset: 76,
      };
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function contributorState(contributor: RingContributor): ContributorState {
  if (contributor.isWinner) {
    return 'winner';
  }
  return contributor.hasPaid ? 'paid' : 'notPaid';
}

function stateLabel(state: ContributorState) {
  if (state === 'winner') {
    return 'Winner';
  }
  return state === 'paid' ? 'Paid' : 'Not paid';
}

function joinedLabel(value: string) {
  if (!value) {
    return '-';
  }
  return value.slice(0, 10);
}

function toRingContributors(status: GroupStatusSnapshot): RingContributor[] {
  if (status.contributors?.length) {
    return status.contributors.map(contributor => ({
      id: contributor.userId,
      name: contributor.fullName,
      initials: contributor.initials,
      joined: contributor.joinedAt,
      cyclesWon: contributor.cyclesWon,
      hasPaid: contributor.hasPaidCurrentRound,
      isWinner: contributor.isCurrentWinner,
    }));
  }

  return Array.from({ length: status.totalMembers }).map((_, index) => ({
    id: `member-${index + 1}`,
    name: `Member ${index + 1}`,
    initials: `M${index + 1}`,
    joined: '',
    cyclesWon: 0,
    hasPaid: index < status.paidCount,
    isWinner: false,
  }));
}

function buildContributorLayout(contributors: RingContributor[], config: ReturnType<typeof getRingConfig>) {
  return contributors.map((contributor, index) => {
    const angle = -90 + index * (360 / contributors.length);
    const normal = polarToCartesian(RING_CENTER, RING_CENTER, config.pillRadius, angle);
    const winner = polarToCartesian(RING_CENTER, RING_CENTER, config.winnerRadius, angle);

    return {
      ...contributor,
      rotation: angle + 90,
      normalX: normal.x,
      normalY: normal.y,
      winnerX: winner.x,
      winnerY: winner.y,
    };
  });
}

const ContributorPill = memo(function ContributorPill({
  contributor,
  selected,
  config,
  onSelect,
}: {
  contributor: ReturnType<typeof buildContributorLayout>[number];
  selected: boolean;
  config: ReturnType<typeof getRingConfig>;
  onSelect: (id: string) => void;
}) {
  const state = contributorState(contributor);
  const isWinner = state === 'winner';
  const x = isWinner ? contributor.winnerX : contributor.normalX;
  const y = isWinner ? contributor.winnerY : contributor.normalY;
  const scale = selected ? 1.06 : isWinner ? 1.03 : 1;

  return (
    <Pressable
      accessibilityLabel={`${contributor.name}, ${stateLabel(state)}`}
      accessibilityRole="button"
      onPress={() => onSelect(contributor.id)}
      style={[
        memberStyles.ringPillButton,
        (selected || isWinner) && memberStyles.ringPillButtonRaised,
        {
          width: config.buttonW,
          height: config.buttonH,
          transform: [
            { translateX: x - config.buttonW / 2 },
            { translateY: y - config.buttonH / 2 },
            { rotate: `${contributor.rotation}deg` },
            { scale },
          ],
        },
      ]}
    >
      <View
        style={[
          memberStyles.ringPillShell,
          state === 'paid' && memberStyles.ringPillShellPaid,
          state === 'winner' && memberStyles.ringPillShellWinner,
          selected && memberStyles.ringPillSelected,
          {
            width: config.pillW,
            height: config.pillH,
            borderWidth: config.border,
            padding: config.padding,
          },
        ]}
      >
        <View
          style={[
            memberStyles.ringPillInner,
            state === 'paid' && memberStyles.ringPillInnerPaid,
            state === 'winner' && memberStyles.ringPillInnerWinner,
          ]}
        />
      </View>
    </Pressable>
  );
});

function WinnerSection({ winner, round }: { winner: RingContributor | undefined; round?: number }) {
  if (!winner) {
    return null;
  }

  return (
    <View style={memberStyles.ringWinnerSection}>
      <View style={memberStyles.ringWinnerIcon}>
        <Icon name="emoji-events" size={iconSize.md} color="#4A2A00" />
      </View>
      <View style={memberStyles.ringWinnerText}>
        <Text style={memberStyles.ringWinnerEyebrow}>Winner</Text>
        <Text style={memberStyles.ringWinnerName} numberOfLines={1}>{winner.name}</Text>
        <Text style={memberStyles.ringWinnerMeta}>Drawn for Round {round ?? '-'}</Text>
      </View>
    </View>
  );
}

function ContributorProfile({
  contributor,
  onClose,
}: {
  contributor: RingContributor | undefined;
  onClose: () => void;
}) {
  if (!contributor) {
    return null;
  }

  const state = contributorState(contributor);

  return (
    <View style={memberStyles.ringProfile}>
      <View style={memberStyles.ringProfileAvatar}>
        <Text style={memberStyles.ringProfileInitials}>{contributor.initials}</Text>
      </View>
      <View style={memberStyles.ringProfileBody}>
        <View style={memberStyles.rowBetween}>
          <View style={memberStyles.ringProfileNameWrap}>
            <Text style={memberStyles.ringProfileName} numberOfLines={1}>{contributor.name}</Text>
            <Text style={memberStyles.ringProfileMeta}>{joinedLabel(contributor.joined)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close contributor profile" onPress={onClose} style={memberStyles.ringProfileClose}>
            <Icon name="close" size={iconSize.sm} color={palette.textMuted} />
          </Pressable>
        </View>
        <View style={memberStyles.ringProfileStats}>
          <View style={memberStyles.ringProfileStat}>
            <Text style={memberStyles.ringProfileStatLabel}>Status</Text>
            <Text
              style={[
                memberStyles.ringProfileState,
                state === 'paid' && memberStyles.ringProfileStatePaid,
                state === 'winner' && memberStyles.ringProfileStateWinner,
              ]}
            >
              {stateLabel(state)}
            </Text>
          </View>
          <View style={memberStyles.ringProfileStat}>
            <Text style={memberStyles.ringProfileStatLabel}>Joined</Text>
            <Text style={memberStyles.ringProfileStatValue}>{joinedLabel(contributor.joined)}</Text>
          </View>
          <View style={memberStyles.ringProfileStat}>
            <Text style={memberStyles.ringProfileStatLabel}>Won</Text>
            <Text style={memberStyles.ringProfileStatValue}>{contributor.cyclesWon}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function ContributionRing({
  status,
}: {
  status: GroupStatusSnapshot;
}) {
  const contributors = useMemo(() => toRingContributors(status).slice(0, MAX_RING_MEMBERS), [status]);
  const config = useMemo(() => getRingConfig(contributors.length), [contributors.length]);
  const layout = useMemo(() => buildContributorLayout(contributors, config), [contributors, config]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = contributors.find(contributor => contributor.id === selectedId);
  const winner = contributors.find(contributor => contributor.isWinner);
  const paidCount = contributors.filter(contributor => contributor.hasPaid).length;
  const allPaid = paidCount === contributors.length && contributors.length > 0;

  return (
    <View style={memberStyles.ringCard}>
      <View style={memberStyles.rowWrap}>
        <View style={memberStyles.ringTopPillBlue}>
          <Text style={memberStyles.ringTopPillBlueText}>Round {status.currentRound?.Round_Number ?? '-'}</Text>
        </View>
        <View style={memberStyles.ringTopPillAmber}>
          <Text style={memberStyles.ringTopPillAmberText}>{allPaid ? 'Ready' : status.isFrozen ? 'Frozen' : 'Waiting'}</Text>
        </View>
      </View>
      <View style={memberStyles.ringCanvas}>
        <View style={[memberStyles.ringOuter, { top: config.outerInset, right: config.outerInset, bottom: config.outerInset, left: config.outerInset }]} />
        <View style={[memberStyles.ringInner, { top: config.innerInset, right: config.innerInset, bottom: config.innerInset, left: config.innerInset }]} />
        {layout.map(contributor => (
          <ContributorPill
            key={contributor.id}
            contributor={contributor}
            config={config}
            selected={contributor.id === selectedId}
            onSelect={id => setSelectedId(current => (current === id ? null : id))}
          />
        ))}
        <View style={memberStyles.ringCounter}>
          <Text style={memberStyles.ringCounterTitle}>{paidCount} of {contributors.length} paid</Text>
          <Text style={memberStyles.ringCounterSubtitle}>Verified contributions only.</Text>
          {allPaid && !winner ? <Text style={memberStyles.ringReadyLabel}>ready to draw</Text> : null}
        </View>
      </View>
      <View style={memberStyles.ringNote}>
        <Icon name="shield" size={iconSize.sm} color={palette.primaryDark} />
        <Text style={memberStyles.ringNoteText}>The round closes only when every active member is paid.</Text>
      </View>
      <WinnerSection winner={winner} round={status.currentRound?.Round_Number} />
      <ContributorProfile contributor={selected} onClose={() => setSelectedId(null)} />
      {status.totalMembers > MAX_RING_MEMBERS ? (
        <Text style={memberStyles.ringOverflowNote}>Showing first {MAX_RING_MEMBERS} contributors for mobile readability.</Text>
      ) : null}
    </View>
  );
}

function Header({ title, status, onBack }: { title: string; status: string; onBack: () => void }) {
  return (
    <View style={memberStyles.groupStatusHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={memberStyles.groupStatusBack}>
        <Icon name="arrow-back" size={iconSize.md} color={palette.text} />
      </Pressable>
      <Text style={memberStyles.groupStatusTitle} numberOfLines={2}>{title}</Text>
      <View style={memberStyles.groupStatusPill}>
        <Text style={memberStyles.groupStatusPillText}>{status}</Text>
      </View>
    </View>
  );
}

function ResolutionPollSection({
  status,
  onVote,
  voting,
}: {
  status: GroupStatusSnapshot;
  onVote: (pollId: string, optionId: string) => void;
  voting: boolean;
}) {
  const poll = status.activeResolutionPoll;
  if (!poll) {
    return null;
  }

  const alreadyVoted = !!poll.currentUserVote;
  const closesOn = poll.poll.closes_at.slice(0, 10);

  return (
    <SectionCard style={memberStyles.pollCard}>
      <View style={memberStyles.rowBetween}>
        <Text style={memberStyles.pollTitle}>Resolution vote</Text>
        <Pill label={alreadyVoted ? 'Voted' : 'Open'} tone={alreadyVoted ? 'good' : 'warn'} />
      </View>
      <Text style={memberStyles.pollBody}>
        {poll.eligibleVoterCount} eligible members. {poll.requiredVotes} votes are needed by {closesOn}.
      </Text>
      <View style={memberStyles.listGroup}>
        {poll.options.map(option => {
          const count = poll.voteCounts[option.id] ?? 0;
          const selected = poll.currentUserVote?.option_id === option.id;
          return (
            <View key={option.id} style={memberStyles.pollOption}>
              <View style={memberStyles.pollOptionText}>
                <Text style={memberStyles.pollOptionTitle}>{option.option_label}</Text>
                <Text style={memberStyles.pollOptionBody}>{option.option_description}</Text>
                <Text style={memberStyles.pollOptionMeta}>{count}/{poll.requiredVotes} votes</Text>
              </View>
              <SecondaryCTA
                label={selected ? 'Selected' : 'Vote'}
                onPress={() => onVote(poll.poll.id, option.id)}
                loading={voting && !alreadyVoted}
                disabled={voting || alreadyVoted}
              />
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}

function RefundTicketSection({ status }: { status: GroupStatusSnapshot }) {
  const tickets = status.refundTickets ?? [];
  if (!tickets.length) {
    return null;
  }

  return (
    <SectionCard style={memberStyles.winnerHistoryCard}>
      <View style={memberStyles.rowBetween}>
        <Text style={memberStyles.winnerHistoryTitle}>Refund tickets</Text>
        <Pill label={`${tickets.length} simulated`} tone="neutral" />
      </View>
      <View style={memberStyles.listGroup}>
        {tickets.map(ticket => (
          <ListRow
            key={ticket.id}
            title={`${ticket.amount} ${ticket.currency}`}
            subtitle={ticket.reason}
            right={<Pill label={ticket.status} tone={ticket.status === 'Created' ? 'warn' : 'neutral'} />}
            leadingIcon="receipt-long"
          />
        ))}
      </View>
    </SectionCard>
  );
}

export function GroupStatusScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data: dashboard } = useDashboardQuery();
  const groupId = route.params?.groupId ?? dashboard?.currentGroup?.Group_ID ?? '';
  const { data: status } = useGroupStatusQuery(groupId);
  const { voteResolutionPoll } = useMemberActions();

  if (!status) {
    return <LoadingState title="Loading group" subtitle="Pulling round progress, payment status, and winner history." />;
  }

  return (
    <ScreenScroll>
      <Header title={status.group.Group_Name} status={status.group.Status} onBack={() => navigation.goBack()} />
      <ContributionRing status={status} />
      {status.isFrozen ? <StatusBanner tone="danger" title="This group is currently frozen." body="Payments and round advancement stay paused until the compliance review is lifted." /> : null}
      <ResolutionPollSection
        status={status}
        voting={voteResolutionPoll.isPending}
        onVote={(pollId, optionId) => voteResolutionPoll.mutate({ groupId: status.group.Group_ID, pollId, optionId })}
      />
      <RefundTicketSection status={status} />
      <SectionCard style={memberStyles.winnerHistoryCard}>
        <Text style={memberStyles.winnerHistoryTitle}>Winner history</Text>
        {status.winnerHistory.length ? (
          <View style={memberStyles.winnerHistoryList}>
            {status.winnerHistory.map(item => (
              <View key={`${item.roundNumber}-${item.winnerName}`} style={memberStyles.winnerHistoryRow}>
                <View style={memberStyles.winnerHistoryIcon}>
                  <Icon name="emoji-events" size={iconSize.md} color={palette.primary} />
                </View>
                <View style={memberStyles.winnerHistoryText}>
                  <Text style={memberStyles.winnerHistoryRound}>Round {item.roundNumber}</Text>
                  <Text style={memberStyles.winnerHistoryName}>{item.winnerName}</Text>
                </View>
                <Icon name="chevron-right" size={iconSize.md} color={palette.textSoft} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState icon="hourglass-top" title="No winners yet" subtitle="Winner history starts populating after the first round closes." />
        )}
      </SectionCard>
      <PrimaryCTA label={status.canCurrentUserPay ? 'Pay Contribution' : 'Contribution Not Available'} onPress={() => navigation.navigate(routes.payment, { groupId: status.group.Group_ID })} disabled={!status.canCurrentUserPay} />
    </ScreenScroll>
  );
}
