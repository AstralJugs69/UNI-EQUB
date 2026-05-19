import { fail, failFromError, json } from '../_shared/contracts.ts';
import type { CreateGroupRequest, GroupLifecyclePayload } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { freezeGroupForAdminReview, resolveOpenGroupFreeze } from '../_shared/groupFreeze.ts';
import { getRoundObligationProgress } from '../_shared/obligations.ts';
import { assertReliabilityAllowsNormalFlow, getReliabilityJoinGate } from '../_shared/reliability.ts';
import { ensureOpenRoundForGroup } from '../_shared/rounds.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupRecord, MembershipRecord, RoundRecord, TransactionRecord, UserRecord } from '../_shared/types.ts';

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
  currentRound: RoundRecord | null;
  paidCount: number;
  totalMembers: number;
  totalSaved: number;
  readyPayout: number;
  recentTransactions: TransactionRecord[];
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
  const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Group_ID', groupId).single();
  if (error) {
    throw error;
  }
  return data as GroupRecord;
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
  const { data, error } = await supabaseAdmin.from('GroupMembers').select('*').eq('Group_ID', groupId).eq('User_ID', userId).maybeSingle();
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
  const group = await requireGroup(groupId);
  const currentRound = await ensureOpenRoundForGroup(group);
  const memberships = await listActiveMemberships(groupId);
  const paidTransactions = currentRound ? await successfulContributions(currentRound.Round_ID) : [];
  const obligationProgress = currentRound
    ? await getRoundObligationProgress(currentRound.Round_ID, memberships, paidTransactions)
    : { paidCount: 0, totalMembers: memberships.length, paidUserIds: new Set<string>() };
  const canCurrentUserPay = !!currentRound
    && group.Status === 'Active'
    && memberships.some(item => item.User_ID === actor.User_ID)
    && !obligationProgress.paidUserIds.has(actor.User_ID);

  return {
    group: toAppGroup(group),
    currentRound,
    paidCount: obligationProgress.paidCount,
    totalMembers: obligationProgress.totalMembers,
    winnerHistory: await getWinnerHistory(groupId),
    contributors: await getStatusContributors(groupId, memberships, obligationProgress.paidUserIds, currentRound?.Winner_ID),
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

  let currentMembership: MembershipRecord | undefined;
  let currentGroup: GroupRecord | null = null;
  let currentRound: RoundRecord | null = null;

  for (const membership of (memberships ?? []) as MembershipRecord[]) {
    const candidateGroup = await requireGroup(membership.Group_ID);
    const candidateRound = await ensureOpenRoundForGroup(candidateGroup);
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

  if (!currentMembership) {
    currentMembership = (memberships ?? [])[0] as MembershipRecord | undefined;
    currentGroup = currentMembership ? await requireGroup(currentMembership.Group_ID) : null;
    currentRound = currentGroup ? await ensureOpenRoundForGroup(currentGroup) : null;
  }

  const paidTransactions = currentRound ? await successfulContributions(currentRound.Round_ID) : [];
  const activeMembers = currentGroup ? await listActiveMemberships(currentGroup.Group_ID) : [];
  const obligationProgress = currentRound
    ? await getRoundObligationProgress(currentRound.Round_ID, activeMembers, paidTransactions)
    : { paidCount: 0, totalMembers: activeMembers.length };

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

  return {
    currentGroup: currentGroup ? toAppGroup(currentGroup) : null,
    currentRound,
    paidCount: obligationProgress.paidCount,
    totalMembers: obligationProgress.totalMembers,
    totalSaved: (savedTransactions ?? []).reduce((sum, item) => sum + Number(item.Amount ?? 0), 0),
    readyPayout: (payoutTransactions ?? []).reduce((sum, item) => sum + Number(item.Amount ?? 0), 0),
    recentTransactions: ((transactions ?? []) as TransactionRecord[]).map(toTransactionRecord),
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

  try {
    const body = (await request.json()) as GroupLifecyclePayload;
    const actor = await requireActor(body.token);

    switch (body.action) {
      case 'listBrowseable': {
        const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Status', 'Active').order('Start_Date', { ascending: true });
        if (error) {
          throw error;
        }
        return json({ groups: ((data ?? []) as GroupRecord[]).map(toAppGroup) });
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

      case 'join': {
        if (!body.groupId) {
          return fail('Missing groupId for join.', 400);
        }
        assertVerifiedMember(actor);
        const group = await requireGroup(body.groupId);
        if (group.Status !== 'Active') {
          return fail('Only active groups can be joined.', 400);
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
        const currentRound = await ensureInitialRound(group.Group_ID);
        return json({ membership: data as MembershipRecord, group: toAppGroup(group), currentRound });
      }

      default:
        return fail('Unsupported group lifecycle action.', 400);
    }
  } catch (error) {
    return failFromError(error, 'Unexpected group lifecycle error.', 500, { functionName: 'group-lifecycle' });
  }
});
