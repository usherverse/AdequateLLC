import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

async function debug() {
  console.log('=== RECENT AUDIT LOGS ===');
  const logs = await query('audit_log', 'order=ts.desc&limit=5');
  console.log(JSON.stringify(logs, null, 2));

  console.log('\n=== RECENT PAYMENTS ===');
  const payments = await query('payments', 'order=created_at.desc&limit=5&select=id,customer_id,amount,mpesa,status,note,created_at');
  console.log(JSON.stringify(payments, null, 2));

  console.log('\n=== UNALLOCATED PAYMENTS ===');
  const unalloc = await query('unallocated_payments', 'order=created_at.desc&limit=5');
  console.log(JSON.stringify(unalloc, null, 2));

  console.log('\n=== ACTIVE LOANS ===');
  const loans = await query('loans', "status=neq.Completed&status=neq.Written Off&order=created_at.desc&limit=5&select=id,customer_id,amount,balance,status");
  console.log(JSON.stringify(loans, null, 2));
}

debug().catch(console.error);
