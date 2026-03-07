import { fail, json } from '../_shared/contracts.ts';
import type { CreateGroupRequest, GroupLifecyclePayload } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
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
  if (!['Weekly', 'Bi-weekly', 'Monthly'].includes(input.frequency)) {
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

async function getCurrentRound(groupId: string) {
  const { data, error } = await supabaseAdmin.from('Round').select('*').eq('Group_ID', groupId).eq('Status', 'Open').order('Round_Number', { ascending: false }).maybeSingle();
  if (error) {
    throw error;
  }
  return data as RoundRecord | null;
}

async function ensureInitialRound(groupId: string) {
  const existing = await getCurrentRound(groupId);
  if (existing) {
    return existing;
  }
  const { data, error } = await supabaseAdmin.from('Round').insert({ Group_ID: groupId, Round_Number: 1, Status: 'Open' }).select('*').single();
  if (error) {
    throw error;
  }
  return data as RoundRecord;
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

async function getGroupStatusSnapshot(actor: UserRecord, groupId: string) {
  const group = await requireGroup(groupId);
  const currentRound = await getCurrentRound(groupId);
  const memberships = await listActiveMemberships(groupId);
  const paidTransactions = currentRound ? await successfulContributions(currentRound.Round_ID) : [];
  const canCurrentUserPay = !!currentRound
    && group.Status === 'Active'
    && memberships.some(item => item.User_ID === actor.User_ID)
    && !paidTransactions.some(item => item.User_ID === actor.User_ID);

  return {
    group: toAppGroup(group),
    currentRound,
    paidCount: paidTransactions.length,
    totalMembers: memberships.length,
    winnerHistory: await getWinnerHistory(groupId),
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
    const candidateRound = await getCurrentRound(candidateGroup.Group_ID);
    if (!candidateRound) {
      continue;
    }
    const memberPaid = await successfulContribution(candidateRound.Round_ID, actor.User_ID);
    if (!memberPaid) {
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
    currentRound = currentGroup ? await getCurrentRound(currentGroup.Group_ID) : null;
  }

  const paidTransactions = currentRound ? await successfulContributions(currentRound.Round_ID) : [];
  const activeMembers = currentGroup ? await listActiveMemberships(currentGroup.Group_ID) : [];

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
    paidCount: paidTransactions.length,
    totalMembers: activeMembers.length,
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
        const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Status', 'Pending').order('Start_Date', { ascending: false });
        if (error) {
          throw error;
        }
        const pendingGroups = (data ?? []) as GroupRecord[];
        const items = await Promise.all(
          pendingGroups.map(async group => ({
            group: toAppGroup(group),
            creator: await getCreator(group.Creator_ID),
            note: 'Pending review against KYC, amount, frequency, and membership rules.',
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
        const { data, error } = await supabaseAdmin.from('EqubGroup').update({ Status: 'Frozen' }).eq('Group_ID', body.groupId).select('*').single();
        if (error) {
          throw error;
        }
        return json({ group: toAppGroup(data as GroupRecord) });
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
    const message = error instanceof Error ? error.message : 'Unexpected group lifecycle error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
