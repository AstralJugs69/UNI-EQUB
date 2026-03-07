import { fail, json } from '../_shared/contracts.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KycPayload {
  action: 'submit' | 'listPending' | 'approve' | 'ban';
  userId?: string;
  imageRef?: string;
}

async function updateUser(userId: string, changes: Partial<UserRecord>) {
  const { data, error } = await supabaseAdmin.from('User').update(changes).eq('User_ID', userId).select('*').single();
  if (error) {
    throw error;
  }
  return data as UserRecord;
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
      case 'submit': {
        if (!body.userId || !body.imageRef) {
          return fail('Missing KYC submit payload.', 400);
        }
        const user = await updateUser(body.userId, {
          Student_ID_Img: body.imageRef,
          KYC_Status: 'Unverified',
        });
        return json({ user });
      }

      case 'listPending': {
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
        if (!body.userId) {
          return fail('Missing userId for approval.', 400);
        }
        const user = await updateUser(body.userId, { KYC_Status: 'Verified' });
        return json({ user });
      }

      case 'ban': {
        if (!body.userId) {
          return fail('Missing userId for ban.', 400);
        }
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
