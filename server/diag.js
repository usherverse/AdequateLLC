import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Adjust if needed

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('--- Checking Recent Disbursements ---');
  const { data: disbs } = await supabase.from('b2c_disbursements').select('*').order('created_at', { ascending: false }).limit(5);
  console.table(disbs?.map(d => ({
    time: d.created_at,
    status: d.status,
    amount: d.amount,
    loan: d.loan_id,
    orig: d.originator_conversation_id?.substring(0, 10) + '...',
    res_code: d.result_code,
    res_desc: d.result_desc
  })));

  console.log('\n--- Checking Stuck Loans ---');
  const { data: loans } = await supabase.from('loans').select('id, customer, amount, status').eq('status', 'Disbursing');
  console.table(loans);

  console.log('\n--- Recent Audit Logs (System) ---');
  const { data: logs } = await supabase.from('audit_log').select('*').eq('user_name', 'System').order('ts', { ascending: false }).limit(10);
  console.table(logs?.map(l => ({ ts: l.ts, action: l.action, detail: l.detail?.substring(0, 50) + '...' })));
}
check();
