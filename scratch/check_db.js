import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/"/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: workers, error: wErr } = await supabase.from('workers').select('*');
  if (wErr) console.error('Worker Error:', wErr);
  console.log('WORKERS:', JSON.stringify(workers, null, 2));

  // Check RPC
  const { data: rpcCheck, error: rpcErr } = await supabase.rpc('create_worker', {
    p_name: 'Test', p_email: 'test@example.com', p_role: 'Loan Officer', p_phone: '123', p_avatar: 'T'
  });
  if (rpcErr) {
    console.log('RPC create_worker check failed (likely unauthorized or missing):', rpcErr.message);
  } else {
    console.log('RPC create_worker exists and is callable!');
  }

  const { data: customers } = await supabase.from('customers').select('*');
  console.log('CUSTOMERS COUNT:', customers ? customers.length : 0);

  const { data: loans } = await supabase.from('loans').select('*');
  console.log('LOANS COUNT:', loans ? loans.length : 0);
}

check();
