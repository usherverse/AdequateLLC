import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Searching for "Nazi" in customers table...');
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('name', '%Nazi%');
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Found:', JSON.stringify(data, null, 2));

  console.log('\nSearching for loans for "Nazi"...');
  const { data: loans, error: lErr } = await supabase
    .from('loans')
    .select('*')
    .ilike('customer', '%Nazi%');
  
  if (lErr) {
    console.error('Error loans:', lErr.message);
    return;
  }
  console.log('Loans found:', loans.length);
  loans.forEach(l => console.log(`  [${l.id}] ${l.customer} - Status: ${l.status} - Disbursed: ${l.disbursed}`));
}

run();
