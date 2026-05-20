import { fail, failFromError, json } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { UserRecord } from '../_shared/types.ts';

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
  return data as UserRecord;
}

function assertSelfOrAdmin(actor: UserRecord, userId: string) {
  if (actor.User_ID !== userId && actor.Role !== 'Admin') {
    throw new Error('Profile access is not allowed for this account.');
  }
}

function avatarSeedFor(userId: string) {
  return `uniequb:${userId}`;
}

function toProfile(row: Record<string, unknown>) {
  return {
    userId: row.user_id,
    university: row.university,
    academicYear: row.academic_year,
    language: row.language,
    theme: row.theme,
    notificationPreference: row.notification_preference,
    walletLabel: row.wallet_label,
    avatar: {
      seed: row.avatar_seed,
      style: row.avatar_style,
      palette: row.avatar_palette,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureProfile(userId: string) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (existingError) {
    throw existingError;
  }
  if (existing) {
    return existing as Record<string, unknown>;
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      user_id: userId,
      avatar_seed: avatarSeedFor(userId),
      avatar_style: 'Geometric',
      avatar_palette: 'blue',
    })
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return data as Record<string, unknown>;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = await request.json();
    const actor = await requireActor(body.token);
    const userId = body.userId ?? actor.User_ID;
    assertSelfOrAdmin(actor, userId);

    switch (body.action) {
      case 'getProfile': {
        return json({ profile: toProfile(await ensureProfile(userId)) });
      }
      case 'ensureAvatarSeed': {
        const row = await ensureProfile(userId);
        return json({
          avatar: {
            seed: row.avatar_seed,
            style: row.avatar_style,
            palette: row.avatar_palette,
          },
        });
      }
      case 'updateProfile': {
        const profile = body.profile ?? {};
        await ensureProfile(userId);
        const update = {
          university: profile.university ?? undefined,
          academic_year: profile.academicYear ?? undefined,
          language: profile.language ?? undefined,
          theme: profile.theme ?? undefined,
          notification_preference: profile.notificationPreference ?? undefined,
          wallet_label: profile.walletLabel ?? undefined,
          avatar_seed: profile.avatarSeed ?? undefined,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .update(update)
          .eq('user_id', userId)
          .select('*')
          .single();
        if (error) {
          throw error;
        }
        return json({ profile: toProfile(data as Record<string, unknown>) });
      }
      default:
        return fail('Unsupported profile action.', 400);
    }
  } catch (error) {
    return failFromError(error, 'Unexpected profile center error.', 500, { functionName: 'profile-center' });
  }
});
