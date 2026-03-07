import { fail, json } from '../_shared/contracts.ts';
import type { RegisterLoginPayload } from '../_shared/contracts.ts';
import { hashPassword, signLoginChallenge, signSession, verifyLoginChallenge, verifyPassword, verifySession } from '../_shared/auth.ts';
import { normalizePhone } from '../_shared/phone.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import type { UserRecord } from '../_shared/types.ts';
import { toSessionUser } from '../_shared/types.ts';
import { requestOtp, verifyOtp } from '../_shared/twilioVerify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function findUserByPhone(phoneNumber: string) {
  const normalized = normalizePhone(phoneNumber);
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('Phone_Number', normalized).maybeSingle();
  if (error) {
    throw error;
  }
  return data as UserRecord | null;
}

async function requireUserById(userId: string) {
  const { data, error } = await supabaseAdmin.from('User').select('*').eq('User_ID', userId).single();
  if (error) {
    throw error;
  }
  return data as UserRecord;
}

async function validateCredentials(phoneNumber: string, password: string, roleHint?: 'Member' | 'Admin') {
  const user = await findUserByPhone(phoneNumber);
  if (!user) {
    return { error: 'Invalid phone number or password.', user: null as UserRecord | null };
  }
  if (roleHint && user.Role !== roleHint) {
    return { error: `${roleHint} access is not available for this account.`, user: null as UserRecord | null };
  }
  if (user.KYC_Status === 'Banned') {
    return { error: 'This account has been banned and cannot log in.', user: null as UserRecord | null };
  }
  const valid = await verifyPassword(password, user.Password_Hash);
  if (!valid) {
    return { error: 'Invalid phone number or password.', user: null as UserRecord | null };
  }
  return { error: null, user };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  try {
    const body = (await request.json()) as RegisterLoginPayload;

    switch (body.action) {
      case 'register': {
        if (!body.register) {
          return fail('Missing register payload.', 400);
        }
        const existing = await findUserByPhone(body.register.phoneNumber);
        if (existing) {
          return fail('Phone number is already registered.', 409);
        }

        const passwordHash = await hashPassword(body.register.password);
        const normalized = normalizePhone(body.register.phoneNumber);
        const { data, error } = await supabaseAdmin
          .from('User')
          .insert({
            Full_Name: body.register.fullName,
            Phone_Number: normalized,
            Password_Hash: passwordHash,
            Student_ID_Img: body.register.studentIdImage,
            KYC_Status: 'Unverified',
            Role: 'Member',
          })
          .select('*')
          .single();

        if (error) {
          throw error;
        }

        return json({ user: toSessionUser(data as UserRecord) }, 201);
      }

      case 'requestOtp': {
        if (!body.requestOtp) {
          return fail('Missing OTP request payload.', 400);
        }
        const response = await requestOtp(body.requestOtp.phoneNumber);
        return json({ challengeId: response.sid, status: response.status });
      }

      case 'verifyOtp': {
        if (!body.verifyOtp) {
          return fail('Missing OTP verification payload.', 400);
        }
        const response = await verifyOtp(body.verifyOtp.phoneNumber, body.verifyOtp.otp);
        return json({ sid: response.sid, status: response.status, approved: true });
      }

      case 'beginLogin': {
        if (!body.beginLogin) {
          return fail('Missing beginLogin payload.', 400);
        }
        const { user, error } = await validateCredentials(body.beginLogin.phoneNumber, body.beginLogin.password, body.beginLogin.roleHint);
        if (error || !user) {
          return fail(error ?? 'Login challenge could not be created.', 401);
        }
        await requestOtp(user.Phone_Number);
        const challengeToken = await signLoginChallenge(user);
        return json({ challengeToken, phoneNumber: user.Phone_Number });
      }

      case 'completeLogin': {
        if (!body.completeLogin) {
          return fail('Missing completeLogin payload.', 400);
        }
        const payload = await verifyLoginChallenge(body.completeLogin.challengeToken);
        const userId = payload.sub;
        const phoneNumber = payload.phone as string | undefined;
        if (!userId || !phoneNumber) {
          return fail('Invalid login challenge token.', 401);
        }
        await verifyOtp(phoneNumber, body.completeLogin.otp);
        const user = await requireUserById(userId);
        if (user.KYC_Status === 'Banned') {
          return fail('This account has been banned and cannot log in.', 403);
        }
        const token = await signSession(user);
        return json({ token, user: toSessionUser(user) });
      }

      case 'login': {
        if (!body.login) {
          return fail('Missing login payload.', 400);
        }
        const { user, error } = await validateCredentials(body.login.phoneNumber, body.login.password, body.login.roleHint);
        if (error || !user) {
          return fail(error ?? 'Invalid credentials.', 401);
        }
        const token = await signSession(user);
        return json({ token, user: toSessionUser(user) });
      }

      case 'restore': {
        if (!body.restore?.token) {
          return fail('Missing restore token.', 400);
        }
        const payload = await verifySession(body.restore.token);
        const userId = payload.sub;
        if (!userId) {
          return fail('Invalid session token.', 401);
        }
        const user = await requireUserById(userId);
        if (user.KYC_Status === 'Banned') {
          return fail('This account has been banned and cannot restore a session.', 403);
        }
        return json({ token: body.restore.token, user: toSessionUser(user) });
      }

      default:
        return fail('Unsupported register-login action.', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected register-login error.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
