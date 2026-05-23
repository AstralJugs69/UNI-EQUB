import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, ListRow, LoadingState, MetricTile, Pill, PrimaryCTA, ScreenScroll, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { useGroupQuery, useGroupStatusQuery, useMemberActions } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { formatCurrency, formatTimeLeft, groupStudents } from './shared';
import { memberStyles } from './styles';

export function GroupDetailScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const groupId = route.params?.groupId ?? '';
  const { data } = useGroupQuery(groupId);
  const { data: status } = useGroupStatusQuery(groupId);
  const { joinGroup } = useMemberActions();
  const [error, setError] = useState('');

  if (!data) {
    return <LoadingState title="Loading group preview" subtitle="Pulling membership rules, running cycle, and live contribution state." />;
  }
  const safeGroup = data;
  const paidCount = status?.paidCount ?? 0;
  const totalMembers = status?.totalMembers ?? safeGroup.Max_Members;
  const progressPercent = totalMembers > 0 ? Math.round((paidCount / totalMembers) * 100) : 0;
  const openSlots = Math.max(safeGroup.Max_Members - totalMembers, 0);
  const currentRound = status?.currentRound?.Round_Number ?? '-';
  const contributors = status?.contributors ?? [];
  const winner = status?.winnerHistory?.[0];
  const isJoinWindow = safeGroup.Status === 'Pending';

  async function handleJoin() {
    try {
      setError('');
      await joinGroup.mutateAsync(safeGroup.Group_ID);
      navigation.navigate(routes.groupStatus, { groupId: safeGroup.Group_ID, flash: safeGroup.Max_Members - totalMembers <= 1 ? 'Group joined. The cycle is starting now.' : 'Group joined. Contributions begin when the join window closes.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join this group right now.');
    }
  }

  const joinDisabled = !isJoinWindow || openSlots <= 0 || joinGroup.isPending;

  return (
    <ScreenScroll>
      <TopAppBar title="Group Preview" onBack={() => navigation.goBack()} rightLabel={openSlots > 0 ? `${openSlots} open` : 'Full'} />
      <View style={memberStyles.imageHeroWrap}>
        <Image source={groupStudents} style={memberStyles.imageHero} resizeMode="cover" />
      </View>
      <View style={memberStyles.previewHeroCard}>
        <View style={memberStyles.previewHeroTitleRow}>
          <Text style={memberStyles.previewHeroTitle}>{safeGroup.Group_Name}</Text>
          <Pill label={openSlots > 0 ? `${openSlots} open` : 'Full'} tone={openSlots > 0 ? 'good' : 'warn'} />
        </View>
        <Text style={memberStyles.previewHeroBody}>{safeGroup.Description}</Text>
        <View style={memberStyles.rowWrap}>
          <Pill label={isJoinWindow ? 'Open For Joining' : safeGroup.Status} tone={safeGroup.Status === 'Active' ? 'good' : safeGroup.Status === 'Pending' ? 'warn' : 'bad'} />
          <Pill label={isJoinWindow ? 'Cycle not started' : `Round ${currentRound}`} tone="active" />
          <Pill label={safeGroup.Frequency} tone="neutral" />
        </View>
        <View style={memberStyles.formationProgressTrack}>
          <View style={[memberStyles.formationProgressFill, { width: `${Math.min(100, Math.round((totalMembers / safeGroup.Max_Members) * 100))}%` }]} />
        </View>
        <Text style={memberStyles.mutedText}>
          {isJoinWindow
            ? 'Join before the wait time ends. Contributions and draws are still paused.'
            : 'The current cycle has already started, so the draw pool is locked.'}
        </Text>
      </View>
      {isJoinWindow ? (
        <StatusBanner tone="info" title="Join window is open" body="Contributions and draws start when the wait time ends, or immediately if the group reaches max members first." />
      ) : safeGroup.Status === 'Active' ? (
        <StatusBanner tone="warning" title="Cycle already started" body="This member set is locked for the current cycle. New members can join only if the group continues and opens a new join window." />
      ) : (
        <StatusBanner tone="warning" title="This group is not open for joining." body="Only approved groups in their join window can accept new members." />
      )}

      <SectionCard>
        <TitleBlock title={isJoinWindow ? 'Joining status' : 'Running cycle'} subtitle={isJoinWindow ? 'The draw pool is still forming. No contribution is due yet.' : 'Live stats from the current group cycle.'} />
        <View style={memberStyles.metricsGrid}>
          <MetricTile label="Contribution" value={formatCurrency(safeGroup.Amount)} />
          <MetricTile label={isJoinWindow ? 'Joined' : 'Paid This Round'} value={`${isJoinWindow ? totalMembers : paidCount}/${safeGroup.Max_Members}`} helper={isJoinWindow ? `${openSlots} open slots` : `${progressPercent}% verified`} tone={progressPercent === 100 ? 'good' : 'active'} />
          <MetricTile label={isJoinWindow ? 'Join Window' : 'Time Left'} value={formatTimeLeft(isJoinWindow ? status?.joinWindowEndsAt : status?.contributionDeadlineAt)} />
          <MetricTile label="Open Slots" value={`${openSlots}/${safeGroup.Max_Members}`} tone={openSlots > 0 ? 'good' : 'warn'} />
        </View>
      </SectionCard>

      <SectionCard>
        <TitleBlock title="Group details" subtitle="Creator, reference, cycle size, and winner context." />
        <View style={memberStyles.listGroup}>
          <ListRow title="Creator" subtitle={safeGroup.Creator_ID} leadingIcon="person" />
          <ListRow title="Virtual reference" subtitle={safeGroup.Virtual_Acc_Ref || 'Pending'} leadingIcon="badge" />
          <ListRow title="Maximum members" subtitle={`${safeGroup.Max_Members}`} leadingIcon="groups" />
          <ListRow title="Latest winner" subtitle={winner ? `${winner.winnerName} - Round ${winner.roundNumber}` : 'No completed draw yet'} leadingIcon="emoji-events" />
        </View>
      </SectionCard>

      <SectionCard>
        <TitleBlock title={isJoinWindow ? 'Joined members' : 'Contributors'} subtitle={isJoinWindow ? 'These members will enter the first draw pool when the cycle starts.' : "Current active members and this round's payment state."} />
        <View style={memberStyles.listGroup}>
          {contributors.length ? contributors.map(contributor => (
            <ListRow
              key={contributor.userId}
              title={contributor.fullName}
              subtitle={`${contributor.cyclesWon} win${contributor.cyclesWon === 1 ? '' : 's'} so far`}
              leadingIcon={contributor.isCurrentWinner ? 'emoji-events' : 'account-circle'}
              right={<Pill label={isJoinWindow ? 'Joined' : contributor.hasPaidCurrentRound ? 'Paid' : 'Due'} tone={isJoinWindow || contributor.hasPaidCurrentRound ? 'good' : 'warn'} />}
            />
          )) : (
            <Text style={memberStyles.mutedText}>Contributor details will appear once the current round opens.</Text>
          )}
        </View>
      </SectionCard>

      <SectionCard>
        <TitleBlock title="Membership rules" subtitle="These are the expectations every member accepts before joining." />
        <View style={memberStyles.listGroup}>
          <ListRow title="Verified payment required every round" subtitle="Only paid members are eligible for the draw." leadingIcon="verified" />
          <ListRow title="Winner cannot win twice in the same cycle" subtitle="Previous winners are excluded until the cycle resets." leadingIcon="casino" />
          <ListRow title="Automatic payout creation" subtitle="Payout records are generated after each draw, with reserves applied when required." leadingIcon="payments" />
        </View>
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA
        label={isJoinWindow ? (openSlots <= 0 ? 'Group Full' : 'Join Before Cycle Starts') : safeGroup.Status === 'Active' ? 'Cycle Already Started' : 'Not Open For Joining'}
        onPress={handleJoin}
        loading={joinGroup.isPending}
        disabled={joinDisabled}
      />
    </ScreenScroll>
  );
}
