import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || '';
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// If env vars are missing we export null — services fall back to demo mode.
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken:  true,
        persistSession:    true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const DEMO_MODE = !supabase;
