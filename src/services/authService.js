import { supabase, DEMO_MODE } from '@/config/supabaseClient';

export async function signIn(email, password) {
  if (DEMO_MODE) return { data: null, error: { message: 'Demo mode — use AuthContext.signIn' } };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (DEMO_MODE) return;
  return supabase.auth.signOut();
}

export async function getSession() {
  if (DEMO_MODE) return { data: { session: null }, error: null };
  return supabase.auth.getSession();
}

/** Fetch the worker profile row for a given auth user id */
export async function getWorkerProfile(authUserId) {
  if (!supabase) return { data: null, error: { message: 'No Supabase' } };
  return supabase.from('workers').select('*').eq('auth_user_id', authUserId).single();
}
