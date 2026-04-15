import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function find() {
  const { data: c1 } = await supabase.from('customers').select('*').ilike('name', '%Emmanuel%');
  const { data: c2 } = await supabase.from('customers').select('*').eq('phone', '254708374149');
  const { data: p1 } = await supabase.from('payments').select('*').or('customer_name.ilike.%Emmanuel%,mpesa.eq.RJ8BK3DHE6');
  const { data: p2 } = await supabase.from('unallocated_payments').select('*').eq('transaction_id', 'RJ8BK3DHE6');

  console.log('Customers with Emmanuel in name:', JSON.stringify(c1, null, 2));
  console.log('Customers with phone 254708374149:', JSON.stringify(c2, null, 2));
  console.log('Payments linked to Emmanuel or RJ8BK3DHE6:', JSON.stringify(p1, null, 2));
  console.log('Unallocated payment RJ8BK3DHE6:', JSON.stringify(p2, null, 2));
}

find();
