import { supabaseAdmin } from './supabaseAdmin.ts';
import type { GroupRecord, MembershipRecord, RoundRecord, TransactionRecord } from './types.ts';

interface RoundCompletionResult {
  autoDrawTriggered: boolean;
  payoutAmount: number;
  payoutTransaction: TransactionRecord | null;
  nextRound: RoundRecord | null;
  updatedRound: RoundRecord;
  completedGroup: GroupRecord | null;
}

async function listActiveMemberships(groupId: string) {
  const { data, error } = await supabaseAdmin.from('GroupMembers').select('*').eq('Group_ID', groupId).eq('Status', 'Active');
  if (error) {
    throw error;
  }
  return (data ?? []) as MembershipRecord[];
}

async function listSuccessfulContributions(roundId: string) {
  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .select('*')
    .eq('Round_ID', roundId)
    .eq('Type', 'Contribution')
    .eq('Status', 'Successful');
  if (error) {
    throw error;
  }
  return (data ?? []) as TransactionRecord[];
}

async function listPriorWinnerIds(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('Round')
    .select('Winner_ID')
    .eq('Group_ID', groupId)
    .not('Winner_ID', 'is', null);
  if (error) {
    throw error;
  }
  return new Set((data ?? []).map(item => item.Winner_ID as string));
}

function chooseWinner(userIds: string[]) {
  if (!userIds.length) {
    return null;
  }
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return userIds[bytes[0] % userIds.length];
}

async function updateRound(roundId: string, changes: Partial<RoundRecord>) {
  const { data, error } = await supabaseAdmin.from('Round').update(changes).eq('Round_ID', roundId).select('*').single();
  if (error) {
    throw error;
  }
  return data as RoundRecord;
}

async function updateGroup(groupId: string, changes: Partial<GroupRecord>) {
  const { data, error } = await supabaseAdmin.from('EqubGroup').update(changes).eq('Group_ID', groupId).select('*').single();
  if (error) {
    throw error;
  }
  return data as GroupRecord;
}

async function createPendingPayout(winnerId: string, round: RoundRecord, amount: number) {
  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .insert({
      User_ID: winnerId,
      Round_ID: round.Round_ID,
      Amount: amount,
      Type: 'Payout',
      Payment_Method: 'MockUSSD',
      Gateway_Ref: `PAYOUT-${Math.floor(100000 + Math.random() * 900000)}`,
      Status: 'Pending',
      Date: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return data as TransactionRecord;
}

async function createNextRound(groupId: string, roundNumber: number) {
  const { data, error } = await supabaseAdmin
    .from('Round')
    .insert({
      Group_ID: groupId,
      Round_Number: roundNumber,
      Status: 'Open',
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return data as RoundRecord;
}

export async function finalizeRoundIfReady(group: GroupRecord, round: RoundRecord): Promise<RoundCompletionResult> {
  const memberships = await listActiveMemberships(group.Group_ID);
  const contributions = await listSuccessfulContributions(round.Round_ID);

  if (contributions.length !== memberships.length) {
    return {
      autoDrawTriggered: false,
      payoutAmount: 0,
      payoutTransaction: null,
      nextRound: null,
      updatedRound: round,
      completedGroup: null,
    };
  }

  await updateRound(round.Round_ID, { Status: 'Locked' });
  const priorWinnerIds = await listPriorWinnerIds(group.Group_ID);
  const eligibleUserIds = memberships
    .map(item => item.User_ID)
    .filter(userId => contributions.some(transaction => transaction.User_ID === userId))
    .filter(userId => !priorWinnerIds.has(userId));

  const winnerId = chooseWinner(eligibleUserIds);
  if (!winnerId) {
    throw new Error('No eligible winner could be derived for this completed round.');
  }

  const completedRound = await updateRound(round.Round_ID, {
    Winner_ID: winnerId,
    Draw_Date: new Date().toISOString(),
    Status: 'Completed',
  });

  const payoutAmount = Number(group.Amount) * memberships.length;
  const payoutTransaction = await createPendingPayout(winnerId, completedRound, payoutAmount);

  const winnersAfterThisRound = new Set<string>([...priorWinnerIds, winnerId]);
  const activeMemberIds = new Set(memberships.map(item => item.User_ID));
  const cycleComplete = [...activeMemberIds].every(userId => winnersAfterThisRound.has(userId));

  if (cycleComplete) {
    const completedGroup = await updateGroup(group.Group_ID, { Status: 'Completed' });
    return {
      autoDrawTriggered: true,
      payoutAmount,
      payoutTransaction,
      nextRound: null,
      updatedRound: completedRound,
      completedGroup,
    };
  }

  const nextRound = await createNextRound(group.Group_ID, completedRound.Round_Number + 1);
  return {
    autoDrawTriggered: true,
    payoutAmount,
    payoutTransaction,
    nextRound,
    updatedRound: completedRound,
    completedGroup: null,
  };
}
