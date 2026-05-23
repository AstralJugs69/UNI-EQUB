import { supabaseAdmin } from './supabaseAdmin.ts';
import type { UserRecord } from './types.ts';

type EmailPurpose = 'Signup' | 'ProfileChange';

function brevoConfig() {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const from = Deno.env.get('UNIEQUB_EMAIL_FROM');
  if (!apiKey || !from) {
    throw new Error('Email verification is not configured. Add BREVO_API_KEY and UNIEQUB_EMAIL_FROM secrets.');
  }
  return { apiKey, from };
}

function parseSender(value: string) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1] || 'UniEqub', email: match[2] };
  }
  return { name: 'UniEqub', email: value.trim() };
}

function randomCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function verificationLink(input: { userId: string; email: string; code: string }) {
  const params = new URLSearchParams({
    userId: input.userId,
    email: input.email,
    code: input.code,
  });
  return `uniequb://verify-email?${params.toString()}`;
}

async function sendBrevoEmail(input: { to: string; subject: string; html: string; text: string }) {
  const { apiKey, from } = brevoConfig();
  const sender = parseSender(from);
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Email provider rejected the verification message: ${response.status} ${await response.text()}`);
  }
}

export async function createAndSendEmailVerification(input: {
  user: UserRecord;
  email: string;
  purpose: EmailPurpose;
}) {
  const email = input.email.trim().toLowerCase();
  const code = randomCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const codeHash = await sha256(`${input.user.User_ID}:${email}:${code}`);

  const { error } = await supabaseAdmin
    .from('email_verification_codes')
    .insert({
      user_id: input.user.User_ID,
      email,
      code_hash: codeHash,
      purpose: input.purpose,
      expires_at: expiresAt.toISOString(),
      metadata: { source: 'brevo' },
    });
  if (error) {
    throw error;
  }

  const link = verificationLink({ userId: input.user.User_ID, email, code });
  const subject = 'Verify your UniEqub email';
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#15202B">
      <h2>Verify your UniEqub email</h2>
      <p>Hello ${input.user.Full_Name},</p>
      <p>Use this code to verify your email address:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
      <p>You can also open this link on your phone:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This code expires in 30 minutes.</p>
    </div>
  `;
  const text = `Verify your UniEqub email. Code: ${code}. Link: ${link}. This code expires in 30 minutes.`;
  await sendBrevoEmail({ to: email, subject, html, text });

  return { email, expiresAt: expiresAt.toISOString() };
}

export async function verifyEmailCode(input: {
  userId: string;
  code: string;
}) {
  const { data: userData, error: userError } = await supabaseAdmin
    .from('User')
    .select('*')
    .eq('User_ID', input.userId)
    .single();
  if (userError) {
    throw userError;
  }
  const user = userData as UserRecord;
  const email = user.Email?.trim().toLowerCase();
  if (!email) {
    throw new Error('No email address is attached to this account.');
  }

  const codeHash = await sha256(`${user.User_ID}:${email}:${input.code.trim()}`);
  const { data, error } = await supabaseAdmin
    .from('email_verification_codes')
    .select('*')
    .eq('user_id', user.User_ID)
    .eq('email', email)
    .eq('code_hash', codeHash)
    .is('consumed_at', null)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('The email verification code is incorrect or has already been used.');
  }
  if (new Date((data as { expires_at: string }).expires_at).getTime() < Date.now()) {
    throw new Error('The email verification code has expired. Request a new code.');
  }

  const now = new Date().toISOString();
  const [{ error: userUpdateError }, { error: codeUpdateError }] = await Promise.all([
    supabaseAdmin.from('User').update({ Email_Verified_At: now }).eq('User_ID', user.User_ID),
    supabaseAdmin.from('email_verification_codes').update({ consumed_at: now }).eq('id', (data as { id: string }).id),
  ]);
  if (userUpdateError) {
    throw userUpdateError;
  }
  if (codeUpdateError) {
    throw codeUpdateError;
  }

  return { email, verifiedAt: now };
}
