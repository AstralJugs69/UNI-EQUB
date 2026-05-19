import { fail, failFromError, json } from '../_shared/contracts.ts';
import type { ReportExportPayload } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { getRoundObligationProgress } from '../_shared/obligations.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupRecord, MembershipRecord, ReliabilityPublicStatus, RoundRecord, TransactionRecord, UserRecord, UserReliabilityProfileRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const reportDefinitions = [
  { title: 'Total transaction volume', format: 'PDF' as const, description: 'Aggregated contribution and payout volume.' },
  { title: 'Pending KYC and group queue', format: 'CSV' as const, description: 'Current verification and approval backlog.' },
  { title: 'Cycle completion summary', format: 'PDF' as const, description: 'Completed rounds, winners, and payout readiness.' },
];

function buildPdfBase64(title: string, lines: string[]) {
  const escapePdfText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const contentStream = ['BT', '/F1 12 Tf', '72 760 Td']
    .concat(lines.flatMap((line, index) => (index === 0
      ? [`(${escapePdfText(line)}) Tj`]
      : ['0 -18 Td', `(${escapePdfText(line)}) Tj`])))
    .concat(['ET'])
    .join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj',
    `4 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${escapePdfText(title)}) >> >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return btoa(pdf);
}

async function requireAdmin(token: string) {
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
  if (user.Role !== 'Admin') {
    throw new Error('Admin access is required for report export.');
  }
  if (user.KYC_Status === 'Banned') {
    throw new Error('This admin account is banned.');
  }
  return user;
}

async function loadAllState() {
  const [
    { data: users, error: userError },
    { data: groups, error: groupError },
    { data: rounds, error: roundError },
    { data: transactions, error: transactionError },
    { data: reliabilityProfiles, error: reliabilityError },
    { data: auditEvents, error: auditError },
  ] = await Promise.all([
    supabaseAdmin.from('User').select('*'),
    supabaseAdmin.from('EqubGroup').select('*'),
    supabaseAdmin.from('Round').select('*'),
    supabaseAdmin.from('Transaction').select('*'),
    supabaseAdmin.from('user_reliability_profiles').select('*'),
    supabaseAdmin
      .from('audit_events')
      .select('id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata, created_at, User:actor_user_id(Full_Name)')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (userError) throw userError;
  if (groupError) throw groupError;
  if (roundError) throw roundError;
  if (transactionError) throw transactionError;
  if (reliabilityError) throw reliabilityError;
  if (auditError) throw auditError;
  return {
    users: (users ?? []) as UserRecord[],
    groups: (groups ?? []) as GroupRecord[],
    rounds: (rounds ?? []) as RoundRecord[],
    transactions: ((transactions ?? []) as TransactionRecord[]).map(item => ({ ...item, Amount: Number(item.Amount) })),
    reliabilityProfiles: (reliabilityProfiles ?? []) as UserReliabilityProfileRecord[],
    auditEvents: auditEvents ?? [],
  };
}

function deriveReliabilitySummary(profiles: UserReliabilityProfileRecord[]) {
  const summary: Partial<Record<ReliabilityPublicStatus, number>> = {};
  for (const profile of profiles) {
    summary[profile.public_status] = (summary[profile.public_status] ?? 0) + 1;
  }
  return summary;
}

function humanizeEventType(eventType: string) {
  return eventType
    .split('_')
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function deriveAuditTimeline(events: Array<Record<string, unknown>>) {
  return events.map(event => {
    const userRelation = event.User as { Full_Name?: string } | null | undefined;
    const eventType = String(event.event_type ?? 'audit_event');
    const entityType = event.entity_type ? String(event.entity_type) : null;
    const entityId = event.entity_id ? String(event.entity_id) : null;
    return {
      id: String(event.id),
      eventType,
      actorRole: String(event.actor_role ?? 'System'),
      actorName: userRelation?.Full_Name ?? null,
      entityType,
      entityId,
      createdAt: String(event.created_at),
      summary: `${humanizeEventType(eventType)}${entityType ? ` on ${entityType}` : ''}`,
    };
  });
}

async function deriveReminderQueue(groups: GroupRecord[], rounds: RoundRecord[]) {
  const activeGroups = groups.filter(group => group.Status === 'Active');
  const queue: string[] = [];
  for (const group of activeGroups) {
    const round = rounds
      .filter(item => item.Group_ID === group.Group_ID && item.Status === 'Open')
      .sort((left, right) => right.Round_Number - left.Round_Number)[0];
    if (!round) {
      continue;
    }
    const { data: memberships, error: membershipError } = await supabaseAdmin.from('GroupMembers').select('*').eq('Group_ID', group.Group_ID).eq('Status', 'Active');
    if (membershipError) {
      throw membershipError;
    }
    const activeMemberships = (memberships ?? []) as MembershipRecord[];
    const { data: contributions, error: contributionError } = await supabaseAdmin
      .from('Transaction')
      .select('*')
      .eq('Round_ID', round.Round_ID)
      .eq('Type', 'Contribution')
      .eq('Status', 'Successful');
    if (contributionError) {
      throw contributionError;
    }
    const obligationProgress = await getRoundObligationProgress(
      round.Round_ID,
      activeMemberships,
      ((contributions ?? []) as TransactionRecord[]),
    );
    if (obligationProgress.unpaidCount > 0) {
      const lateCount = obligationProgress.obligations.filter(obligation => obligation.status === 'Late').length;
      const lateLabel = lateCount > 0 ? ` • ${lateCount} late` : '';
      queue.push(`${group.Group_Name} • ${obligationProgress.unpaidCount} unpaid obligations${lateLabel} • reminder queued`);
    }
  }
  return queue;
}

function deriveLogs(users: UserRecord[], groups: GroupRecord[], rounds: RoundRecord[], transactions: TransactionRecord[]) {
  const latestCompletedRound = rounds
    .filter(round => round.Status === 'Completed')
    .sort((left, right) => String(right.Draw_Date ?? '').localeCompare(String(left.Draw_Date ?? '')))[0];
  const pendingPayoutCount = transactions.filter(txn => txn.Type === 'Payout' && txn.Status === 'Pending').length;
  const pendingKycCount = users.filter(user => user.Role === 'Member' && user.KYC_Status === 'Unverified').length;
  const pendingGroupCount = groups.filter(group => group.Status === 'Pending').length;

  return [
    `${pendingKycCount} member KYC reviews are pending`,
    `${pendingGroupCount} groups are waiting approval`,
    `${groups.filter(group => group.Status === 'Active').length} groups are currently active`,
    latestCompletedRound ? `Latest completed round • ${latestCompletedRound.Group_ID} round ${latestCompletedRound.Round_Number}` : 'No rounds have completed yet',
    `${pendingPayoutCount} payout transactions are pending clearance`,
  ];
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = (await request.json()) as ReportExportPayload;
    await requireAdmin(body.token);
    const state = await loadAllState();

    switch (body.action) {
      case 'getAdminOverview': {
        const reminderQueue = await deriveReminderQueue(state.groups, state.rounds);
        return json({
          pendingKycCount: state.users.filter(user => user.Role === 'Member' && user.KYC_Status === 'Unverified').length,
          pendingGroupCount: state.groups.filter(group => group.Status === 'Pending').length,
          activeGroupCount: state.groups.filter(group => group.Status === 'Active').length,
          exportsCount: reportDefinitions.length,
          logs: deriveLogs(state.users, state.groups, state.rounds, state.transactions),
          reminderQueue,
          reliabilitySummary: deriveReliabilitySummary(state.reliabilityProfiles),
          auditTimeline: deriveAuditTimeline(state.auditEvents),
        });
      }

      case 'listReports':
        return json({ reports: reportDefinitions });

      case 'exportReport': {
        if (!body.title || !body.format) {
          return fail('Missing report export payload.', 400);
        }

        const reminderQueue = await deriveReminderQueue(state.groups, state.rounds);
        const totalContributionVolume = state.transactions.filter(txn => txn.Type === 'Contribution').reduce((sum, txn) => sum + txn.Amount, 0);
        const totalPayoutVolume = state.transactions.filter(txn => txn.Type === 'Payout').reduce((sum, txn) => sum + txn.Amount, 0);
        const completedRounds = state.rounds.filter(round => round.Status === 'Completed').length;

        const content = body.format === 'CSV'
          ? [
              'metric,value',
              `pending_kyc,${state.users.filter(user => user.Role === 'Member' && user.KYC_Status === 'Unverified').length}`,
              `pending_groups,${state.groups.filter(group => group.Status === 'Pending').length}`,
              `active_groups,${state.groups.filter(group => group.Status === 'Active').length}`,
              `completed_rounds,${completedRounds}`,
              `total_contribution_volume,${totalContributionVolume}`,
              `total_payout_volume,${totalPayoutVolume}`,
              `reminder_queue,${reminderQueue.length}`,
            ].join('\n')
          : [
              `Report: ${body.title}`,
              `Generated: ${new Date().toISOString()}`,
              `Pending KYC: ${state.users.filter(user => user.Role === 'Member' && user.KYC_Status === 'Unverified').length}`,
              `Pending group approvals: ${state.groups.filter(group => group.Status === 'Pending').length}`,
              `Active groups: ${state.groups.filter(group => group.Status === 'Active').length}`,
              `Completed rounds: ${completedRounds}`,
              `Contribution volume: ${totalContributionVolume} ETB`,
              `Payout volume: ${totalPayoutVolume} ETB`,
              `Reminder queue: ${reminderQueue.length}`,
            ].join('\n');

        const preview = [
          `Pending KYC: ${state.users.filter(user => user.Role === 'Member' && user.KYC_Status === 'Unverified').length}`,
          `Pending group approvals: ${state.groups.filter(group => group.Status === 'Pending').length}`,
          `Active groups: ${state.groups.filter(group => group.Status === 'Active').length}`,
          `Completed rounds: ${completedRounds}`,
          `Contribution volume: ${totalContributionVolume} ETB`,
          `Payout volume: ${totalPayoutVolume} ETB`,
          `Reminder queue: ${reminderQueue.length}`,
        ].join('\n');

        return json({
          fileName: `${body.title.toLowerCase().replace(/\s+/g, '-')}.${body.format.toLowerCase()}`,
          format: body.format,
          content: preview,
          contentBase64: body.format === 'PDF' ? buildPdfBase64(body.title, [`Report: ${body.title}`, ...preview.split('\n')]) : undefined,
          mimeType: body.format === 'PDF' ? 'application/pdf' : 'text/csv',
        });
      }

      default:
        return fail('Unsupported report action.', 400);
    }
  } catch (error) {
    return failFromError(error, 'Unexpected report export error.', 500, { functionName: 'report-export' });
  }
});
