import { fail, json } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupRecord, MembershipRecord, RoundRecord, TransactionRecord, UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  action: 'listForUser' | 'sendReminderBatch';
  token: string;
}

interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
}

function toIsoDate(value?: string | null) {
  if (!value) {
    return new Date(0).toISOString();
  }
  return value.includes('T') ? value : `${value}T00:00:00.000Z`;
}

function normalizeTransaction(transaction: TransactionRecord): TransactionRecord {
  return {
    ...transaction,
    Amount: Number(transaction.Amount),
  };
}

function sortNotifications(items: AppNotification[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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
    throw new Error('Admin access is required for reminders.');
  }
}

async function fetchReminderQueue() {
  const [{ data: groups, error: groupError }, { data: rounds, error: roundError }] = await Promise.all([
    supabaseAdmin.from('EqubGroup').select('*').eq('Status', 'Active'),
    supabaseAdmin.from('Round').select('*').eq('Status', 'Open'),
  ]);

  if (groupError) {
    throw groupError;
  }
  if (roundError) {
    throw roundError;
  }

  const queue: string[] = [];
  for (const group of (groups ?? []) as GroupRecord[]) {
    const currentRound = ((rounds ?? []) as RoundRecord[])
      .filter(round => round.Group_ID === group.Group_ID)
      .sort((left, right) => right.Round_Number - left.Round_Number)[0];
    if (!currentRound) {
      continue;
    }

    const [{ data: memberships, error: membershipError }, { data: contributions, error: contributionError }] = await Promise.all([
      supabaseAdmin.from('GroupMembers').select('*').eq('Group_ID', group.Group_ID).eq('Status', 'Active'),
      supabaseAdmin.from('Transaction').select('*').eq('Round_ID', currentRound.Round_ID).eq('Type', 'Contribution').eq('Status', 'Successful'),
    ]);

    if (membershipError) {
      throw membershipError;
    }
    if (contributionError) {
      throw contributionError;
    }

    const unpaid = Math.max((memberships ?? []).length - (contributions ?? []).length, 0);
    if (unpaid > 0) {
      queue.push(`${group.Group_Name} - ${unpaid} unpaid members - reminder queued`);
    }
  }

  return queue;
}

async function listNotificationsForUser(user: UserRecord) {
  const [{ data: createdGroups, error: createdGroupsError }, { data: memberships, error: membershipsError }, { data: transactions, error: transactionError }] = await Promise.all([
    supabaseAdmin.from('EqubGroup').select('*').eq('Creator_ID', user.User_ID),
    supabaseAdmin.from('GroupMembers').select('*').eq('User_ID', user.User_ID).eq('Status', 'Active'),
    supabaseAdmin.from('Transaction').select('*').eq('User_ID', user.User_ID).order('Date', { ascending: false }),
  ]);

  if (createdGroupsError) {
    throw createdGroupsError;
  }
  if (membershipsError) {
    throw membershipsError;
  }
  if (transactionError) {
    throw transactionError;
  }

  const groupIds = [
    ...new Set([
      ...((createdGroups ?? []) as GroupRecord[]).map(group => group.Group_ID),
      ...((memberships ?? []) as MembershipRecord[]).map(membership => membership.Group_ID),
    ]),
  ];

  const groupsById = new Map<string, GroupRecord>();
  if (groupIds.length) {
    const { data: groups, error: groupsError } = await supabaseAdmin.from('EqubGroup').select('*').in('Group_ID', groupIds);
    if (groupsError) {
      throw groupsError;
    }
    ((groups ?? []) as GroupRecord[]).forEach(group => groupsById.set(group.Group_ID, { ...group, Amount: Number(group.Amount) }));
  }

  const roundsByGroupId = new Map<string, RoundRecord>();
  if (groupIds.length) {
    const { data: rounds, error: roundsError } = await supabaseAdmin.from('Round').select('*').in('Group_ID', groupIds).eq('Status', 'Open');
    if (roundsError) {
      throw roundsError;
    }
    ((rounds ?? []) as RoundRecord[]).forEach(round => {
      const current = roundsByGroupId.get(round.Group_ID);
      if (!current || round.Round_Number > current.Round_Number) {
        roundsByGroupId.set(round.Group_ID, round);
      }
    });
  }

  const notificationItems: AppNotification[] = [];

  if (user.KYC_Status === 'Unverified') {
    notificationItems.push({
      id: `kyc-pending:${user.User_ID}`,
      title: 'KYC review pending',
      body: 'Your account is in limited mode until identity verification is approved.',
      createdAt: user.Created_At,
      unread: true,
    });
  }

  for (const group of (createdGroups ?? []) as GroupRecord[]) {
    const createdAt = toIsoDate(group.Start_Date);
    if (group.Status === 'Pending') {
      notificationItems.push({
        id: `group-pending:${group.Group_ID}`,
        title: 'Group request under review',
        body: `${group.Group_Name} is still pending admin approval and is not public yet.`,
        createdAt,
        unread: true,
      });
    }
    if (group.Status === 'Active') {
      notificationItems.push({
        id: `group-active:${group.Group_ID}`,
        title: 'Group approved',
        body: `${group.Group_Name} is active and now visible to members.`,
        createdAt,
        unread: true,
      });
    }
    if (group.Status === 'Frozen') {
      notificationItems.push({
        id: `group-frozen:${group.Group_ID}`,
        title: 'Group frozen',
        body: `${group.Group_Name} is paused for compliance review.`,
        createdAt,
        unread: true,
      });
    }
    if (group.Status === 'Completed') {
      notificationItems.push({
        id: `group-completed:${group.Group_ID}`,
        title: 'Group cycle completed',
        body: `${group.Group_Name} has completed its current cycle.`,
        createdAt,
        unread: true,
      });
    }
  }

  const normalizedTransactions = ((transactions ?? []) as TransactionRecord[]).map(normalizeTransaction);
  for (const transaction of normalizedTransactions.slice(0, 5)) {
    if (transaction.Type === 'Contribution' && transaction.Status === 'Successful') {
      notificationItems.push({
        id: `contribution-success:${transaction.Trans_ID}`,
        title: 'Contribution recorded',
        body: `${transaction.Amount} ETB was recorded successfully through ${transaction.Payment_Method}.`,
        createdAt: transaction.Date,
        unread: true,
      });
    }
    if (transaction.Type === 'Payout' && transaction.Status === 'Pending') {
      notificationItems.push({
        id: `payout-pending:${transaction.Trans_ID}`,
        title: 'Payout ready',
        body: `${transaction.Amount} ETB is ready for wallet clearance.`,
        createdAt: transaction.Date,
        unread: true,
      });
    }
    if (transaction.Type === 'Payout' && transaction.Status === 'Successful') {
      notificationItems.push({
        id: `payout-success:${transaction.Trans_ID}`,
        title: 'Payout cleared',
        body: `${transaction.Amount} ETB was cleared from your wallet successfully.`,
        createdAt: transaction.Date,
        unread: true,
      });
    }
  }

  for (const membership of (memberships ?? []) as MembershipRecord[]) {
    const group = groupsById.get(membership.Group_ID);
    const round = roundsByGroupId.get(membership.Group_ID);
    if (!group || !round || group.Status !== 'Active') {
      continue;
    }
    const alreadyPaid = normalizedTransactions.some(transaction => transaction.Type === 'Contribution' && transaction.Status === 'Successful' && transaction.Round_ID === round.Round_ID);
    if (!alreadyPaid) {
      notificationItems.push({
        id: `contribution-due:${round.Round_ID}:${user.User_ID}`,
        title: 'Contribution due',
        body: `${group.Group_Name} round ${round.Round_Number} is still waiting for your ${group.Amount} ETB contribution.`,
        createdAt: membership.Joined_At,
        unread: true,
      });
    }
  }

  return sortNotifications(notificationItems);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = (await request.json()) as NotificationPayload;
    const actor = await requireActor(body.token);

    switch (body.action) {
      case 'listForUser':
        return json({ notifications: await listNotificationsForUser(actor) });
      case 'sendReminderBatch':
        assertAdmin(actor);
        return json({ queue: await fetchReminderQueue(), sentAt: new Date().toISOString() });
      default:
        return fail('Unsupported notification action.', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected notification error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
