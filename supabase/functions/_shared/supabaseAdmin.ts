import { createClient } from 'jsr:@supabase/supabase-js@2';
import { env } from './env.ts';

export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
