import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, DEMO_MODE } from '@/config/supabaseClient';

// ── Demo mode stub — only used when SUPABASE is missing ──────────────────────
const DEMO_USER = null;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(null);
  const [worker,   setWorker]   = useState(null);   // row from workers table
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // ── Load worker profile from workers table ──────────────────
  // Matches by auth_user_id first, falls back to email.
  // Also backfills auth_user_id on the row if it was missing,
  // so future lookups are fast and RLS auth.uid() checks work.
  const loadWorker = useCallback(async (userId, userEmail) => {
    if (!supabase) return;

    // The workers table uses 'id' (UUID) as the primary key and reference to auth.users(id)
    let { data, error } = await supabase
      .from('workers')
      .select('*')
      .or(`id.eq.${userId},email.eq.${userEmail}`)
      .single();

    if (error) {
      console.error('[AuthContext] loadWorker:', error.message);
      return;
    }

    // Set the worker profile state
    setWorker(data);
  }, []);

  // ── Initialise ──────────────────────────────────────────────
  useEffect(() => {
    if (DEMO_MODE) {
      // No Supabase — start in demo mode, not logged in
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadWorker(session.user.id, session.user.email);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadWorker(session.user.id, session.user.email);
      else setWorker(null);
    });

    return () => subscription.unsubscribe();
  }, [loadWorker]);

  // ── Auth actions ────────────────────────────────────────────
  const signIn = useCallback(async (email, password) => {
    setError(null);

    // Demo mode: Blocked for security. Use legitimate credentials.
    if (DEMO_MODE) {
      return { error: { message: 'Authentication disabled in Demo Mode. Connect Supabase to proceed.' } };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    if (DEMO_MODE) { setSession(null); setWorker(null); return; }
    await supabase.auth.signOut();
  }, []);

  // ── Derived ─────────────────────────────────────────────────
  const isAuthenticated = !!session;
  const role = worker?.role ?? null;

  const can = useCallback((action) => {
    if (!role) return false;
    const PERMS = {
      Admin:                ['read','write','delete','approve','disburse','blacklist','report','settings'],
      'Loan Officer':       ['read','write','approve'],
      'Collections Officer':['read','write'],
      Finance:              ['read','write','report'],
      'Viewer / Auditor':   ['read','report'],
    };
    return (PERMS[role] || []).includes(action);
  }, [role]);

  const value = {
    session, worker, role, loading, error,
    isAuthenticated,
    can,
    signIn, signOut,
    DEMO_MODE,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}