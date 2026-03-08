import { createClient } from '@supabase/supabase-js';
import { UNIEQUB_SUPABASE_ANON_KEY, UNIEQUB_SUPABASE_URL } from '@env';

if (!UNIEQUB_SUPABASE_URL || !UNIEQUB_SUPABASE_ANON_KEY) {
  throw new Error('Supabase runtime config is missing. Set UNIEQUB_SUPABASE_URL and UNIEQUB_SUPABASE_ANON_KEY in mobile/.env.');
}

export const supabase = createClient(UNIEQUB_SUPABASE_URL, UNIEQUB_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
