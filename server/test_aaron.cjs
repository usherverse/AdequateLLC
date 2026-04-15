const { createClient } = require('@supabase/supabase-js');
require('node:fs');
require('node:path');

// Manually read .env
const envPath = require('path').resolve(__dirname, '../.env');
const env = require('fs').readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2];
  return acc;
}, {});
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function run() { 
  const {data} = await supabase.from('loans').select('id, amount, balance, status, disbursed, created_at').ilike('customer_name', '%Aaron Ndolo%'); 
  console.log('Loans:', data); 
  if(data && data.length) {
    const loanIds = data.map(l => l.id); 
    const {data: pData} = await supabase.from('payments').select('id, amount, loan_id, is_reg_fee, status').in('loan_id', loanIds); 
    console.log('Payments:', pData); 
  }
} 
run();
