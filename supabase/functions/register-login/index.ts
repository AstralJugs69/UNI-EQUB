import { fail, failFromError, json } from '../_shared/contracts.ts';
import type { RegisterLoginPayload } from '../_shared/contracts.ts';
import { hashPassword, signPendingKycToken, signSession, verifyPassword, verifySession } from '../_shared/auth.ts';
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

async function existingMemberCount() {
  const { count, error } = await supabaseAdmin
    .from('User')
    .select('User_ID', { count: 'exact', head: true })
    .eq('Role', 'Member');
  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function firstRegisteredMember() {
  const { data, error } = await supabaseAdmin
    .from('User')
    .select('*')
    .eq('Role', 'Member')
    .order('Created_At', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as UserRecord | null;
}

async function resolveOtpGateUser(input?: { token?: string; phoneNumber?: string }) {
  if (input?.token) {
    const payload = await verifySession(input.token);
    const userId = payload.sub;
    return userId ? requireUserById(userId) : null;
  }
  if (input?.phoneNumber) {
    return findUserByPhone(input.phoneNumber);
  }
  return null;
}

async function requiresTestingOtpGate(user: UserRecord | null) {
  if (!user || user.Role !== 'Member') {
    return false;
  }
  const first = await firstRegisteredMember();
  return first?.User_ID === user.User_ID;
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

        const requiresOtp = await existingMemberCount() === 0;
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

        const user = data as UserRecord;
        return json({
          user: toSessionUser(user),
          requiresOtp,
          pendingKycToken: requiresOtp ? undefined : await signPendingKycToken(user),
        }, 201);
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
        const user = await findUserByPhone(body.verifyOtp.phoneNumber);
        return json({
          sid: response.sid,
          status: response.status,
          approved: true,
          pendingKycToken: user && user.Role === 'Member' && user.KYC_Status === 'Unverified'
            ? await signPendingKycToken(user)
            : undefined,
        });
      }

      case 'otpGate': {
        const user = await resolveOtpGateUser(body.otpGate);
        return json({
          requiresOtp: await requiresTestingOtpGate(user),
          phoneNumber: user?.Phone_Number ?? body.otpGate?.phoneNumber ?? null,
        });
      }

      case 'resetPassword': {
        if (!body.resetPassword) {
          return fail('Missing reset password payload.', 400);
        }
        const user = await findUserByPhone(body.resetPassword.phoneNumber);
        if (!user) {
          return fail('No account was found for this phone number.', 404);
        }
        const requiresOtp = await requiresTestingOtpGate(user);
        if (requiresOtp) {
          if (!body.resetPassword.otp) {
            return fail('OTP is required to reset this password.', 400);
          }
          await verifyOtp(body.resetPassword.phoneNumber, body.resetPassword.otp);
        }
        const passwordHash = await hashPassword(body.resetPassword.newPassword);
        const { error } = await supabaseAdmin
          .from('User')
          .update({ Password_Hash: passwordHash })
          .eq('User_ID', user.User_ID);
        if (error) {
          throw error;
        }
        return json({ requiresOtp, reset: true });
      }

      case 'beginLogin': {
        if (!body.beginLogin) {
          return fail('Missing beginLogin payload.', 400);
        }
        const { user, error } = await validateCredentials(body.beginLogin.phoneNumber, body.beginLogin.password, body.beginLogin.roleHint);
        if (error || !user) {
          return fail(error ?? 'Login could not be completed.', 401);
        }
        const token = await signSession(user);
        return json({ token, user: toSessionUser(user) });
      }

      case 'completeLogin': {
        return fail('OTP login completion is no longer required. Use direct login.', 400);
      }

      case 'login': {
        if (!body.login) {
          return fail('Missing login payload.', 400);
        }
        const { user, error } = await validateCredentials(body.login.phoneNumber, body.login.password, body.login.roleHint);
        if (error || !user) {
          return fail(error ?? 'Login could not be completed.', 401);
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
    return failFromError(error, 'Unexpected register-login error.', 500, { functionName: 'register-login' });
  }
});
