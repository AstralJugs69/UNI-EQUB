import { fail, json } from '../_shared/contracts.ts';
import type { PayoutWithdrawPayload } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { TransactionRecord, UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function requireActor(token: string) {
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
  if (user.KYC_Status === 'Banned') {
    throw new Error('This account has been banned.');
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
    const body = (await request.json()) as PayoutWithdrawPayload;
    if (body.action !== 'withdraw') {
      return fail('Unsupported payout action.', 400);
    }

    const actor = await requireActor(body.token);
    const { data, error } = await supabaseAdmin
      .from('Transaction')
      .select('*')
      .eq('User_ID', actor.User_ID)
      .eq('Type', 'Payout')
      .eq('Status', 'Pending')
      .order('Date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      return fail('No pending payout is available.', 404);
    }

    const payout = data as TransactionRecord;
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('Transaction')
      .update({
        Status: 'Successful',
        Date: new Date().toISOString(),
      })
      .eq('Trans_ID', payout.Trans_ID)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    return json({ payout: updated as TransactionRecord });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected payout withdraw error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
