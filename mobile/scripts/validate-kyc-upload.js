const { execSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_REF = 'yxgfvkxdiicvckcwpdmc';
const SUPABASE_URL = 'https://yxgfvkxdiicvckcwpdmc.supabase.co';
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z08kAAAAASUVORK5CYII=';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--output') {
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

async function main() {
  const args = parseArgs();
  const keys = getApiKeys();
  const anon = createClient(SUPABASE_URL, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(SUPABASE_URL, keys.serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const suffix = String(Date.now()).slice(-8);
  const phone = `09${suffix}`;
  const password = 'temp1234';
  let userId = null;
  let uploadedPaths = [];

  try {
    const registered = await invoke(anon, 'register-login', {
      action: 'register',
      register: {
        fullName: `KYC Validation ${suffix}`,
        phoneNumber: phone,
        password,
        studentIdImage: 'storage://students/pending-upload.png',
      },
    });
    userId = registered.user.userId;

    const uploads = [];
    for (const name of ['front-id.png', 'back-id.png', 'selfie.png']) {
      const upload = await invoke(anon, 'kyc-submit-review', {
        action: 'createUploadUrl',
        userId,
        fileName: name,
        contentType: 'image/png',
      });

      const { error: uploadError } = await anon.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, Buffer.from(PNG_BASE64, 'base64'), {
          contentType: upload.contentType,
        });

      if (uploadError) {
        throw uploadError;
      }

      uploads.push(`storage://${upload.bucket}/${upload.path}`);
      uploadedPaths.push(upload.path);
    }

    const manifestRef = uploads[0];
    await invoke(anon, 'kyc-submit-review', {
      action: 'submit',
      userId,
      imageRef: manifestRef,
    });

    const { data: user, error: userError } = await service.from('User').select('Student_ID_Img,KYC_Status').eq('User_ID', userId).single();
    if (userError) {
      throw userError;
    }

    const result = {
      scenario: 'kyc-upload',
      userId,
      storedReference: user.Student_ID_Img,
      kycStatus: user.KYC_Status,
      uploadedObjectCount: uploads.length,
      validatedAt: new Date().toISOString(),
    };

    if (args.output) {
      fs.mkdirSync(path.dirname(args.output), { recursive: true });
      fs.writeFileSync(args.output, JSON.stringify(result, null, 2));
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (uploadedPaths.length) {
      await service.storage.from('student-ids').remove(uploadedPaths);
    }
    if (userId) {
      await service.from('User').delete().eq('User_ID', userId);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
