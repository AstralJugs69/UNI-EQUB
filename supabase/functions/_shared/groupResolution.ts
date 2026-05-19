import { writeAuditEvent } from './audit.ts';
import { loadConfigValue } from './config.ts';
import { ledgerMemo, recordLedgerEntry } from './ledger.ts';
import { createNotification } from './notifications.ts';
import { resolveOpenGroupFreeze } from './groupFreeze.ts';
import { supabaseAdmin } from './supabaseAdmin.ts';
import type {
  GroupFreezeEventRecord,
  GroupRecord,
  GroupResolutionPollAction,
  GroupResolutionPollOptionRecord,
  GroupResolutionPollRecord,
  GroupResolutionVoteRecord,
  MembershipRecord,
  RefundTicketRecord,
  TransactionRecord,
  UserRecord,
} from './types.ts';

export interface GroupResolutionPollSummary {
  poll: GroupResolutionPollRecord;
  options: GroupResolutionPollOptionRecord[];
  voteCounts: Record<string, number>;
  requiredVotes: number;
  eligibleVoterCount: number;
  currentUserVote: GroupResolutionVoteRecord | null;
}

const DEFAULT_OPTIONS: Array<{
  option_label: string;
  option_description: string;
  resolution_action: GroupResolutionPollAction;
  display_order: number;
}> = [
  {
    option_label: 'Continue group',
    option_description: 'Resume the cycle while the default reserve stays frozen for audit review.',
    resolution_action: 'ContinueWithReserveFrozen',
    display_order: 1,
  },
  {
    option_label: 'Keep frozen',
    option_description: 'Leave the group paused for additional admin follow-up.',
    resolution_action: 'KeepFrozenForReview',
    display_order: 2,
  },
  {
    option_label: 'Simulate refunds',
    option_description: 'Close the frozen case with refund tickets for eligible non-defaulted contributors.',
    resolution_action: 'CreateRefundTickets',
    display_order: 3,
  },
];

function requiredSimpleMajority(total: number) {
  return Math.floor(total / 2) + 1;
}

function parseEligibleIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

function isMissingResolutionTable(error: unknown) {
  if (typeof error !== 'object' || !error) {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  return record.code === 'PGRST205'
    || (typeof record.message === 'string' && (
      record.message.includes("Could not find the table 'public.group_resolution_polls'")
      || record.message.includes("Could not find the table 'public.refund_tickets'")
      || record.message.includes("Could not find the table 'public.group_resolution_poll_options'")
      || record.message.includes("Could not find the table 'public.group_resolution_votes'")
    ));
}

function resolutionTablesMissingError() {
  return new Error('Phase 2 resolution poll tables are not deployed. Run `supabase db push` to apply 20260519131500_phase2_resolution_polls_refund_tickets.sql, then redeploy group-lifecycle.');
}

async function getGroup(groupId: string) {
  const { data, error } = await supabaseAdmin.from('EqubGroup').select('*').eq('Group_ID', groupId).single();
  if (error) {
    throw error;
  }
  return data as GroupRecord;
}

async function getUser(userId: string) {
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
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

async function listDefaultedUserIds(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('contribution_obligations')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('status', 'Defaulted');
  if (error) {
    throw error;
  }
  return new Set((data ?? []).map(item => (item as { user_id: string }).user_id));
}

async function findOpenFreezeEvent(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_freeze_events')
    .select('*')
    .eq('group_id', groupId)
    .in('status', ['Open', 'UnderReview'])
    .order('frozen_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as GroupFreezeEventRecord | null;
}

async function findActivePoll(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_resolution_polls')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'Open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingResolutionTable(error)) {
      return null;
    }
    throw error;
  }
  return data as GroupResolutionPollRecord | null;
}

async function listPollOptions(pollId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_resolution_poll_options')
    .select('*')
    .eq('poll_id', pollId)
    .order('display_order', { ascending: true });
  if (error) {
    if (isMissingResolutionTable(error)) {
      throw resolutionTablesMissingError();
    }
    throw error;
  }
  return (data ?? []) as GroupResolutionPollOptionRecord[];
}

async function listPollVotes(pollId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_resolution_votes')
    .select('*')
    .eq('poll_id', pollId);
  if (error) {
    if (isMissingResolutionTable(error)) {
      throw resolutionTablesMissingError();
    }
    throw error;
  }
  return (data ?? []) as GroupResolutionVoteRecord[];
}

async function notifyUsers(userIds: string[], input: {
  type: string;
  title: string;
  message: string;
  relatedEntityId: string;
  severity?: 'Info' | 'Success' | 'Warning' | 'Error';
  metadata?: Record<string, unknown>;
}) {
  await Promise.all([...new Set(userIds)].map(userId => createNotification({
    userId,
    type: input.type,
    severity: input.severity ?? 'Info',
    title: input.title,
    message: input.message,
    relatedEntityType: 'group_resolution_poll',
    relatedEntityId: input.relatedEntityId,
    metadata: input.metadata,
  })));
}

export async function createFrozenGroupResolutionPoll(input: {
  groupId: string;
  admin: UserRecord;
}) {
  const group = await getGroup(input.groupId);
  if (group.Status !== 'Frozen') {
    throw new Error('Resolution polls are only available for frozen groups.');
  }

  const existingPoll = await findActivePoll(input.groupId);
  if (existingPoll) {
    return getGroupResolutionState(input.groupId, input.admin.User_ID);
  }

  const freezeEvent = await findOpenFreezeEvent(input.groupId);
  if (!freezeEvent) {
    throw new Error('No open freeze event was found for this group.');
  }

  const [memberships, defaultedUserIds, pollHours] = await Promise.all([
    listActiveMemberships(input.groupId),
    listDefaultedUserIds(input.groupId),
    loadConfigValue<number>('frozen_group_poll_hours', 24),
  ]);
  const eligibleVoterIds = memberships
    .map(membership => membership.User_ID)
    .filter(userId => userId !== freezeEvent.trigger_user_id && !defaultedUserIds.has(userId));

  if (!eligibleVoterIds.length) {
    throw new Error('No eligible non-defaulted voters are available for this frozen group.');
  }

  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + pollHours * 60 * 60 * 1000);
  const { data: poll, error: pollError } = await supabaseAdmin
    .from('group_resolution_polls')
    .insert({
      group_id: input.groupId,
      freeze_event_id: freezeEvent.id,
      created_by_admin_id: input.admin.User_ID,
      status: 'Open',
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      required_threshold_type: 'SimpleMajority',
      eligible_voter_user_ids: eligibleVoterIds,
      metadata: {
        source: 'admin_manual_resolution',
        poll_hours: pollHours,
      },
    })
    .select('*')
    .single();
  if (pollError) {
    if (isMissingResolutionTable(pollError)) {
      throw resolutionTablesMissingError();
    }
    throw pollError;
  }

  const pollRecord = poll as GroupResolutionPollRecord;
  const { error: optionsError } = await supabaseAdmin
    .from('group_resolution_poll_options')
    .insert(DEFAULT_OPTIONS.map(option => ({ ...option, poll_id: pollRecord.id })));
  if (optionsError) {
    if (isMissingResolutionTable(optionsError)) {
      throw resolutionTablesMissingError();
    }
    throw optionsError;
  }

  await writeAuditEvent({
    actor: input.admin,
    eventType: 'group_resolution_poll_opened',
    entityType: 'group_resolution_poll',
    entityId: pollRecord.id,
    metadata: {
      group_id: input.groupId,
      freeze_event_id: freezeEvent.id,
      eligible_voter_count: eligibleVoterIds.length,
      closes_at: closesAt.toISOString(),
    },
  });
  await notifyUsers(eligibleVoterIds, {
    type: 'group_resolution_poll_opened',
    severity: 'Warning',
    title: 'Frozen group vote opened',
    message: 'Choose how this frozen group should be resolved.',
    relatedEntityId: pollRecord.id,
    metadata: { group_id: input.groupId, closes_at: closesAt.toISOString() },
  });

  return getGroupResolutionState(input.groupId, input.admin.User_ID);
}

export async function getGroupResolutionState(groupId: string, currentUserId?: string) {
  const poll = await findActivePoll(groupId);
  const { data: tickets, error: ticketsError } = await supabaseAdmin
    .from('refund_tickets')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (ticketsError) {
    if (isMissingResolutionTable(ticketsError)) {
      return {
        activeResolutionPoll: null,
        refundTickets: [] as RefundTicketRecord[],
      };
    }
    throw ticketsError;
  }

  if (!poll) {
    return {
      activeResolutionPoll: null,
      refundTickets: (tickets ?? []) as RefundTicketRecord[],
    };
  }

  const [options, votes] = await Promise.all([
    listPollOptions(poll.id),
    listPollVotes(poll.id),
  ]);
  const eligibleVoterIds = parseEligibleIds(poll.eligible_voter_user_ids);
  const voteCounts = Object.fromEntries(options.map(option => [option.id, 0])) as Record<string, number>;
  for (const vote of votes) {
    voteCounts[vote.option_id] = (voteCounts[vote.option_id] ?? 0) + 1;
  }

  return {
    activeResolutionPoll: {
      poll: {
        ...poll,
        eligible_voter_user_ids: eligibleVoterIds,
      },
      options,
      voteCounts,
      requiredVotes: requiredSimpleMajority(eligibleVoterIds.length),
      eligibleVoterCount: eligibleVoterIds.length,
      currentUserVote: currentUserId
        ? votes.find(vote => vote.voter_user_id === currentUserId) ?? null
        : null,
    } satisfies GroupResolutionPollSummary,
    refundTickets: (tickets ?? []) as RefundTicketRecord[],
  };
}

async function createRefundTicketsForPoll(poll: GroupResolutionPollRecord) {
  const freezeEvent = await findOpenFreezeEvent(poll.group_id);
  const roundId = freezeEvent?.trigger_round_id ?? null;
  const eligibleUserIds = parseEligibleIds(poll.eligible_voter_user_ids);
  if (!roundId || !eligibleUserIds.length) {
    return [] as RefundTicketRecord[];
  }

  const { data: transactions, error } = await supabaseAdmin
    .from('Transaction')
    .select('*')
    .eq('Round_ID', roundId)
    .eq('Type', 'Contribution')
    .eq('Status', 'Successful')
    .in('User_ID', eligibleUserIds);
  if (error) {
    throw error;
  }

  const amountsByUser = new Map<string, number>();
  for (const transaction of (transactions ?? []) as TransactionRecord[]) {
    amountsByUser.set(transaction.User_ID, (amountsByUser.get(transaction.User_ID) ?? 0) + Number(transaction.Amount ?? 0));
  }

  const rows = [...amountsByUser.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([userId, amount]) => ({
      group_id: poll.group_id,
      round_id: roundId,
      user_id: userId,
      amount,
      currency: 'ETB',
      reason: 'Frozen group resolution poll created simulated refund ticket.',
      status: 'Created',
      offset_applied_amount: 0,
      created_by_event_id: poll.freeze_event_id,
      calculation_snapshot: {
        poll_id: poll.id,
        source: 'group_resolution_poll',
        contribution_amount: amount,
      },
    }));

  if (!rows.length) {
    return [] as RefundTicketRecord[];
  }

  const { data: tickets, error: insertError } = await supabaseAdmin
    .from('refund_tickets')
    .upsert(rows, { onConflict: 'group_id,round_id,user_id,created_by_event_id', ignoreDuplicates: true })
    .select('*');
  if (insertError) {
    throw insertError;
  }

  const ticketRows = (tickets ?? []) as RefundTicketRecord[];
  await Promise.all(ticketRows.map(ticket => recordLedgerEntry(ledgerMemo({
    userId: ticket.user_id,
    groupId: ticket.group_id,
    roundId: ticket.round_id ?? undefined,
    entryType: 'RefundTicketCreated',
    amount: Number(ticket.amount ?? 0),
    description: 'Simulated refund ticket created after frozen-group poll resolution.',
    referenceType: 'refund_tickets',
    referenceId: ticket.id,
    metadata: {
      poll_id: poll.id,
      freeze_event_id: poll.freeze_event_id,
    },
  }))));
  await notifyUsers(ticketRows.map(ticket => ticket.user_id), {
    type: 'refund_ticket_created',
    severity: 'Info',
    title: 'Refund ticket created',
    message: 'A simulated refund ticket was created for the frozen group case.',
    relatedEntityId: poll.id,
    metadata: { group_id: poll.group_id, freeze_event_id: poll.freeze_event_id },
  });

  return ticketRows;
}

async function closePollWithOption(input: {
  poll: GroupResolutionPollRecord;
  option: GroupResolutionPollOptionRecord | null;
  actor?: UserRecord | null;
  expired: boolean;
}) {
  const closedAt = new Date().toISOString();
  const nextStatus = input.expired ? 'Expired' : 'Closed';
  const { data: poll, error } = await supabaseAdmin
    .from('group_resolution_polls')
    .update({
      status: nextStatus,
      winning_option_id: input.option?.id ?? null,
      closed_at: closedAt,
    })
    .eq('id', input.poll.id)
    .select('*')
    .single();
  if (error) {
    throw error;
  }

  const closedPoll = poll as GroupResolutionPollRecord;
  const action = input.expired ? 'CreateRefundTickets' : input.option?.resolution_action;
  const resolutionAdmin = await getUser(closedPoll.created_by_admin_id);
  let refundTickets: RefundTicketRecord[] = [];
  if (action === 'CreateRefundTickets') {
    refundTickets = await createRefundTicketsForPoll(closedPoll);
    await resolveOpenGroupFreeze({
      groupId: closedPoll.group_id,
      admin: resolutionAdmin,
      resolutionAction: 'CreateRefundTickets',
      resolutionNote: input.expired
        ? 'Poll expired without majority; simulated refund tickets were created.'
        : 'Members selected simulated refund tickets.',
    });
  } else if (action === 'ContinueWithReserveFrozen' || action === 'KeepFrozenForReview') {
    await resolveOpenGroupFreeze({
      groupId: closedPoll.group_id,
      admin: resolutionAdmin,
      resolutionAction: action,
      resolutionNote: `Member poll selected: ${input.option?.option_label ?? action}.`,
    });
  }

  await writeAuditEvent({
    actor: input.actor ?? null,
    actorRole: input.actor ? undefined : 'System',
    eventType: input.expired ? 'group_resolution_poll_expired' : 'group_resolution_poll_closed',
    entityType: 'group_resolution_poll',
    entityId: closedPoll.id,
    metadata: {
      group_id: closedPoll.group_id,
      winning_option_id: input.option?.id ?? null,
      resolution_action: action,
      refund_ticket_count: refundTickets.length,
    },
  });

  return {
    poll: closedPoll,
    refundTickets,
  };
}

export async function closeResolutionPollIfReady(input: {
  pollId: string;
  actor?: UserRecord | null;
  forceExpired?: boolean;
}) {
  const { data, error } = await supabaseAdmin
    .from('group_resolution_polls')
    .select('*')
    .eq('id', input.pollId)
    .eq('status', 'Open')
    .maybeSingle();
  if (error) {
    if (isMissingResolutionTable(error)) {
      throw resolutionTablesMissingError();
    }
    throw error;
  }
  if (!data) {
    return null;
  }

  const poll = data as GroupResolutionPollRecord;
  const [options, votes] = await Promise.all([
    listPollOptions(poll.id),
    listPollVotes(poll.id),
  ]);
  const eligibleVoterIds = parseEligibleIds(poll.eligible_voter_user_ids);
  const requiredVotes = requiredSimpleMajority(eligibleVoterIds.length);
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
  }
  const winningOption = options.find(option => (counts.get(option.id) ?? 0) >= requiredVotes) ?? null;
  const expired = input.forceExpired || new Date(poll.closes_at).getTime() <= Date.now();
  if (!winningOption && !expired) {
    return null;
  }

  return closePollWithOption({
    poll,
    option: winningOption,
    actor: input.actor,
    expired: !winningOption && expired,
  });
}

export async function voteOnResolutionPoll(input: {
  groupId: string;
  pollId: string;
  optionId: string;
  voter: UserRecord;
}) {
  const { data: pollData, error: pollError } = await supabaseAdmin
    .from('group_resolution_polls')
    .select('*')
    .eq('id', input.pollId)
    .eq('group_id', input.groupId)
    .single();
  if (pollError) {
    if (isMissingResolutionTable(pollError)) {
      throw resolutionTablesMissingError();
    }
    throw pollError;
  }
  const poll = pollData as GroupResolutionPollRecord;
  if (poll.status !== 'Open') {
    throw new Error('This resolution poll is not open.');
  }
  if (new Date(poll.closes_at).getTime() <= Date.now()) {
    await closeResolutionPollIfReady({ pollId: poll.id, actor: input.voter, forceExpired: true });
    throw new Error('This resolution poll has closed.');
  }
  if (!parseEligibleIds(poll.eligible_voter_user_ids).includes(input.voter.User_ID)) {
    throw new Error('Only eligible non-defaulted members can vote on this poll.');
  }

  const options = await listPollOptions(poll.id);
  if (!options.some(option => option.id === input.optionId)) {
    throw new Error('Invalid resolution option.');
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('group_resolution_votes')
    .select('*')
    .eq('poll_id', poll.id)
    .eq('voter_user_id', input.voter.User_ID)
    .maybeSingle();
  if (existingError) {
    throw existingError;
  }
  if (existing) {
    throw new Error('You have already voted on this resolution poll.');
  }

  const { data: vote, error: voteError } = await supabaseAdmin
    .from('group_resolution_votes')
    .insert({
      poll_id: poll.id,
      voter_user_id: input.voter.User_ID,
      option_id: input.optionId,
    })
    .select('*')
    .single();
  if (voteError) {
    throw voteError;
  }

  await writeAuditEvent({
    actor: input.voter,
    eventType: 'group_resolution_vote_cast',
    entityType: 'group_resolution_poll',
    entityId: poll.id,
    metadata: {
      group_id: input.groupId,
      option_id: input.optionId,
    },
  });
  await closeResolutionPollIfReady({ pollId: poll.id, actor: input.voter });
  return vote as GroupResolutionVoteRecord;
}
