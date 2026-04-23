import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { SEED_CUSTOMERS, SEED_LOANS, SEED_PAYMENTS, SEED_INTERACTIONS, SEED_WORKERS } from '../src/data/seedData.js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL ERROR: Supabase credentials missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- SAFETY GATE ---
const IS_PROD = supabaseUrl.includes('supabase.co'); // Basic heuristic for cloud vs local
const ALLOW_SEED = process.env.ALLOW_PRODUCTION_SEED === 'true';

if (IS_PROD && !ALLOW_SEED) {
  console.error('\n' + '!'.repeat(60));
  console.error('SAFETY BLOCK: You are attempting to seed a PRODUCTION database.');
  console.error('This action will overwrite existing records.');
  console.error('To proceed, set ALLOW_PRODUCTION_SEED=true in your .env file.');
  console.error('!'.repeat(60) + '\n');
  process.exit(1);
}


const toSupabaseCustomer = (c) => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  alt_phone: c.altPhone || null,
  id_no: c.idNo || null,
  business_name: c.businessName || c.business || null,
  business_type: c.businessType || null,
  business_location: c.businessLocation || c.location || null,
  gps_coordinates: c.gps || null,
  residence: c.residence || null,
  assigned_officer: c.officer || null,
  loans: c.loans || 0,
  risk: c.risk || 'Medium',
  gender: c.gender || null,
  dob: c.dob || null,
  status: c.blacklisted ? 'Blacklisted' : c.status || 'Active',
  bl_reason: c.blReason || null,
  from_lead: c.fromLead || null,
  mpesa_registered: !!c.mpesaRegistered,
  n1_name: c.n1n || null,
  n1_phone: c.n1p || null,
  n1_relation: c.n1r || null,
  n2_name: c.n2n || null,
  n2_phone: c.n2p || null,
  n2_relation: c.n2r || null,
  n3_name: c.n3n || null,
  n3_phone: c.n3p || null,
  n3_relation: c.n3r || null,
  joined: c.joined || null,
  created_at: c.createdAt || new Date().toISOString(),
  updated_at: new Date().toISOString(),
  documents: c.docs || null
});

// Actual loans columns: id, customer_id, customer_name, amount, balance, status,
// repayment_type, officer, risk, disbursed, mpesa, phone, days_overdue,
// created_at, updated_at, assigned_officer, officer_id, collections_officer
const toSupabaseLoan = (l) => ({
  id: l.id,
  customer_id: l.customerId,
  customer_name: l.customer,
  phone: l.phone || null,
  amount: l.amount,
  disbursed: l.disbursed || null,
  repayment_type: l.frequency || l.repaymentType || 'Weekly',
  balance: l.balance,
  status: l.status,
  risk: l.risk || 'Medium',
  officer: l.officer || null,
  assigned_officer: l.officer || null,
  collections_officer: l.collectionsOfficer || null,
  days_overdue: l.daysOverdue || 0,
  mpesa: l.mpesaCode || l.mpesa || null,
  created_at: l.createdAt || new Date().toISOString(),
});

// Actual payments columns: id, loan_id, customer_id, customer_name, amount, mpesa,
// date, status, allocated_by, allocated_at, note, is_reg_fee, created_at
const toSupabasePayment = (p) => ({
  id: p.id,
  loan_id: p.loanId || null,
  customer_id: p.customerId || null,
  customer_name: p.customer || null,
  amount: p.amount,
  mpesa: p.mpesa || null,
  date: p.date || null,
  status: p.status || 'Unallocated',
  allocated_by: p.allocatedBy || null,
  note: p.note || null,
  is_reg_fee: p.isRegFee || false,
});


const toSupabaseWorker = (w) => ({
  id: w.id,
  name: w.name,
  email: w.email,
  phone: w.phone,
  role: w.role,
  status: w.status,
  joined: w.joined,
  avatar: w.avatar,
  documents: w.docs || [],
  pw_hash: w.pwHash
});

async function runSeed() {
  console.log('Starting seed process...');
  
  // 2. Insert customers
  console.log(`Seeding ${SEED_CUSTOMERS.length} customers...`);
  
  // Ensure unique id_no
  const usedIdNos = new Set();
  const customersToInsert = SEED_CUSTOMERS.map((c, idx) => {
    const sc = toSupabaseCustomer(c);
    if (sc.id_no) {
       if (usedIdNos.has(sc.id_no)) {
          sc.id_no = sc.id_no + '-' + idx;
       }
       usedIdNos.add(sc.id_no);
    }
    return sc;
  });

  for (let i = 0; i < customersToInsert.length; i += 100) {
      const batch = customersToInsert.slice(i, i + 100);
      const { error } = await supabase.from('customers').upsert(batch);
      if (error) console.error('Error inserting customers:', error);
  }

  console.log(`Seeding ${SEED_LOANS.length} loans...`);
  for (let i = 0; i < SEED_LOANS.length; i += 100) {
      const batch = SEED_LOANS.slice(i, i + 100).map(toSupabaseLoan);
      const { error } = await supabase.from('loans').upsert(batch);
      if (error) console.error('Error inserting loans:', error);
  }
  
  console.log(`Seeding ${SEED_PAYMENTS.length} payments...`);
  for (let i = 0; i < SEED_PAYMENTS.length; i += 100) {
      const batch = SEED_PAYMENTS.slice(i, i + 100).map(toSupabasePayment);
      const { error } = await supabase.from('payments').upsert(batch);
      if (error) console.error('Error inserting payments:', error);
  }

  console.log('Seed completed.');
}

runSeed();
