import { supabase } from '../supabaseClient';
import { loadReadNotificationIds, saveReadNotificationIds } from '../storage';
import type { NotificationService } from '../contracts';
import type { AppNotification, GroupRecord, ReminderBatchResult, RoundRecord, TransactionRecord, UserRecord } from '../../types/domain';

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

async function fetchUser(userId: string) {
  const { data, error } = await supabase.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw new Error(error.message);
  }
  return data as UserRecord;
}

async function fetchReminderQueue() {
  const [{ data: groups, error: groupError }, { data: rounds, error: roundError }] = await Promise.all([
    supabase.from('EqubGroup').select('*').eq('Status', 'Active'),
    supabase.from('Round').select('*').eq('Status', 'Open'),
  ]);

  if (groupError) {
    throw new Error(groupError.message);
  }
  if (roundError) {
    throw new Error(roundError.message);
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
      supabase.from('GroupMembers').select('*').eq('Group_ID', group.Group_ID).eq('Status', 'Active'),
      supabase.from('Transaction').select('*').eq('Round_ID', currentRound.Round_ID).eq('Type', 'Contribution').eq('Status', 'Successful'),
    ]);

    if (membershipError) {
      throw new Error(membershipError.message);
    }
    if (contributionError) {
      throw new Error(contributionError.message);
    }

    const unpaid = Math.max((memberships ?? []).length - (contributions ?? []).length, 0);
    if (unpaid > 0) {
      queue.push(`${group.Group_Name} • ${unpaid} unpaid members • reminder queued`);
    }
  }
  return queue;
}

function sortNotifications(items: AppNotification[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export const liveNotificationsService: NotificationService = {
  async listForUser(userId: string): Promise<AppNotification[]> {
    const user = await fetchUser(userId);
    const [{ data: createdGroups, error: createdGroupsError }, { data: memberships, error: membershipsError }, { data: transactions, error: transactionError }] = await Promise.all([
      supabase.from('EqubGroup').select('*').eq('Creator_ID', userId),
      supabase.from('GroupMembers').select('*').eq('User_ID', userId).eq('Status', 'Active'),
      supabase.from('Transaction').select('*').eq('User_ID', userId).order('Date', { ascending: false }),
    ]);

    if (createdGroupsError) {
      throw new Error(createdGroupsError.message);
    }
    if (membershipsError) {
      throw new Error(membershipsError.message);
    }
    if (transactionError) {
      throw new Error(transactionError.message);
    }

    const groupIds = [
      ...new Set([
        ...((createdGroups ?? []) as GroupRecord[]).map(group => group.Group_ID),
        ...((memberships ?? []).map(membership => membership.Group_ID)),
      ]),
    ];

    const groupsById = new Map<string, GroupRecord>();
    if (groupIds.length) {
      const { data: groups, error: groupsError } = await supabase.from('EqubGroup').select('*').in('Group_ID', groupIds);
      if (groupsError) {
        throw new Error(groupsError.message);
      }
      ((groups ?? []) as GroupRecord[]).forEach(group => groupsById.set(group.Group_ID, { ...group, Amount: Number(group.Amount) }));
    }

    const roundsByGroupId = new Map<string, RoundRecord>();
    if (groupIds.length) {
      const { data: rounds, error: roundsError } = await supabase.from('Round').select('*').in('Group_ID', groupIds).eq('Status', 'Open');
      if (roundsError) {
        throw new Error(roundsError.message);
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
        id: `kyc-pending:${userId}`,
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

    for (const membership of memberships ?? []) {
      const group = groupsById.get(membership.Group_ID);
      const round = roundsByGroupId.get(membership.Group_ID);
      if (!group || !round || group.Status !== 'Active') {
        continue;
      }
      const alreadyPaid = normalizedTransactions.some(transaction => transaction.Type === 'Contribution' && transaction.Status === 'Successful' && transaction.Round_ID === round.Round_ID);
      if (!alreadyPaid) {
        notificationItems.push({
          id: `contribution-due:${round.Round_ID}:${userId}`,
          title: 'Contribution due',
          body: `${group.Group_Name} round ${round.Round_Number} is still waiting for your ${group.Amount} ETB contribution.`,
          createdAt: membership.Joined_At,
          unread: true,
        });
      }
    }

    const readIds = new Set(await loadReadNotificationIds(userId));
    return sortNotifications(
      notificationItems.map(item => ({
        ...item,
        unread: !readIds.has(item.id),
      })),
    );
  },

  async markAllRead(userId: string): Promise<void> {
    const items = await liveNotificationsService.listForUser(userId);
    await saveReadNotificationIds(userId, items.map(item => item.id));
  },

  async sendReminderBatch(): Promise<ReminderBatchResult> {
    return {
      queue: await fetchReminderQueue(),
      sentAt: new Date().toISOString(),
    };
  },
};
