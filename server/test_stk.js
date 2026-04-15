import { supabase } from './config/db.js';

async function check() {
  const { data, error } = await supabase.from('stk_requests').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('STK Requests:', data || error);

  const { data: d2, error: e2 } = await supabase.from('audit_log').select('*').order('ts', { ascending: false }).limit(5);
  console.log('Audit logs:', d2 || e2);
}
check();
