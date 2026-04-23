
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { SEED_WORKERS, SEED_CUSTOMERS, SEED_LOANS, SEED_PAYMENTS } from '../src/data/seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/'/g, '').replace(/"/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function restore() {
  console.log('--- STARTING SCHEMA-CORRECTED RESTORATION ---');

  const tables = ['salary_payments', 'repossessed_assets', 'b2c_disbursements', 'interactions', 'payments', 'loans', 'customers', 'workers', 'audit_log'];
  
  for (const table of tables) {
    console.log(`Clearing ${table}...`);
    await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  console.log(`Seeding Workers...`);
  const workersPayload = SEED_WORKERS.map(w => ({
    id: w.id,
    name: w.name,
    email: w.email,
    role: w.role,
    status: w.status,
    phone: w.phone,
    id_no: w.idNo || 'ID-' + w.id,
    base_salary: 20000,
    onboarding_target: 60,
    collection_target: 500000
  }));
  const { error: wErr } = await supabase.from('workers').insert(workersPayload);
  if (wErr) console.error('Worker Seed Error:', wErr.message);

  const idNos = new Set();
  const customersPayload = SEED_CUSTOMERS.filter(c => {
    if (idNos.has(c.idNo)) return false;
    idNos.add(c.idNo);
    return true;
  }).map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    id_no: c.idNo,
    business_name: c.business,
    business_location: c.location,
    assigned_officer: SEED_WORKERS.find(w => w.name === c.officer)?.id || null,
    risk: c.risk,
    joined: c.joined,
    gender: c.gender,
    blacklisted: c.blacklisted || false,
    bl_reason: c.blReason || null
  }));
  const { error: cErr } = await supabase.from('customers').insert(customersPayload);
  if (cErr) console.error('Customer Seed Error:', cErr.message);

  console.log(`Seeding Loans...`);
  const loansPayload = SEED_LOANS.map(l => ({
    id: l.id,
    customer_id: l.customerId,
    customer_name: SEED_CUSTOMERS.find(c => c.id === l.customerId)?.name || 'Unknown',
    amount: l.amount,
    balance: l.balance,
    status: l.status,
    repayment_type: 'Daily', // Required not-null
    disbursed: l.disbursed || l.date,
    officer: SEED_CUSTOMERS.find(c => c.id === l.customerId)?.officer || 'Admin',
    collections_officer: l.status === 'Overdue' ? 'W002' : null,
    days_overdue: l.daysOverdue || 0,
    risk: SEED_CUSTOMERS.find(c => c.id === l.customerId)?.risk || 'Medium'
  }));
  const { error: lErr } = await supabase.from('loans').insert(loansPayload);
  if (lErr) console.error('Loan Seed Error:', lErr.message);

  console.log(`Seeding Payments...`);
  const paymentsPayload = SEED_PAYMENTS.map(p => ({
    id: p.id,
    loan_id: p.loanId,
    customer_id: p.customerId,
    customer_name: SEED_CUSTOMERS.find(c => c.id === p.customerId)?.name || 'Unknown',
    amount: p.amount,
    date: p.date,
    status: 'Allocated',
    mpesa: p.mpesa,
    allocated_by: 'Admin'
  }));
  const { error: pErr } = await supabase.from('payments').insert(paymentsPayload);
  if (pErr) console.error('Payment Seed Error:', pErr.message);

  console.log('Seeding Salary Payments...');
  const salaryPayload = [
    { worker_id: 'W001', amount: 45000, month: '2026-04', mpesa_receipt: 'RQK12345', recipient_phone: '0712345001', status: 'Success', remarks: 'Base Salary + Commission' },
    { worker_id: 'W002', amount: 38000, month: '2026-04', mpesa_receipt: 'RQK12346', recipient_phone: '0712345002', status: 'Success', remarks: 'Portfolio Management Incentive' }
  ];
  await supabase.from('salary_payments').insert(salaryPayload);

  console.log('--- RESTORATION COMPLETE ---');
}

restore();
