const { execSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');

const PROJECT_REF = 'yxgfvkxdiicvckcwpdmc';
const SUPABASE_URL = 'https://yxgfvkxdiicvckcwpdmc.supabase.co';
const GROUP_NAME = 'Seeded Final Draw Cycle';
const DEFAULT_PASSWORD = 'member1234';

const supportUsers = [
  { fullName: 'Seed Member One', phoneNumber: '0917000001' },
  { fullName: 'Seed Member Two', phoneNumber: '0917000002' },
  { fullName: 'Seed Member Three', phoneNumber: '0917000003' },
  { fullName: 'Seed Member Four', phoneNumber: '0917000004' },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith('--phone=')) {
      parsed.phone = arg.slice('--phone='.length);
    } else if (arg === '--phone') {
      parsed.phone = args[index + 1];
      index += 1;
    } else if (arg.startsWith('--name=')) {
      parsed.name = arg.slice('--name='.length);
    } else if (arg === '--name') {
      parsed.name = args[index + 1];
      index += 1;
    } else if (arg.startsWith('--password=')) {
      parsed.password = arg.slice('--password='.length);
    } else if (arg === '--password') {
      parsed.password = args[index + 1];
      index += 1;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }
  if (!parsed.phone && positional[0]) {
    parsed.phone = positional[0];
  }
  if (!parsed.name && positional[1]) {
    parsed.name = positional.slice(1).join(' ');
  }
  return parsed;
}

function getApiKeys() {
  const output = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF} --output json`, {
    cwd: `${__dirname}\\..\\..`,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const keys = JSON.parse(output);
  return {
    anon: keys.find(item => item.id === 'anon')?.api_key,
    serviceRole: keys.find(item => item.id === 'service_role')?.api_key,
  };
}

async function invoke(client, name, body) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    throw error;
  }
  if (!data?.ok) {
    throw new Error(data?.error || `Invocation failed for ${name}`);
  }
  return data.data;
}

async function ensureSupportUser(anon, service, user) {
  let existing = await service.from('User').select('*').eq('Phone_Number', user.phoneNumber).maybeSingle();
  if (existing.error) {
    throw existing.error;
  }
  if (!existing.data) {
    await invoke(anon, 'register-login', {
      action: 'register',
      register: {
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        password: DEFAULT_PASSWORD,
        studentIdImage: 'storage://student-ids/seed/member.jpg',
      },
    });
    existing = await service.from('User').select('*').eq('Phone_Number', user.phoneNumber).single();
    if (existing.error) {
      throw existing.error;
    }
  }

  const { data, error } = await service
    .from('User')
    .update({
      Full_Name: user.fullName,
      KYC_Status: 'Verified',
      Role: 'Member',
      Student_ID_Img: 'storage://student-ids/seed/member.jpg',
    })
    .eq('Phone_Number', user.phoneNumber)
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return data;
}

async function selectPrimaryTester(service, phoneNumber) {
  if (phoneNumber) {
    const { data, error } = await service.from('User').select('*').eq('Phone_Number', phoneNumber).maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error(`No user exists with phone number ${phoneNumber}.`);
    }
    if (data.Role !== 'Member' || data.KYC_Status !== 'Verified') {
      throw new Error(`User ${phoneNumber} must be a verified member before seeding this scenario.`);
    }
    return data;
  }

  const excludedPhones = supportUsers.map(user => user.phoneNumber);
  const { data, error } = await service
    .from('User')
    .select('*')
    .eq('Role', 'Member')
    .eq('KYC_Status', 'Verified')
    .order('Created_At', { ascending: false });
  if (error) {
    throw error;
  }

  const tester = (data || []).find(user => !excludedPhones.includes(user.Phone_Number));
  if (!tester) {
    throw new Error('No verified member account was found. Register and approve one real user first, or rerun with --phone <your number>.');
  }
  return tester;
}

async function ensurePrimaryTester(anon, service, args) {
  if (!args.phone) {
    return selectPrimaryTester(service);
  }

  const existing = await selectPrimaryTester(service, args.phone).catch(error => {
    if (!(error instanceof Error) || !error.message.includes('No user exists')) {
      throw error;
    }
    return null;
  });

  if (existing) {
    return existing;
  }

  const password = args.password || DEFAULT_PASSWORD;
  const fullName = args.name || 'Seeded Primary Tester';
  await invoke(anon, 'register-login', {
    action: 'register',
    register: {
      fullName,
      phoneNumber: args.phone,
      password,
      studentIdImage: 'storage://student-ids/seed/tester.jpg',
    },
  });

  const { data, error } = await service
    .from('User')
    .update({
      Full_Name: fullName,
      KYC_Status: 'Verified',
      Role: 'Member',
      Student_ID_Img: 'storage://student-ids/seed/tester.jpg',
    })
    .eq('Phone_Number', args.phone)
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return data;
}

async function cleanupPreviousScenario(service, creatorId) {
  const { data: groups, error: groupError } = await service
    .from('EqubGroup')
    .select('Group_ID')
    .eq('Creator_ID', creatorId)
    .eq('Group_Name', GROUP_NAME);
  if (groupError) {
    throw groupError;
  }

  for (const group of groups || []) {
    const { data: rounds, error: roundLookupError } = await service.from('Round').select('Round_ID').eq('Group_ID', group.Group_ID);
    if (roundLookupError) {
      throw roundLookupError;
    }
    const roundIds = (rounds || []).map(round => round.Round_ID);
    if (roundIds.length) {
      const { error: transactionError } = await service.from('Transaction').delete().in('Round_ID', roundIds);
      if (transactionError) {
        throw transactionError;
      }
    }
    const { error: membershipError } = await service.from('GroupMembers').delete().eq('Group_ID', group.Group_ID);
    if (membershipError) {
      throw membershipError;
    }
    const { error: roundDeleteError } = await service.from('Round').delete().eq('Group_ID', group.Group_ID);
    if (roundDeleteError) {
      throw roundDeleteError;
    }
    const { error: groupDeleteError } = await service.from('EqubGroup').delete().eq('Group_ID', group.Group_ID);
    if (groupDeleteError) {
      throw groupDeleteError;
    }
  }
}

async function insertTransactions(service, rows) {
  const { error } = await service.from('Transaction').insert(rows);
  if (error) {
    throw error;
  }
}

async function seedScenario() {
  const args = parseArgs();
  const keys = getApiKeys();
  if (!keys.anon || !keys.serviceRole) {
    throw new Error('Supabase anon/service_role keys could not be resolved.');
  }

  const anon = createClient(SUPABASE_URL, keys.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(SUPABASE_URL, keys.serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const primaryTester = await ensurePrimaryTester(anon, service, args);
  const seededSupportUsers = [];
  for (const user of supportUsers) {
    seededSupportUsers.push(await ensureSupportUser(anon, service, user));
  }

  await cleanupPreviousScenario(service, primaryTester.User_ID);

  const virtualRef = `UEQ-SEED-${primaryTester.User_ID.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const { data: group, error: groupError } = await service
    .from('EqubGroup')
    .insert({
      Creator_ID: primaryTester.User_ID,
      Group_Name: GROUP_NAME,
      Amount: 650,
      Max_Members: 5,
      Frequency: 'Weekly',
      Virtual_Acc_Ref: virtualRef,
      Status: 'Active',
      Start_Date: new Date().toISOString().slice(0, 10),
    })
    .select('*')
    .single();
  if (groupError) {
    throw groupError;
  }

  const members = [primaryTester, ...seededSupportUsers];
  const membershipRows = members.map((member, index) => ({
    Group_ID: group.Group_ID,
    User_ID: member.User_ID,
    Joined_At: new Date(Date.now() + index * 1000).toISOString(),
    Status: 'Active',
  }));
  const { error: membershipError } = await service.from('GroupMembers').insert(membershipRows);
  if (membershipError) {
    throw membershipError;
  }

  const completedRoundIds = [];
  for (let roundNumber = 1; roundNumber <= 4; roundNumber += 1) {
    const winner = seededSupportUsers[roundNumber - 1];
    const drawDate = new Date(Date.now() - (6 - roundNumber) * 86_400_000).toISOString();
    const { data: round, error: roundError } = await service
      .from('Round')
      .insert({
        Group_ID: group.Group_ID,
        Round_Number: roundNumber,
        Winner_ID: winner.User_ID,
        Draw_Date: drawDate,
        Status: 'Completed',
      })
      .select('*')
      .single();
    if (roundError) {
      throw roundError;
    }
    completedRoundIds.push(round.Round_ID);

    await insertTransactions(service, members.map(member => ({
      User_ID: member.User_ID,
      Round_ID: round.Round_ID,
      Amount: 650,
      Type: 'Contribution',
      Payment_Method: 'MockUSSD',
      Gateway_Ref: `SEED-C-${roundNumber}-${member.User_ID.slice(0, 6)}`,
      Status: 'Successful',
      Date: drawDate,
    })));

    await insertTransactions(service, [{
      User_ID: winner.User_ID,
      Round_ID: round.Round_ID,
      Amount: 650 * members.length,
      Type: 'Payout',
      Payment_Method: 'MockUSSD',
      Gateway_Ref: `SEED-P-${roundNumber}-${winner.User_ID.slice(0, 6)}`,
      Status: 'Successful',
      Date: drawDate,
    }]);
  }

  const { data: currentRound, error: currentRoundError } = await service
    .from('Round')
    .insert({
      Group_ID: group.Group_ID,
      Round_Number: 5,
      Status: 'Open',
    })
    .select('*')
    .single();
  if (currentRoundError) {
    throw currentRoundError;
  }

  await insertTransactions(service, seededSupportUsers.map((member, index) => ({
    User_ID: member.User_ID,
    Round_ID: currentRound.Round_ID,
    Amount: 650,
    Type: 'Contribution',
    Payment_Method: 'MockUSSD',
    Gateway_Ref: `SEED-R5-${index + 1}-${member.User_ID.slice(0, 6)}`,
    Status: 'Successful',
    Date: new Date(Date.now() - (index + 1) * 60_000).toISOString(),
  })));

  console.log(JSON.stringify({
    scenario: 'final-draw',
    tester: {
      userId: primaryTester.User_ID,
      fullName: primaryTester.Full_Name,
      phoneNumber: primaryTester.Phone_Number,
      passwordNote: args.phone ? `Use ${args.password || DEFAULT_PASSWORD} unless this phone already had an existing member account.` : 'Use your existing password for this real account.',
    },
    seededSupportUsers: seededSupportUsers.map(user => ({
      fullName: user.Full_Name,
      phoneNumber: user.Phone_Number,
      password: DEFAULT_PASSWORD,
    })),
    group: {
      groupId: group.Group_ID,
      groupName: group.Group_Name,
      virtualRef,
      amount: 650,
      roundNumber: 5,
      paidCount: 4,
      totalMembers: 5,
    },
    expectedOutcome: 'When the tester pays the final contribution, the live backend should complete the round, select the tester as the only eligible winner, create a pending payout, and mark the group completed.',
  }, null, 2));
}

seedScenario().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
