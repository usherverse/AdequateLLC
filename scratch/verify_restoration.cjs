
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/"/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log('--- VERIFYING RESTORED DATA INTEGRITY ---');

  // 1. Check counts
  const { count: workerCount } = await supabase.from('workers').select('*', { count: 'exact', head: true });
  const { count: customerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  const { count: loanCount } = await supabase.from('loans').select('*', { count: 'exact', head: true });
  const { count: paymentCount } = await supabase.from('payments').select('*', { count: 'exact', head: true });
  const { count: salaryCount } = await supabase.from('salary_payments').select('*', { count: 'exact', head: true });

  console.log(`Workers: ${workerCount}`);
  console.log(`Customers: ${customerCount}`);
  console.log(`Loans: ${loanCount}`);
  console.log(`Payments: ${paymentCount}`);
  console.log(`Salary Payments: ${salaryCount}`);

  // 2. Validate Collections Assignment
  const { data: overdueLoans } = await supabase.from('loans').select('id, collections_officer').eq('status', 'Overdue').limit(5);
  console.log('Sample Overdue Loans Assignment:', overdueLoans);

  const allAssigned = overdueLoans.every(l => l.collections_officer != null);
  console.log(`Collections Officer Matching: ${allAssigned ? 'PASSED' : 'FAILED'}`);

  // 3. Validate Salary Records
  const { data: salaries } = await supabase.from('salary_payments').select('*').limit(2);
  console.log('Sample Salary Records:', salaries);

  if (customerCount > 0 && loanCount > 0 && allAssigned) {
    console.log('--- INTEGRITY CHECK PASSED ---');
  } else {
    console.warn('--- INTEGRITY CHECK INCOMPLETE OR FAILED ---');
  }
}

verify();
