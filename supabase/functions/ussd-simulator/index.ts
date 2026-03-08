import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { normalizePhone } from '../_shared/phone.ts';
import { finalizeRoundIfReady } from '../_shared/roundLifecycle.ts';
import type { GroupRecord, MembershipRecord, RoundRecord, TransactionRecord, UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ussd-simulator-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UssdInput {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
  secret?: string;
}

interface DueGroup {
  membership: MembershipRecord;
  group: GroupRecord;
  round: RoundRecord;
}

function plainText(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function end(message: string) {
  return plainText(`END ${message}`);
}

function cont(message: string) {
  return plainText(`CON ${message}`);
}

function extractString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

async function parseRequest(request: Request): Promise<UssdInput> {
  const contentType = request.headers.get('content-type') ?? '';
  let payload: Record<string, unknown> = {};

  if (contentType.includes('application/json')) {
    payload = (await request.json()) as Record<string, unknown>;
  } else {
    const raw = await request.text();
    payload = Object.fromEntries(new URLSearchParams(raw).entries());
  }

  return {
    sessionId: extractString(payload, 'sessionId', 'session_id') || crypto.randomUUID(),
    serviceCode: extractString(payload, 'serviceCode', 'service_code', 'ussdString') || '*483*227#',
    phoneNumber: extractString(payload, 'phoneNumber', 'phone_number', 'msisdn'),
    text: extractString(payload, 'text', 'Text'),
    secret: extractString(payload, 'secret'),
  };
}

function parseSegments(text: string) {
  return text
    .split('*')
    .map(segment => segment.trim())
    .filter(Boolean);
}

async function findUserByPhone(phoneNumber: string) {
  const normalized = normalizePhone(phoneNumber);
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('Phone_Number', normalized).maybeSingle();
  if (error) {
    throw error;
  }
  return data as UserRecord | null;
}

async function listDueGroupsForUser(user: UserRecord): Promise<DueGroup[]> {
  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('GroupMembers')
    .select('*')
    .eq('User_ID', user.User_ID)
    .eq('Status', 'Active');
  if (membershipError) {
    throw membershipError;
  }

  const activeMemberships = (memberships ?? []) as MembershipRecord[];
  if (!activeMemberships.length) {
    return [];
  }

  const groupIds = [...new Set(activeMemberships.map(item => item.Group_ID))];
  const [{ data: groups, error: groupError }, { data: rounds, error: roundError }] = await Promise.all([
    supabaseAdmin.from('EqubGroup').select('*').in('Group_ID', groupIds).eq('Status', 'Active'),
    supabaseAdmin.from('Round').select('*').in('Group_ID', groupIds).eq('Status', 'Open'),
  ]);
  if (groupError) {
    throw groupError;
  }
  if (roundError) {
    throw roundError;
  }

  const activeGroups = new Map<string, GroupRecord>(((groups ?? []) as GroupRecord[]).map(group => [group.Group_ID, { ...group, Amount: Number(group.Amount) }]));
  const roundByGroupId = new Map<string, RoundRecord>();
  for (const round of (rounds ?? []) as RoundRecord[]) {
    const current = roundByGroupId.get(round.Group_ID);
    if (!current || round.Round_Number > current.Round_Number) {
      roundByGroupId.set(round.Group_ID, round);
    }
  }

  const roundIds = [...roundByGroupId.values()].map(item => item.Round_ID);
  if (!roundIds.length) {
    return [];
  }

  const { data: paidTransactions, error: paidError } = await supabaseAdmin
    .from('Transaction')
    .select('*')
    .in('Round_ID', roundIds)
    .eq('User_ID', user.User_ID)
    .eq('Type', 'Contribution')
    .eq('Status', 'Successful');
  if (paidError) {
    throw paidError;
  }

  const paidRoundIds = new Set(((paidTransactions ?? []) as TransactionRecord[]).map(item => item.Round_ID));
  return activeMemberships
    .map(membership => {
      const group = activeGroups.get(membership.Group_ID);
      const round = roundByGroupId.get(membership.Group_ID);
      if (!group || !round || paidRoundIds.has(round.Round_ID)) {
        return null;
      }
      return { membership, group, round };
    })
    .filter((item): item is DueGroup => !!item)
    .sort((left, right) => left.group.Group_Name.localeCompare(right.group.Group_Name));
}

async function findExistingContribution(roundId: string, gatewayRef: string) {
  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .select('*')
    .eq('Round_ID', roundId)
    .eq('Gateway_Ref', gatewayRef)
    .eq('Type', 'Contribution')
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as TransactionRecord | null;
}

async function createContribution(user: UserRecord, dueGroup: DueGroup, sessionId: string) {
  const gatewayRef = `USSDSIM-${sessionId.slice(0, 18)}-${dueGroup.round.Round_ID.slice(0, 8)}`;
  const existing = await findExistingContribution(dueGroup.round.Round_ID, gatewayRef);
  if (existing) {
    return {
      transaction: existing,
      autoDrawTriggered: false,
      payoutAmount: 0,
      gatewayRef,
      alreadyRecorded: true,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('Transaction')
    .insert({
      User_ID: user.User_ID,
      Round_ID: dueGroup.round.Round_ID,
      Amount: dueGroup.group.Amount,
      Type: 'Contribution',
      Payment_Method: 'MockUSSD',
      Gateway_Ref: gatewayRef,
      Status: 'Successful',
      Date: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }

  const lifecycle = await finalizeRoundIfReady(dueGroup.group, dueGroup.round);
  return {
    transaction: data as TransactionRecord,
    autoDrawTriggered: lifecycle.autoDrawTriggered,
    payoutAmount: lifecycle.payoutAmount,
    gatewayRef,
    alreadyRecorded: false,
  };
}

function groupMenu(dueGroups: DueGroup[]) {
  return [
    'UniEqub contribution test',
    `You have ${dueGroups.length} unpaid active group${dueGroups.length === 1 ? '' : 's'}.`,
    ...dueGroups.map((item, index) => `${index + 1}. ${item.group.Group_Name} - ${Number(item.group.Amount)} ETB`),
    '0. Exit',
  ].join('\n');
}

function confirmMenu(dueGroup: DueGroup) {
  return [
    'Confirm contribution',
    dueGroup.group.Group_Name,
    `Ref ${dueGroup.group.Virtual_Acc_Ref ?? 'N/A'}`,
    `Amount ${Number(dueGroup.group.Amount)} ETB`,
    `Round ${dueGroup.round.Round_Number}`,
    '1. Confirm payment',
    '2. Cancel',
  ].join('\n');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return plainText('END Method not allowed.', 405);
  }

  try {
    const input = await parseRequest(request);
    const configuredSecret = Deno.env.get('USSD_SIMULATOR_SECRET');
    const suppliedSecret = input.secret || request.headers.get('x-ussd-simulator-secret') || new URL(request.url).searchParams.get('secret') || '';
    if (configuredSecret && suppliedSecret !== configuredSecret) {
      return end('USSD simulator secret is missing or invalid.');
    }
    if (!input.phoneNumber) {
      return end('A phone number is required for this USSD session.');
    }

    const user = await findUserByPhone(input.phoneNumber);
    if (!user) {
      return end('This phone number is not registered on UniEqub.');
    }
    if (user.Role !== 'Member') {
      return end('Only member accounts can use contribution USSD.');
    }
    if (user.KYC_Status === 'Banned') {
      return end('This account has been banned.');
    }
    if (user.KYC_Status !== 'Verified') {
      return end('Your account must be KYC verified before contributing.');
    }

    const dueGroups = await listDueGroupsForUser(user);
    const segments = parseSegments(input.text);

    if (!segments.length) {
      return cont(['Welcome to UniEqub', '1. Pay contribution', `2. My due groups (${dueGroups.length})`, '3. Exit'].join('\n'));
    }

    switch (segments[0]) {
      case '1': {
        if (!dueGroups.length) {
          return end('No unpaid active groups were found for this number.');
        }
        if (segments.length === 1) {
          return cont(groupMenu(dueGroups));
        }

        const selectedIndex = Number(segments[1]) - 1;
        const selectedGroup = dueGroups[selectedIndex];
        if (!selectedGroup) {
          return end('Invalid group selection. Start the session again.');
        }

        if (segments.length === 2) {
          return cont(confirmMenu(selectedGroup));
        }

        if (segments[2] === '1') {
          const result = await createContribution(user, selectedGroup, input.sessionId);
          const summaryLines = [
            result.alreadyRecorded ? 'Contribution was already recorded.' : 'Contribution recorded successfully.',
            `${selectedGroup.group.Group_Name}`,
            `Amount ${Number(result.transaction.Amount)} ETB`,
            `Receipt ${result.gatewayRef}`,
          ];
          if (result.autoDrawTriggered) {
            summaryLines.push(`Round completed automatically. Pending payout ${result.payoutAmount} ETB was created.`);
          }
          return end(summaryLines.join('\n'));
        }

        if (segments[2] === '2' || segments[2] === '0') {
          return end('Contribution cancelled.');
        }

        return end('Invalid confirmation input. Start the session again.');
      }

      case '2': {
        if (!dueGroups.length) {
          return end('You do not have any unpaid active groups right now.');
        }
        return end(groupMenu(dueGroups));
      }

      case '3':
      case '0':
        return end('Session closed.');

      default:
        return end('Invalid menu option.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected USSD simulator error.';
    return plainText(`END ${message}`, 500);
  }
});
