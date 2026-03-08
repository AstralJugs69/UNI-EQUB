const { execSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_REF = 'yxgfvkxdiicvckcwpdmc';
const SUPABASE_URL = 'https://yxgfvkxdiicvckcwpdmc.supabase.co';

const supportUsers = [
  { fullName: 'Seed Member One', phoneNumber: '0917000001' },
  { fullName: 'Seed Member Two', phoneNumber: '0917000002' },
  { fullName: 'Seed Member Three', phoneNumber: '0917000003' },
  { fullName: 'Seed Member Four', phoneNumber: '0917000004' },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--output') {
      parsed.output = args[index + 1];
      index += 1;
    }
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

async function ensureUser(anon, service, phoneNumber, fullName, password) {
  let { data } = await service.from('User').select('*').eq('Phone_Number', phoneNumber).maybeSingle();
  if (!data) {
    await invoke(anon, 'register-login', {
      action: 'register',
      register: {
        fullName,
        phoneNumber,
        password,
        studentIdImage: 'storage://student-ids/seed/member.jpg',
      },
    });
    ({ data } = await service.from('User').select('*').eq('Phone_Number', phoneNumber).single());
  }

  const { data: updated, error } = await service
    .from('User')
    .update({
      Full_Name: fullName,
      KYC_Status: 'Verified',
      Role: 'Member',
      Student_ID_Img: 'storage://student-ids/seed/member.jpg',
    })
    .eq('Phone_Number', phoneNumber)
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return updated;
}

async function main() {
  const args = parseArgs();
  const keys = getApiKeys();
  const anon = createClient(SUPABASE_URL, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(SUPABASE_URL, keys.serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const suffix = String(Date.now()).slice(-8);
  const testerPhone = `09${suffix}`;
  const testerPassword = 'temp1234';
  let tester;
  let group;

  try {
    tester = await ensureUser(anon, service, testerPhone, `Wallet Clearance ${suffix}`, testerPassword);
    const supports = [];
    for (const user of supportUsers) {
      supports.push(await ensureUser(anon, service, user.phoneNumber, user.fullName, 'member1234'));
    }

    const { data: createdGroup, error: groupError } = await service
      .from('EqubGroup')
      .insert({
        Creator_ID: tester.User_ID,
        Group_Name: `Wallet Clearance Cycle ${suffix}`,
        Amount: 650,
        Max_Members: 5,
        Frequency: 'Weekly',
        Virtual_Acc_Ref: `UEQ-CLR-${suffix}`,
        Status: 'Active',
        Start_Date: new Date().toISOString().slice(0, 10),
      })
      .select('*')
      .single();
    if (groupError) {
      throw groupError;
    }
    group = createdGroup;

    const members = [tester, ...supports];
    await service.from('GroupMembers').insert(members.map(member => ({
      Group_ID: group.Group_ID,
      User_ID: member.User_ID,
      Joined_At: new Date().toISOString(),
      Status: 'Active',
    })));

    for (let roundNumber = 1; roundNumber <= 4; roundNumber += 1) {
      const winner = supports[roundNumber - 1];
      const drawDate = new Date(Date.now() - (6 - roundNumber) * 86400000).toISOString();
      const { data: round } = await service
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

      await service.from('Transaction').insert(members.map(member => ({
        User_ID: member.User_ID,
        Round_ID: round.Round_ID,
        Amount: 650,
        Type: 'Contribution',
        Payment_Method: 'MockUSSD',
        Gateway_Ref: `QA-C-${roundNumber}-${member.User_ID.slice(0, 6)}`,
        Status: 'Successful',
        Date: drawDate,
      })));

      await service.from('Transaction').insert({
        User_ID: winner.User_ID,
        Round_ID: round.Round_ID,
        Amount: 3250,
        Type: 'Payout',
        Payment_Method: 'MockUSSD',
        Gateway_Ref: `QA-P-${roundNumber}-${winner.User_ID.slice(0, 6)}`,
        Status: 'Successful',
        Date: drawDate,
      });
    }

    const { data: currentRound } = await service
      .from('Round')
      .insert({
        Group_ID: group.Group_ID,
        Round_Number: 5,
        Status: 'Open',
      })
      .select('*')
      .single();

    await service.from('Transaction').insert(supports.map((member, index) => ({
      User_ID: member.User_ID,
      Round_ID: currentRound.Round_ID,
      Amount: 650,
      Type: 'Contribution',
      Payment_Method: 'MockUSSD',
      Gateway_Ref: `QA-R5-${index + 1}-${member.User_ID.slice(0, 6)}`,
      Status: 'Successful',
      Date: new Date(Date.now() - (index + 1) * 60000).toISOString(),
    })));

    const login = await invoke(anon, 'register-login', {
      action: 'login',
      login: { phoneNumber: testerPhone, password: testerPassword, roleHint: 'Member' },
    });

    const callback = await invoke(anon, 'contribution-reconcile', {
      action: 'reconcileProviderCallback',
      token: login.token,
      groupId: group.Group_ID,
      method: 'Telebirr',
      senderPhone: testerPhone.replace(/^0/, '+251'),
      amount: 650,
      gatewayRef: `QA-CB-${suffix}`,
    });

    const { data: pendingBefore } = await service
      .from('Transaction')
      .select('*')
      .eq('User_ID', tester.User_ID)
      .eq('Type', 'Payout')
      .eq('Status', 'Pending');

    await invoke(anon, 'wallet-clearance', {
      action: 'withdraw',
      token: login.token,
    });

    const { data: pendingAfter } = await service
      .from('Transaction')
      .select('*')
      .eq('User_ID', tester.User_ID)
      .eq('Type', 'Payout')
      .eq('Status', 'Pending');

    const { data: successfulPayouts } = await service
      .from('Transaction')
      .select('*')
      .eq('User_ID', tester.User_ID)
      .eq('Type', 'Payout')
      .eq('Status', 'Successful');

    const result = {
      scenario: 'wallet-clearance',
      testerPhone,
      groupId: group.Group_ID,
      callbackReceipt: callback.paymentResult.receiptRef,
      autoDrawTriggered: callback.paymentResult.autoDrawTriggered,
      payoutAmount: callback.paymentResult.payoutAmount,
      pendingPayoutsBeforeClearance: pendingBefore?.length ?? 0,
      pendingPayoutsAfterClearance: pendingAfter?.length ?? 0,
      successfulPayoutCountAfterClearance: successfulPayouts?.length ?? 0,
      validatedAt: new Date().toISOString(),
    };

    if (args.output) {
      fs.mkdirSync(path.dirname(args.output), { recursive: true });
      fs.writeFileSync(args.output, JSON.stringify(result, null, 2));
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (group?.Group_ID) {
      const { data: rounds } = await service.from('Round').select('Round_ID').eq('Group_ID', group.Group_ID);
      const roundIds = (rounds ?? []).map(row => row.Round_ID);
      if (roundIds.length) {
        await service.from('Transaction').delete().in('Round_ID', roundIds);
      }
      await service.from('GroupMembers').delete().eq('Group_ID', group.Group_ID);
      await service.from('Round').delete().eq('Group_ID', group.Group_ID);
      await service.from('EqubGroup').delete().eq('Group_ID', group.Group_ID);
    }
    if (tester?.User_ID) {
      await service.from('User').delete().eq('User_ID', tester.User_ID);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
