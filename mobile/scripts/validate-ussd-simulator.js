const { execSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_REF = 'yxgfvkxdiicvckcwpdmc';
const SUPABASE_URL = 'https://yxgfvkxdiicvckcwpdmc.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ussd-simulator`;

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
    serviceRole: keys.find(item => item.id === 'service_role')?.api_key,
  };
}

async function postUssd(body) {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text);
  }
  return text;
}

async function main() {
  const args = parseArgs();
  const keys = getApiKeys();
  const service = createClient(SUPABASE_URL, keys.serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = String(Date.now()).slice(-8);
  const phoneNumber = `09${suffix}`;
  const sessionId = `qa-${suffix}`;
  let user;
  let group;
  let round;

  try {
    const { data: createdUser, error: userError } = await service
      .from('User')
      .insert({
        Full_Name: `USSD QA ${suffix}`,
        Phone_Number: phoneNumber,
        Password_Hash: 'not-used-in-ussd',
        Student_ID_Img: 'storage://student-ids/qa/member.jpg',
        KYC_Status: 'Verified',
        Role: 'Member',
      })
      .select('*')
      .single();
    if (userError) {
      throw userError;
    }
    user = createdUser;

    const { data: createdGroup, error: groupError } = await service
      .from('EqubGroup')
      .insert({
        Creator_ID: user.User_ID,
        Group_Name: `USSD QA Group ${suffix}`,
        Amount: 700,
        Max_Members: 5,
        Frequency: 'Weekly',
        Virtual_Acc_Ref: `UEQ-USSD-${suffix}`,
        Status: 'Active',
        Start_Date: new Date().toISOString().slice(0, 10),
      })
      .select('*')
      .single();
    if (groupError) {
      throw groupError;
    }
    group = createdGroup;

    const { error: membershipError } = await service.from('GroupMembers').insert({
      Group_ID: group.Group_ID,
      User_ID: user.User_ID,
      Joined_At: new Date().toISOString(),
      Status: 'Active',
    });
    if (membershipError) {
      throw membershipError;
    }

    const { data: createdRound, error: roundError } = await service
      .from('Round')
      .insert({
        Group_ID: group.Group_ID,
        Round_Number: 1,
        Status: 'Open',
      })
      .select('*')
      .single();
    if (roundError) {
      throw roundError;
    }
    round = createdRound;

    const steps = [];
    steps.push(await postUssd({ sessionId, serviceCode: '*483*227#', phoneNumber, text: '' }));
    steps.push(await postUssd({ sessionId, serviceCode: '*483*227#', phoneNumber, text: '1' }));
    steps.push(await postUssd({ sessionId, serviceCode: '*483*227#', phoneNumber, text: '1*1' }));
    steps.push(await postUssd({ sessionId, serviceCode: '*483*227#', phoneNumber, text: '1*1*1' }));

    const { data: contribution, error: contributionError } = await service
      .from('Transaction')
      .select('*')
      .eq('Round_ID', round.Round_ID)
      .eq('User_ID', user.User_ID)
      .eq('Type', 'Contribution')
      .maybeSingle();
    if (contributionError) {
      throw contributionError;
    }

    const result = {
      scenario: 'ussd-simulator',
      phoneNumber,
      sessionId,
      steps,
      contributionRecorded: !!contribution,
      gatewayRef: contribution?.Gateway_Ref ?? null,
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
      const roundIds = (rounds ?? []).map(item => item.Round_ID);
      if (roundIds.length) {
        await service.from('Transaction').delete().in('Round_ID', roundIds);
      }
      await service.from('GroupMembers').delete().eq('Group_ID', group.Group_ID);
      await service.from('Round').delete().eq('Group_ID', group.Group_ID);
      await service.from('EqubGroup').delete().eq('Group_ID', group.Group_ID);
    }
    if (user?.User_ID) {
      await service.from('User').delete().eq('User_ID', user.User_ID);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
