import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: unalloc_p, error: e1, count: unalloc_count } = await supabase.from('unallocated_payments').select('*', { count: 'exact' });
  const { data: p_unalloc, error: e2, count: p_unalloc_count } = await supabase.from('payments').select('*', { count: 'exact' }).eq('status', 'Unallocated');
  const { count: total_p, error: e3 } = await supabase.from('payments').select('*', { count: 'exact', head: true });
  const { count: total_l, error: e4 } = await supabase.from('loans').select('*', { count: 'exact', head: true });
  
  if (e1) console.error('Error fetching unallocated_payments:', e1);
  if (e2) console.error('Error fetching payments (Unallocated):', e2);
  
  console.log('Unallocated Payments Table count:', unalloc_count);
  console.log('Unallocated Payments Data (sample 5):', JSON.stringify(unalloc_p?.slice(0, 5), null, 2));
  
  console.log('----------');
  console.log('Payments Table Unallocated count (status Unallocated):', p_unalloc_count);
  
  const { count: p_matched_no_loan_count } = await supabase.from('payments').select('*', { count: 'exact', head: true }).is('loan_id', null).eq('status', 'Allocated');
  console.log('Payments Table Matched to Customer but NO Loan (status Allocated):', p_matched_no_loan_count);
  
  console.log('----------');
  console.log('Total Payments in DB:', total_p);
  console.log('Total Loans in DB:', total_l);
}

check();
