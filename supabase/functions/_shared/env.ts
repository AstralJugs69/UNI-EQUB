export function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: getRequiredEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  appJwtSecret: getRequiredEnv('APP_JWT_SECRET'),
  twilioAccountSid: getRequiredEnv('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: getRequiredEnv('TWILIO_AUTH_TOKEN'),
  twilioVerifyServiceSid: getRequiredEnv('TWILIO_VERIFY_SERVICE_SID'),
};
