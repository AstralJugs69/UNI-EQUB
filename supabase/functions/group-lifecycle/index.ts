import { fail, failFromError, json } from '../_shared/contracts.ts';
import type { CreateGroupRequest, GroupLifecyclePayload } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { activateApprovedGroupIfReady, activateDueApprovedGroups, getApprovedRequestForGroup } from '../_shared/groupActivation.ts';
import { freezeGroupForAdminReview, resolveOpenGroupFreeze } from '../_shared/groupFreeze.ts';
import { createFrozenGroupResolutionPoll, closeResolutionPollIfReady, getGroupResolutionState, voteOnResolutionPoll } from '../_shared/groupResolution.ts';
import { getRoundObligationProgress, markContributionObligationPaid, processDueContributionObligations } from '../_shared/obligations.ts';
import { finalizeRoundIfReady } from '../_shared/roundLifecycle.ts';
import { assertReliabilityAllowsNormalFlow, ensureReliabilityProfile, getReliabilityJoinGate } from '../_shared/reliability.ts';
import { ensureOpenRoundForGroup } from '../_shared/rounds.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { decideWinnerExitWindow, getWinnerExitWindowSummary } from '../_shared/winnerExit.ts';
import type { GroupRecord, KycSubmissionRecord, MembershipRecord, RoundRecord, TransactionRecord, UserRecord, UserReliabilityProfileRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppGroupRecord extends Omit<GroupRecord, 'Virtual_Acc_Ref'> {
  Virtual_Acc_Ref: string;
  Description: string;
}

interface DashboardSnapshot {
  currentGroup: AppGroupRecord | null;
  activeGroups: AppGroupRecord[];
  completedGroups: AppGroupRecord[];
  currentRound: RoundRecord | null;
  contributionDeadlineAt: string | null;
  joinWindowEndsAt?: string | null;
  paidCount: number;
  totalMembers: number;
  totalSaved: number;
  readyPayout: number;
  recentTransactions: TransactionRecord[];
  kycState: MemberKycState;
  reliabilityProfile: UserReliabilityProfileRecord;
  activeResolutionPoll?: unknown;
  latestResolutionPoll?: unknown;
  winnerExitWindow?: unknown;
}

function contributionDeadlineFromObligations(obligations: Array<{ due_at: string | null; status: string }>) {
  const dueTimes = obligations
    .filter(obligation => !['Paid', 'Waived', 'RefundPending'].includes(obligation.status))
    .map(obligation => obligation.due_at)
    .filter((value): value is string => !!value)
    .map(value => new Date(value).getTime())
    .filter(value => Number.isFinite(value));

  const fallbackDueTimes = obligations
    .map(obligation => obligation.due_at)
    .filter((value): value is string => !!value)
    .map(value => new Date(value).getTime())
    .filter(value => Number.isFinite(value));
  const selectedDueTimes = dueTimes.length ? dueTimes : fallbackDueTimes;

  if (!selectedDueTimes.length) {
    return null;
  }

  return new Date(Math.min(...selectedDueTimes)).toISOString();
}

function isDeadlineReached(deadline: string | null) {
  return !!deadline && new Date(deadline).getTime() <= Date.now();
}

interface MemberKycState {
  status: 'NotSubmitted' | 'PendingReview' | 'NeedsResubmission' | 'Verified' | 'Banned';
  canSubmit: boolean;
  latestSubmissionId?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  decisionNote?: string | null;
}

function toAppGroup(group: GroupRecord): AppGroupRecord {
  return {
    ...group,
    Amount: Number(group.Amount),
    Virtual_Acc_Ref: group.Virtual_Acc_Ref ?? '',
    Description: `${group.Frequency} contribution cycle with ${group.Max_Members} slots.`,
  };
}

function toTransactionRecord(transaction: TransactionRecord): TransactionRecord {
  return {
    ...transaction,
    Amount: Number(transaction.Amount),
  };
}

async function requireActor(token: string) {
  const payload = await verifySession(token);
  const userId = payload.sub;
  if (!userId) {
    throw new Error('Invalid session token.');
  }
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw error;
  }
  const user = data as UserRecord;
  if (user.KYC_Status === 'Banned') {
    throw new Error('This account has been banned.');
  }
  return user;
}

function assertAdmin(user: UserRecord) {
  if (user.Role !== 'Admin') {
    throw new Error('Admin access is required for this action.');
  }
}

function assertVerifiedMember(user: UserRecord) {
  if (user.Role !== 'Member') {
    throw new Error('This action is only available to members.');
  }
  if (user.KYC_Status !== 'Verified') {
    throw new Error('KYC verification is required for this action.');
  }
}

function validateCreateRequest(input: CreateGroupRequest) {
  if (!input.groupName.trim()) {
    throw new Error('Group name is required.');
  }
  if (input.amount <= 0) {
    throw new Error('Contribution amount must be positive.');
  }
  if (!['Daily', 'Weekly', 'Bi-weekly', 'Monthly'].includes(input.frequency)) {
    throw new Error('Invalid group frequency.');
  }
  if (input.maxMembers <= 1) {
    throw new Error('A group must allow at least 2 members.');
  }
}

async function requireGroup(groupId: string) {
  await activateDueApprovedGroups();
  const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Group_ID', groupId).single();
  if (error) {
    throw error;
  }
  const group = data as GroupRecord;
  if (group.Status === 'Pending') {
    const activation = await activateApprovedGroupIfReady({ group, request: await getApprovedRequestForGroup(group.Group_ID) });
    return activation.group;
  }
  return group;
}

async function getCreator(creatorId: string) {
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', creatorId).single();
  if (error) {
    throw error;
  }
  return data as UserRecord;
}

async function listActiveMemberships(groupId: string) {
  const { data, error } = await supabaseAdmin.from('GroupMembers').select('*').eq('Group_ID', groupId).eq('Status', 'Active');
  if (error) {
    throw error;
  }
  return (data ?? []) as MembershipRecord[];
}

async function getMembership(groupId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('GroupMembers')
    .select('*')
    .eq('Group_ID', groupId)
    .eq('User_ID', userId)
    .order('Joined_At', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as MembershipRecord | null;
}

async function ensureInitialRound(groupId: string) {
  const group = await requireGroup(groupId);
  return await ensureOpenRoundForGroup(group);
}

async function successfulContributions(roundId: string) {
  const { data, error } = await supabaseAdmin.from('Transaction').select('*').eq('Round_ID', roundId).eq('Type', 'Contribution').eq('Status', 'Successful');
  if (error) {
    throw error;
  }
  return (data ?? []) as TransactionRecord[];
}

async function settleObligationsFromSuccessfulTransactions(
  obligations: Array<{ id: string; user_id: string; status: string }>,
  transactions: TransactionRecord[],
) {
  const transactionsByUserId = new Map<string, TransactionRecord>();
  for (const transaction of transactions) {
    if (!transactionsByUserId.has(transaction.User_ID)) {
      transactionsByUserId.set(transaction.User_ID, transaction);
    }
  }

  for (const obligation of obligations) {
    if (['Paid', 'Waived', 'RefundPending'].includes(obligation.status)) {
      continue;
    }
    const transaction = transactionsByUserId.get(obligation.user_id);
    if (transaction) {
      await markContributionObligationPaid(obligation.id, transaction.Trans_ID, transaction.Date);
    }
  }
}

async function getWinnerHistory(groupId: string) {
  const { data, error } = await supabaseAdmin.from('Round').select('*').eq('Group_ID', groupId).not('Winner_ID', 'is', null).order('Round_Number', { ascending: false });
  if (error) {
    throw error;
  }
  const rounds = (data ?? []) as RoundRecord[];
  if (!rounds.length) {
    return [];
  }
  const winnerIds = [...new Set(rounds.map(round => round.Winner_ID).filter(Boolean))] as string[];
  const { data: users, error: usersError } = await supabaseAdmin.from('User').select('User_ID, Full_Name').in('User_ID', winnerIds);
  if (usersError) {
    throw usersError;
  }
  const winners = new Map((users ?? []).map(user => [user.User_ID as string, user.Full_Name as string]));
  return rounds.map(round => ({
    roundNumber: round.Round_Number,
    winnerName: winners.get(round.Winner_ID as string) ?? 'Unknown winner',
  }));
}

async function getLatestDraw(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('Round')
    .select('*')
    .eq('Group_ID', groupId)
    .not('Winner_ID', 'is', null)
    .order('Round_Number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const round = data as RoundRecord;
  const { data: winner, error: winnerError } = await supabaseAdmin
    .from('User')
    .select('User_ID, Full_Name')
    .eq('User_ID', round.Winner_ID)
    .maybeSingle();
  if (winnerError) {
    throw winnerError;
  }

  return {
    roundId: round.Round_ID,
    roundNumber: Number(round.Round_Number),
    winnerUserId: round.Winner_ID as string,
    winnerName: (winner?.Full_Name as string | undefined) ?? 'Unknown winner',
    drawDate: round.Draw_Date,
  };
}

function initialsForName(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

async function getStatusContributors(
  groupId: string,
  memberships: MembershipRecord[],
  paidUserIds: Set<string>,
  currentWinnerId: string | null | undefined,
) {
  const userIds = [...new Set(memberships.map(membership => membership.User_ID))];
  if (!userIds.length) {
    return [];
  }

  const [{ data: users, error: usersError }, { data: wonRounds, error: wonRoundsError }] = await Promise.all([
    supabaseAdmin.from('User').select('User_ID, Full_Name').in('User_ID', userIds),
    supabaseAdmin.from('Round').select('Winner_ID').eq('Group_ID', groupId).not('Winner_ID', 'is', null),
  ]);
  if (usersError) {
    throw usersError;
  }
  if (wonRoundsError) {
    throw wonRoundsError;
  }

  const userNames = new Map((users ?? []).map(user => [user.User_ID as string, user.Full_Name as string]));
  const winsByUserId = new Map<string, number>();
  for (const round of wonRounds ?? []) {
    const winnerId = round.Winner_ID as string | null;
    if (winnerId) {
      winsByUserId.set(winnerId, (winsByUserId.get(winnerId) ?? 0) + 1);
    }
  }

  return memberships.map(membership => {
    const fullName = userNames.get(membership.User_ID) ?? 'Member';
    return {
      userId: membership.User_ID,
      fullName,
      initials: initialsForName(fullName),
      joinedAt: membership.Joined_At,
      hasPaidCurrentRound: paidUserIds.has(membership.User_ID),
      isCurrentWinner: currentWinnerId === membership.User_ID,
      cyclesWon: winsByUserId.get(membership.User_ID) ?? 0,
    };
  });
}

async function getGroupStatusSnapshot(actor: UserRecord, groupId: string) {
  await processDueContributionObligations({ now: new Date(), limit: 200 });
  let group = await requireGroup(groupId);
  let currentRound = group.Status === 'Active' || group.Status === 'Frozen' ? await ensureOpenRoundForGroup(group) : null;
  if (!currentRound) {
    group = await requireGroup(groupId);
  }
  const memberships = await listActiveMemberships(groupId);
  let paidTransactions = currentRound ? await successfulContributions(currentRound.Round_ID) : [];
  let obligationProgress = currentRound
    ? await getRoundObligationProgress(currentRound.Round_ID, memberships, paidTransactions)
    : { paidCount: 0, totalMembers: memberships.length, unpaidCount: memberships.length, paidUserIds: new Set<string>(), obligations: [] };

  if (
    currentRound
    && group.Status === 'Active'
    && obligationProgress.totalMembers > 0
    && obligationProgress.paidCount === obligationProgress.totalMembers
    && currentRound.Status === 'Open'
  ) {
    await settleObligationsFromSuccessfulTransactions(obligationProgress.obligations, paidTransactions);
    await finalizeRoundIfReady(group, currentRound);
    const refreshedGroup = await requireGroup(groupId);
    currentRound = refreshedGroup.Status === 'Active' || refreshedGroup.Status === 'Frozen' ? await ensureOpenRoundForGroup(refreshedGroup) : null;
    paidTransactions = currentRound ? await successfulContributions(currentRound.Round_ID) : [];
    obligationProgress = currentRound
      ? await getRoundObligationProgress(currentRound.Round_ID, memberships, paidTransactions)
      : { paidCount: 0, totalMembers: memberships.length, unpaidCount: memberships.length, paidUserIds: new Set<string>(), obligations: [] };
  }

  const canCurrentUserPay = !!currentRound
    && group.Status === 'Active'
    && memberships.some(item => item.User_ID === actor.User_ID)
    && !obligationProgress.paidUserIds.has(actor.User_ID);

  const resolutionState = await getGroupResolutionState(groupId, actor.User_ID);
  const winnerExitWindow = await getWinnerExitWindowSummary(groupId, actor.User_ID);

  const contributionDeadlineAt = contributionDeadlineFromObligations(obligationProgress.obligations);
  const approvedRequest = group.Status === 'Pending' ? await getApprovedRequestForGroup(groupId) : null;

  return {
    group: toAppGroup(group),
    currentRound,
    contributionDeadlineAt,
    joinWindowEndsAt: approvedRequest?.join_window_ends_at ?? null,
    roundReadyForDraw: obligationProgress.totalMembers > 0
      && obligationProgress.paidCount === obligationProgress.totalMembers
      && isDeadlineReached(contributionDeadlineAt),
    paidCount: obligationProgress.paidCount,
    totalMembers: obligationProgress.totalMembers,
    winnerHistory: await getWinnerHistory(groupId),
    latestDraw: await getLatestDraw(groupId),
    contributors: await getStatusContributors(groupId, memberships, obligationProgress.paidUserIds, currentRound?.Winner_ID),
    activeResolutionPoll: resolutionState.activeResolutionPoll,
    latestResolutionPoll: resolutionState.latestResolutionPoll,
    winnerExitWindow,
    refundTickets: resolutionState.refundTickets,
    canCurrentUserPay,
    isFrozen: group.Status === 'Frozen',
  };
}

async function getDashboardSnapshot(actor: UserRecord): Promise<DashboardSnapshot> {
  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('GroupMembers')
    .select('*')
    .eq('User_ID', actor.User_ID)
    .eq('Status', 'Active')
    .order('Joined_At', { ascending: false });
  if (membershipError) {
    throw membershipError;
  }

  const memberGroups = await Promise.all(((memberships ?? []) as MembershipRecord[]).map(membership => requireGroup(membership.Group_ID)));
  const activeGroups = memberGroups.filter(group => group.Status !== 'Completed');
  const completedGroups = memberGroups.filter(group => group.Status === 'Completed');
  let currentMembership: MembershipRecord | undefined;
  let currentGroup: GroupRecord | null = null;
  let currentRound: RoundRecord | null = null;

  for (const membership of (memberships ?? []) as MembershipRecord[]) {
    const candidateGroup = await requireGroup(membership.Group_ID);
    if (candidateGroup.Status === 'Completed') {
      continue;
    }
    if (candidateGroup.Status === 'Pending') {
      continue;
    }
    const candidateRound = candidateGroup.Status === 'Active' || candidateGroup.Status === 'Frozen' ? await ensureOpenRoundForGroup(candidateGroup) : null;
    if (!candidateRound) {
      continue;
    }
    const candidateMemberships = await listActiveMemberships(candidateGroup.Group_ID);
    const candidateTransactions = await successfulContributions(candidateRound.Round_ID);
    const candidateProgress = await getRoundObligationProgress(candidateRound.Round_ID, candidateMemberships, candidateTransactions);
    if (!candidateProgress.paidUserIds.has(actor.User_ID)) {
      currentMembership = membership;
      currentGroup = candidateGroup;
      currentRound = candidateRound;
      break;
    }
    if (!currentMembership) {
      currentMembership = membership;
      currentGroup = candidateGroup;
      currentRound = candidateRound;
    }
  }

  if (!currentMembership && activeGroups.length) {
    currentGroup = activeGroups[0];
    currentRound = currentGroup.Status === 'Active' || currentGroup.Status === 'Frozen' ? await ensureOpenRoundForGroup(currentGroup) : null;
    currentMembership = ((memberships ?? []) as MembershipRecord[]).find(membership => membership.Group_ID === currentGroup?.Group_ID);
  }

  const paidTransactions = currentRound ? await successfulContributions(currentRound.Round_ID) : [];
  const activeMembers = currentGroup ? await listActiveMemberships(currentGroup.Group_ID) : [];
  const obligationProgress = currentRound
    ? await getRoundObligationProgress(currentRound.Round_ID, activeMembers, paidTransactions)
    : { paidCount: 0, totalMembers: activeMembers.length, unpaidCount: activeMembers.length, paidUserIds: new Set<string>(), obligations: [] };

  const { data: transactions, error: transactionError } = await supabaseAdmin
    .from('Transaction')
    .select('*')
    .eq('User_ID', actor.User_ID)
    .order('Date', { ascending: false })
    .limit(5);
  if (transactionError) {
    throw transactionError;
  }

  const { data: savedTransactions, error: savedError } = await supabaseAdmin
    .from('Transaction')
    .select('Amount')
    .eq('User_ID', actor.User_ID)
    .eq('Type', 'Contribution')
    .eq('Status', 'Successful');
  if (savedError) {
    throw savedError;
  }

  const { data: payoutTransactions, error: payoutError } = await supabaseAdmin
    .from('Transaction')
    .select('Amount')
    .eq('User_ID', actor.User_ID)
    .eq('Type', 'Payout')
    .eq('Status', 'Pending');
  if (payoutError) {
    throw payoutError;
  }
  const resolutionState = currentGroup
    ? await getGroupResolutionState(currentGroup.Group_ID, actor.User_ID)
    : { activeResolutionPoll: null, latestResolutionPoll: null };
  const winnerExitWindow = currentGroup ? await getWinnerExitWindowSummary(currentGroup.Group_ID, actor.User_ID) : null;

  return {
    currentGroup: currentGroup ? toAppGroup(currentGroup) : null,
    activeGroups: activeGroups.map(toAppGroup),
    completedGroups: completedGroups.map(toAppGroup),
    currentRound,
    contributionDeadlineAt: contributionDeadlineFromObligations(obligationProgress.obligations ?? []),
    paidCount: obligationProgress.paidCount,
    totalMembers: obligationProgress.totalMembers,
    totalSaved: (savedTransactions ?? []).reduce((sum, item) => sum + Number(item.Amount ?? 0), 0),
    readyPayout: (payoutTransactions ?? []).reduce((sum, item) => sum + Number(item.Amount ?? 0), 0),
    recentTransactions: ((transactions ?? []) as TransactionRecord[]).map(toTransactionRecord),
    kycState: await getMemberKycState(actor),
    reliabilityProfile: await ensureReliabilityProfile(actor.User_ID),
    activeResolutionPoll: resolutionState.activeResolutionPoll,
    latestResolutionPoll: resolutionState.latestResolutionPoll,
    winnerExitWindow,
  };
}

async function getMemberKycState(actor: UserRecord): Promise<MemberKycState> {
  if (actor.KYC_Status === 'Verified') {
    return { status: 'Verified', canSubmit: false };
  }
  if (actor.KYC_Status === 'Banned') {
    return { status: 'Banned', canSubmit: false };
  }

  const { data, error } = await supabaseAdmin
    .from('kyc_submissions')
    .select('*')
    .eq('user_id', actor.User_ID)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }

  const latest = data as KycSubmissionRecord | null;
  if (!latest) {
    return { status: actor.Student_ID_Img ? 'PendingReview' : 'NotSubmitted', canSubmit: !actor.Student_ID_Img };
  }

  if (latest.status === 'PendingReview') {
    return {
      status: 'PendingReview',
      canSubmit: false,
      latestSubmissionId: latest.id,
      submittedAt: latest.submitted_at,
      reviewedAt: latest.reviewed_at,
      decisionNote: latest.decision_note,
    };
  }

  if (latest.status === 'NeedsResubmission' || latest.status === 'Rejected') {
    return {
      status: 'NeedsResubmission',
      canSubmit: true,
      latestSubmissionId: latest.id,
      submittedAt: latest.submitted_at,
      reviewedAt: latest.reviewed_at,
      decisionNote: latest.decision_note,
    };
  }

  return {
    status: 'NotSubmitted',
    canSubmit: true,
    latestSubmissionId: latest.id,
    submittedAt: latest.submitted_at,
    reviewedAt: latest.reviewed_at,
    decisionNote: latest.decision_note,
  };
}

function buildVirtualRef(groupId: string) {
  return `UEQ-${groupId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  let actionName: string | undefined;
  try {
    const body = (await request.json()) as GroupLifecyclePayload;
    actionName = body.action;
    const actor = await requireActor(body.token);

    switch (body.action) {
      case 'listBrowseable': {
        await activateDueApprovedGroups();
        const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Status', 'Pending').order('Start_Date', { ascending: true });
        if (error) {
          throw error;
        }
        const approvedJoinWindowGroups: GroupRecord[] = [];
        for (const group of (data ?? []) as GroupRecord[]) {
          const request = await getApprovedRequestForGroup(group.Group_ID);
          if (request && !request.activated_at) {
            approvedJoinWindowGroups.push(group);
          }
        }
        return json({ groups: approvedJoinWindowGroups.map(toAppGroup) });
      }

      case 'getGroup': {
        if (!body.groupId) {
          return fail('Missing groupId.', 400);
        }
        return json({ group: toAppGroup(await requireGroup(body.groupId)) });
      }

      case 'getGroupStatus': {
        if (!body.groupId) {
          return fail('Missing groupId.', 400);
        }
        return json(await getGroupStatusSnapshot(actor, body.groupId));
      }

      case 'getDashboard':
        return json(await getDashboardSnapshot(actor));

      case 'createRequest': {
        if (!body.createRequest) {
          return fail('Missing create-group payload.', 400);
        }
        assertVerifiedMember(actor);
        await assertReliabilityAllowsNormalFlow(actor.User_ID);
        validateCreateRequest(body.createRequest);
        const { data, error } = await supabaseAdmin
          .from('EqubGroup')
          .insert({
            Creator_ID: actor.User_ID,
            Group_Name: body.createRequest.groupName.trim(),
            Amount: body.createRequest.amount,
            Max_Members: body.createRequest.maxMembers,
            Frequency: body.createRequest.frequency,
            Virtual_Acc_Ref: null,
            Status: 'Pending',
            Start_Date: new Date().toISOString().slice(0, 10),
          })
          .select('*')
          .single();
        if (error) {
          throw error;
        }
        return json({ group: toAppGroup(data as GroupRecord) }, 201);
      }

      case 'listPending': {
        assertAdmin(actor);
        const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').in('Status', ['Pending', 'Frozen']).order('Start_Date', { ascending: false });
        if (error) {
          throw error;
        }
        const pendingGroups = (data ?? []) as GroupRecord[];
        const items = await Promise.all(
          pendingGroups.map(async group => ({
            group: toAppGroup(group),
            creator: await getCreator(group.Creator_ID),
            note: group.Status === 'Frozen'
              ? 'Frozen group pending manual recovery resolution.'
              : 'Pending review against KYC, amount, frequency, and membership rules.',
          })),
        );
        return json({ items });
      }

      case 'approve': {
        assertAdmin(actor);
        if (!body.groupId) {
          return fail('Missing groupId for approval.', 400);
        }
        const group = await requireGroup(body.groupId);
        const { data, error } = await supabaseAdmin
          .from('EqubGroup')
          .update({
            Status: 'Active',
            Virtual_Acc_Ref: group.Virtual_Acc_Ref ?? buildVirtualRef(group.Group_ID),
          })
          .eq('Group_ID', group.Group_ID)
          .select('*')
          .single();
        if (error) {
          throw error;
        }
        const currentRound = await ensureInitialRound(group.Group_ID);
        return json({ group: toAppGroup(data as GroupRecord), currentRound });
      }

      case 'reject': {
        assertAdmin(actor);
        if (!body.groupId) {
          return fail('Missing groupId for rejection.', 400);
        }
        const group = await requireGroup(body.groupId);
        return json({
          group: toAppGroup(group),
          note: 'The fixed schema does not persist a separate rejected status. This request remains pending and unpublished.',
        });
      }

      case 'freeze': {
        assertAdmin(actor);
        if (!body.groupId) {
          return fail('Missing groupId for freeze.', 400);
        }
        const result = await freezeGroupForAdminReview({
          groupId: body.groupId,
          reason: 'ManualAdminFreeze',
          actor,
          metadata: { source: 'group-lifecycle.freeze' },
        });
        return json({ group: toAppGroup(result.group), freezeEvent: result.freezeEvent });
      }

      case 'resolveFreeze': {
        assertAdmin(actor);
        if (!body.groupId) {
          return fail('Missing groupId for freeze resolution.', 400);
        }
        const result = await resolveOpenGroupFreeze({
          groupId: body.groupId,
          admin: actor,
          resolutionAction: body.resolutionAction ?? 'ContinueWithReserveFrozen',
          resolutionNote: body.resolutionNote,
        });
        return json({ group: toAppGroup(result.group), freezeEvent: result.freezeEvent });
      }

      case 'createResolutionPoll': {
        assertAdmin(actor);
        if (!body.groupId) {
          return fail('Missing groupId for resolution poll.', 400);
        }
        return json(await createFrozenGroupResolutionPoll({ groupId: body.groupId, admin: actor }));
      }

      case 'voteResolutionPoll': {
        if (!body.groupId || !body.pollId || !body.optionId) {
          return fail('Missing poll vote payload.', 400);
        }
        assertVerifiedMember(actor);
        const vote = await voteOnResolutionPoll({
          groupId: body.groupId,
          pollId: body.pollId,
          optionId: body.optionId,
          voter: actor,
        });
        return json({ vote, ...(await getGroupResolutionState(body.groupId, actor.User_ID)) });
      }

      case 'closeResolutionPoll': {
        assertAdmin(actor);
        if (!body.groupId || !body.pollId) {
          return fail('Missing poll close payload.', 400);
        }
        await closeResolutionPollIfReady({ pollId: body.pollId, actor, forceExpired: true });
        return json(await getGroupResolutionState(body.groupId, actor.User_ID));
      }

      case 'decideWinnerExit': {
        if (!body.groupId || !body.winnerExitWindowId || !body.winnerExitDecision) {
          return fail('Missing winner exit decision payload.', 400);
        }
        if (actor.Role !== 'Admin') {
          assertVerifiedMember(actor);
        }
        const group = await requireGroup(body.groupId);
        const decision = await decideWinnerExitWindow({
          group,
          windowId: body.winnerExitWindowId,
          decision: body.winnerExitDecision,
          actor,
        });
        if (decision.shouldOpenNextRound) {
          const refreshedGroup = await requireGroup(body.groupId);
          if (refreshedGroup.Status === 'Active') {
            await ensureOpenRoundForGroup(refreshedGroup);
          }
        }
        return json({
          decision,
          ...(await getGroupStatusSnapshot(actor, body.groupId)),
        });
      }

      case 'join': {
        if (!body.groupId) {
          return fail('Missing groupId for join.', 400);
        }
        assertVerifiedMember(actor);
        const group = await requireGroup(body.groupId);
        if (group.Status !== 'Pending') {
          return fail(group.Status === 'Active' ? 'This group cycle has already started. New members can join the next join window if the group continues.' : 'This group is not open for joining.', 400);
        }
        const activeMemberships = await listActiveMemberships(group.Group_ID);
        if (activeMemberships.length >= group.Max_Members) {
          return fail('This group is already full.', 409);
        }
        const existingMembership = await getMembership(group.Group_ID, actor.User_ID);
        if (existingMembership?.Status === 'Active') {
          return fail('You are already a participant in this group.', 409);
        }
        const reliabilityGate = await getReliabilityJoinGate(actor.User_ID);
        if (!reliabilityGate.canJoinNormalGroup) {
          return fail(reliabilityGate.blockedReason ?? 'User is not eligible to join another active group.', 403);
        }
        const { data, error } = await supabaseAdmin
          .from('GroupMembers')
          .upsert({
            Membership_ID: existingMembership?.Membership_ID,
            Group_ID: group.Group_ID,
            User_ID: actor.User_ID,
            Joined_At: existingMembership?.Joined_At ?? new Date().toISOString(),
            Status: 'Active',
          })
          .select('*')
          .single();
        if (error) {
          throw error;
        }
        const activation = await activateApprovedGroupIfReady({
          group,
          request: await getApprovedRequestForGroup(group.Group_ID),
          actor,
        });
        return json({ membership: data as MembershipRecord, group: toAppGroup(activation.group), currentRound: activation.round });
      }

      default:
        return fail('Unsupported group lifecycle action.', 400);
    }
  } catch (error) {
    return failFromError(error, 'Unexpected group lifecycle error.', 500, { functionName: 'group-lifecycle', action: actionName });
  }
});
