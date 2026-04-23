const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/"/g, '');
});

const { createClient } = require('@supabase/supabase-js');

const Suurl = env.VITE_SUPABASE_URL;
const Sukey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(Suurl, Sukey);

const { SEED_WORKERS, SEED_CUSTOMERS, SEED_LOANS, SEED_PAYMENTS } = require('../src/data/seedData');

async function restore() {
  console.log('--- STARTING DATABASE RESTORATION ---');

  const tables = ['salary_payments', 'repossessed_assets', 'b2c_disbursements', 'interactions', 'payments', 'loans', 'customers', 'workers', 'audit_log'];
  
  for (const table of tables) {
    console.log(`Clearing ${table}...`);
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Hack to delete all
    if (error) console.error(`Error clearing ${table}:`, error.message);
  }

  // 2. Seed Workers
  console.log('Seeding Workers...');
  const workersPayload = SEED_WORKERS.map(w => ({
    id: w.id,
    name: w.name,
    email: w.email,
    role: w.role,
    status: w.status,
    phone: w.phone,
    joined: w.joined,
    password_hash: w.pwHash // Map to DB column name
  }));
  const { error: wError } = await supabase.from('workers').insert(workersPayload);
  if (wError) console.error('Error seeding workers:', wError.message);

  // 3. Seed Customers
  console.log('Seeding Customers...');
  const customersPayload = SEED_CUSTOMERS.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    id_no: c.idNo,
    business_name: c.business,
    location: c.location,
    onboarded_by: SEED_WORKERS.find(w => w.name === c.officer)?.id || null,
    risk: c.risk,
    joined: c.joined,
    gender: c.gender,
    blacklisted: c.blacklisted,
    bl_reason: c.blReason
  }));
  const { error: cError } = await supabase.from('customers').insert(customersPayload);
  if (cError) console.error('Error seeding customers:', cError.message);

  // 4. Seed Loans
  console.log('Seeding Loans...');
  const loansPayload = SEED_LOANS.map(l => ({
    id: l.id,
    customer_id: l.customerId,
    amount: l.amount,
    balance: l.balance,
    status: l.status,
    disbursed: l.disbursed,
    created_at: l.date,
    collections_officer: l.status === 'Overdue' ? 'W002' : null // Assign Sarah Kiprop (W002) to overdue loans
  }));
  const { error: lError } = await supabase.from('loans').insert(loansPayload);
  if (lError) console.error('Error seeding loans:', lError.message);

  // 5. Seed Payments
  console.log('Seeding Payments...');
  const paymentsPayload = SEED_PAYMENTS.map(p => ({
    id: p.id,
    loan_id: p.loanId,
    customer_id: p.customerId,
    amount: p.amount,
    date: p.date,
    status: 'Allocated',
    mpesa_receipt: p.mpesa
  }));
  const { error: pError } = await supabase.from('payments').insert(paymentsPayload);
  if (pError) console.error('Error seeding payments:', pError.message);

  // 6. Seed Sample Salary Payments
  console.log('Seeding Sample Salary Payments...');
  const salaryPayload = [
    { worker_id: 'W001', amount: 45000, month: '2026-04', mpesa_receipt: 'RQK12345', recipient_phone: '0712345001', status: 'Success', remarks: 'Base Salary + Commission' },
    { worker_id: 'W002', amount: 38000, month: '2026-04', mpesa_receipt: 'RQK12346', recipient_phone: '0712345002', status: 'Success', remarks: 'Portfolio Management Incentive' }
  ];
  await supabase.from('salary_payments').insert(salaryPayload);

  console.log('--- RESTORATION COMPLETE ---');
}

restore();
