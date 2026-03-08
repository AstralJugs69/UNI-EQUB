import { fail, json } from '../_shared/contracts.ts';
import { signSession, verifyPendingKycToken, verifySession } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { toSessionUser } from '../_shared/types.ts';
import type { UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KycPayload {
  action: 'createUploadUrl' | 'submit' | 'listPending' | 'approve' | 'ban';
  token?: string;
  userId?: string;
  imageRef?: string;
  fileName?: string;
  contentType?: string;
}

async function updateUser(userId: string, changes: Partial<UserRecord>) {
  const { data, error } = await supabaseAdmin.from('User').update(changes).eq('User_ID', userId).select('*').single();
  if (error) {
    throw error;
  }
  return data as UserRecord;
}

async function requirePendingKycActor(token: string, expectedUserId?: string) {
  const payload = await verifyPendingKycToken(token);
  const userId = payload.sub;
  if (!userId) {
    throw new Error('Invalid pending KYC token.');
  }
  if (expectedUserId && expectedUserId !== userId) {
    throw new Error('Pending KYC token does not match the requested user.');
  }
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw error;
  }
  return data as UserRecord;
}

async function requireAdminActor(token: string) {
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
    throw new Error('Admin access is required for KYC review.');
  }
  if (user.KYC_Status === 'Banned') {
    throw new Error('This admin account has been banned.');
  }
  return user;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = (await request.json()) as KycPayload;

    switch (body.action) {
      case 'createUploadUrl': {
        if (!body.userId || !body.token) {
          return fail('Missing userId for KYC upload.', 400);
        }
        await requirePendingKycActor(body.token, body.userId);
        const fileName = (body.fileName ?? 'student-id.png').replace(/[^a-zA-Z0-9._-]/g, '-');
        const objectPath = `${body.userId}/${Date.now()}-${fileName}`;
        const { data, error } = await supabaseAdmin.storage.from('student-ids').createSignedUploadUrl(objectPath);
        if (error) {
          throw error;
        }
        return json({
          bucket: 'student-ids',
          path: objectPath,
          token: data.token,
          signedUrl: data.signedUrl,
          contentType: body.contentType ?? 'image/png',
        });
      }

      case 'submit': {
        if (!body.userId || !body.imageRef || !body.token) {
          return fail('Missing KYC submit payload.', 400);
        }
        await requirePendingKycActor(body.token, body.userId);
        const user = await updateUser(body.userId, {
          Student_ID_Img: body.imageRef,
          KYC_Status: 'Unverified',
        });
        return json({ user, token: await signSession(user), sessionUser: toSessionUser(user) });
      }

      case 'listPending': {
        if (!body.token) {
          return fail('Missing admin token for KYC review.', 401);
        }
        await requireAdminActor(body.token);
        const { data, error } = await supabaseAdmin
          .from('User')
          .select('*')
          .eq('Role', 'Member')
          .eq('KYC_Status', 'Unverified')
          .order('Created_At', { ascending: false });
        if (error) {
          throw error;
        }
        return json({ users: data as UserRecord[] });
      }

      case 'approve': {
        if (!body.userId || !body.token) {
          return fail('Missing userId for approval.', 400);
        }
        await requireAdminActor(body.token);
        const user = await updateUser(body.userId, { KYC_Status: 'Verified' });
        return json({ user });
      }

      case 'ban': {
        if (!body.userId || !body.token) {
          return fail('Missing userId for ban.', 400);
        }
        await requireAdminActor(body.token);
        const user = await updateUser(body.userId, { KYC_Status: 'Banned' });
        return json({ user });
      }

      default:
        return fail('Unsupported KYC action.', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected KYC error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
