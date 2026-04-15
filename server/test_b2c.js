import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('b2c_disbursements').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('B2C Disbursements:', JSON.stringify(data, null, 2) || error);
}
check();
