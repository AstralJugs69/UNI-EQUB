import { fail, json } from '../_shared/contracts.ts';
import type { ReportExportPayload } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { GroupRecord, RoundRecord, TransactionRecord, UserRecord } from '../_shared/types.ts';

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
  const [{ data: users, error: userError }, { data: groups, error: groupError }, { data: rounds, error: roundError }, { data: transactions, error: transactionError }] = await Promise.all([
    supabaseAdmin.from('User').select('*'),
    supabaseAdmin.from('EqubGroup').select('*'),
    supabaseAdmin.from('Round').select('*'),
    supabaseAdmin.from('Transaction').select('*'),
  ]);
  if (userError) throw userError;
  if (groupError) throw groupError;
  if (roundError) throw roundError;
  if (transactionError) throw transactionError;
  return {
    users: (users ?? []) as UserRecord[],
    groups: (groups ?? []) as GroupRecord[],
    rounds: (rounds ?? []) as RoundRecord[],
    transactions: ((transactions ?? []) as TransactionRecord[]).map(item => ({ ...item, Amount: Number(item.Amount) })),
  };
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
    const activeMemberships = memberships ?? [];
    const { data: contributions, error: contributionError } = await supabaseAdmin
      .from('Transaction')
      .select('*')
      .eq('Round_ID', round.Round_ID)
      .eq('Type', 'Contribution')
      .eq('Status', 'Successful');
    if (contributionError) {
      throw contributionError;
    }
    const unpaid = Math.max(activeMemberships.length - (contributions ?? []).length, 0);
    if (unpaid > 0) {
      queue.push(`${group.Group_Name} • ${unpaid} unpaid members • reminder queued`);
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
    const message = error instanceof Error ? error.message : 'Unexpected report export error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
