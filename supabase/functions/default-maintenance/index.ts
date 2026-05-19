import { verifySession } from '../_shared/auth.ts';
import { fail, failFromError, json } from '../_shared/contracts.ts';
import { processDueContributionObligations } from '../_shared/obligations.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { UserRecord } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DefaultMaintenancePayload {
  token: string;
  action: 'sweepDueObligations';
  limit?: number;
  dryRun?: boolean;
  now?: string;
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
  if (user.KYC_Status === 'Banned') {
    throw new Error('This account has been banned.');
  }
  if (user.Role !== 'Admin') {
    throw new Error('Admin access is required for default maintenance.');
  }
  return user;
}

function parseNow(value: string | undefined) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now timestamp.');
  }
  return parsed;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = (await request.json()) as DefaultMaintenancePayload;
    await requireAdmin(body.token);

    switch (body.action) {
      case 'sweepDueObligations':
        return json(await processDueContributionObligations({
          limit: body.limit,
          dryRun: body.dryRun,
          now: parseNow(body.now),
        }));
      default:
        return fail('Unsupported default maintenance action.', 400);
    }
  } catch (error) {
    return failFromError(error, 'Unexpected default maintenance error.', 500, { functionName: 'default-maintenance' });
  }
});
