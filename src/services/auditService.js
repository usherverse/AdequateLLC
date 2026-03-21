import { supabase, DEMO_MODE } from '@/config/supabaseClient';

/**
 * Write an audit log entry.
 * In demo mode this is a no-op — the LMS core manages audit in-memory.
 */
export async function addAuditLog({ userId, userLabel, action, target, detail = '' }) {
  if (DEMO_MODE || !supabase) return { error: null };
  const { error } = await supabase.from('audit_logs').insert([{
    user_id:    userId   ?? null,
    user_label: userLabel ?? 'System',
    action,
    target,
    detail,
  }]);
  if (error) console.error('[auditService]', error.message);
  return { error };
}

/**
 * Fetch recent audit log entries (admin only — enforced by RLS).
 */
export async function getAuditLogs({ limit = 200, offset = 0 } = {}) {
  if (DEMO_MODE || !supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('ts', { ascending: false })
    .range(offset, offset + limit - 1);
  return { data: data ?? [], error };
}
