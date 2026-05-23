import { fail, failFromError, json } from '../_shared/contracts.ts';
import { verifySession } from '../_shared/auth.ts';
import { createAndSendEmailVerification } from '../_shared/emailVerification.ts';
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
}

function normalizePhone(phoneNumber: string) {
  const compact = phoneNumber.replace(/[\s-]/g, '');
  if (compact.startsWith('+251')) {
    return `0${compact.slice(4)}`;
  }
  if (compact.startsWith('251')) {
    return `0${compact.slice(3)}`;
  }
  if (compact.startsWith('9')) {
    return `0${compact}`;
  }
  return compact;
}

function validateEthiopianPhone(phoneNumber: string) {
  return /^(?:\+251|0)?9\d{8}$/.test(phoneNumber.replace(/[\s-]/g, ''));
}

async function getUser(userId: string) {
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw error;
  }
  return data as UserRecord;
}

function toProfile(row: Record<string, unknown>, user?: UserRecord | null) {
  return {
    userId: row.user_id,
    email: user?.Email ?? null,
    emailVerifiedAt: user?.Email_Verified_At ?? null,
    phoneNumber: user?.Phone_Number ?? null,
    university: row.university,
    academicYear: row.academic_year,
    language: row.language,
    theme: row.theme,
    notificationPreference: row.notification_preference,
    walletLabel: row.wallet_label,
    profileImagePath: row.profile_image_path,
    profileImageUrl: row.profile_image_signed_url ?? null,
    avatar: {
      seed: row.avatar_seed,
      style: row.avatar_style,
      palette: row.avatar_palette,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function toProfileWithImage(row: Record<string, unknown>) {
  const userId = String(row.user_id);
  const user = await getUser(userId);
  const path = typeof row.profile_image_path === 'string' ? row.profile_image_path : null;
  if (!path) {
    return toProfile(row, user);
  }
  const bucket = typeof row.profile_image_bucket === 'string' ? row.profile_image_bucket : 'profile-pictures';
  const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return toProfile({
    ...row,
    profile_image_signed_url: data?.signedUrl ?? null,
  }, user);
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

function bytesFromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function extensionFor(contentType: string, fileName?: string) {
  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (contentType === 'image/png') {
    return 'png';
  }
  if (contentType === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}

async function uploadProfileImage(userId: string, image: Record<string, unknown>) {
  const contentType = typeof image.contentType === 'string' ? image.contentType : 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error('Profile image must be an image file.');
  }
  const base64 = typeof image.base64 === 'string' ? image.base64 : '';
  if (!base64) {
    throw new Error('Profile image data is missing.');
  }
  const fileName = typeof image.fileName === 'string' ? image.fileName : undefined;
  const objectPath = `${userId}/${crypto.randomUUID()}.${extensionFor(contentType, fileName)}`;
  const bucket = 'profile-pictures';
  const bytes = bytesFromBase64(base64);

  const existing = await ensureProfile(userId);
  const existingPath = typeof existing.profile_image_path === 'string' ? existing.profile_image_path : null;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(objectPath, bytes, { contentType, upsert: true });
  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      profile_image_bucket: bucket,
      profile_image_path: objectPath,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) {
    throw error;
  }

  if (existingPath && existingPath !== objectPath) {
    await supabaseAdmin.storage.from(bucket).remove([existingPath]);
  }

  return data as Record<string, unknown>;
}

async function removeProfileImage(userId: string) {
  const existing = await ensureProfile(userId);
  const bucket = typeof existing.profile_image_bucket === 'string' ? existing.profile_image_bucket : 'profile-pictures';
  const path = typeof existing.profile_image_path === 'string' ? existing.profile_image_path : null;
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      profile_image_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  if (path) {
    await supabaseAdmin.storage.from(bucket).remove([path]);
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
        return json({ profile: await toProfileWithImage(await ensureProfile(userId)) });
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
        const userUpdates: Record<string, unknown> = {};
        let shouldSendEmailVerification = false;
        if (typeof profile.email === 'string') {
          const email = normalizeEmail(profile.email);
          if (!validateEmail(email)) {
            throw new Error('Enter a valid email address.');
          }
          const currentUser = await getUser(userId);
          if (currentUser.Email?.toLowerCase() !== email) {
            userUpdates.Email = email;
            userUpdates.Email_Verified_At = null;
            shouldSendEmailVerification = true;
          }
        }
        if (typeof profile.phoneNumber === 'string') {
          if (!validateEthiopianPhone(profile.phoneNumber)) {
            throw new Error('Phone number must be a valid Ethiopian mobile number.');
          }
          userUpdates.Phone_Number = normalizePhone(profile.phoneNumber);
        }
        if (Object.keys(userUpdates).length) {
          const { error: userError } = await supabaseAdmin
            .from('User')
            .update(userUpdates)
            .eq('User_ID', userId);
          if (userError) {
            throw userError;
          }
          if (shouldSendEmailVerification) {
            const refreshed = await getUser(userId);
            await createAndSendEmailVerification({
              user: refreshed,
              email: refreshed.Email ?? '',
              purpose: 'ProfileChange',
            });
          }
        }
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
        return json({ profile: await toProfileWithImage(data as Record<string, unknown>) });
      }
      case 'uploadProfileImage': {
        return json({ profile: await toProfileWithImage(await uploadProfileImage(userId, body.image ?? {})) });
      }
      case 'removeProfileImage': {
        return json({ profile: await toProfileWithImage(await removeProfileImage(userId)) });
      }
      default:
        return fail('Unsupported profile action.', 400);
    }
  } catch (error) {
    return failFromError(error, 'Unexpected profile center error.', 500, { functionName: 'profile-center' });
  }
});
