import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yxgfvkxdiicvckcwpdmc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Z2Z2a3hkaWljdmNrY3dwZG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NzE1ODMsImV4cCI6MjA4ODQ0NzU4M30.jlX2vwBaSfqlzM-Z84-3-hHdvSLF9UHvfFY3lxZUbys';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
