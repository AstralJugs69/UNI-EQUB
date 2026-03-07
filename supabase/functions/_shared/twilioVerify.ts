import { env } from './env.ts';
import { toE164 } from './phone.ts';

function authHeader() {
  const raw = `${env.twilioAccountSid}:${env.twilioAuthToken}`;
  return `Basic ${btoa(raw)}`;
}

export async function requestOtp(phoneNumber: string) {
  const target = toE164(phoneNumber);
  const form = new URLSearchParams({ To: target, Channel: 'sms' });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${env.twilioVerifyServiceSid}/Verifications`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message ?? 'Failed to request OTP.');
  }
  return json;
}

export async function verifyOtp(phoneNumber: string, code: string) {
  const target = toE164(phoneNumber);
  const form = new URLSearchParams({ To: target, Code: code.trim() });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${env.twilioVerifyServiceSid}/VerificationCheck`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message ?? 'OTP verification failed.');
  }
  if (json.status !== 'approved') {
    throw new Error('OTP code is invalid or expired.');
  }
  return json;
}
