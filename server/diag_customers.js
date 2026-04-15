// Diagnostic: Check customers table schema and data quality
// Run with: node server/diag_customers.js

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('\n=== CUSTOMER DATA INTEGRITY DIAGNOSTIC ===\n');

  // 1. Check the column schema of the customers table (graceful fallback)
  let schemaData = null;
  try {
    const res = await supabase.rpc('get_customer_columns');
    schemaData = res.data;
  } catch (_) { /* RPC may not exist, skip */ }

  // 2. Fetch a sample of customers with SELECT * to see what columns exist
  const { data: sample, error: sampleErr } = await supabase
    .from('customers')
    .select('*')
    .limit(3);

  if (sampleErr) {
    console.error('FETCH ERROR:', sampleErr.message);
  } else if (sample?.length > 0) {
    console.log('✅ Columns available on customers table:');
    console.log('  ', Object.keys(sample[0]).join(', '));

    const hasJoined = 'joined' in sample[0];
    const hasCreatedAt = 'created_at' in sample[0];
    const hasN2 = 'n2_name' in sample[0];
    const hasN3 = 'n3_name' in sample[0];

    console.log('\n--- Column Presence Check ---');
    console.log(`  joined column:     ${hasJoined ? '✅ EXISTS' : '❌ MISSING — need to add it!'}`);
    console.log(`  created_at column: ${hasCreatedAt ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  n2_name column:    ${hasN2 ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  n3_name column:    ${hasN3 ? '✅ EXISTS' : '❌ MISSING'}`);
  }

  // 3. Count field-missing (blank) records across different fields
  const { count: total } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  const { count: noGender } = await supabase.from('customers').select('*', { count: 'exact', head: true }).is('gender', null);
  const { count: noBusinessName } = await supabase.from('customers').select('*', { count: 'exact', head: true }).is('business_name', null);
  const { count: noLocation } = await supabase.from('customers').select('*', { count: 'exact', head: true }).is('business_location', null);
  const { count: noN1 } = await supabase.from('customers').select('*', { count: 'exact', head: true }).is('n1_name', null);
  const { count: noN2 } = await supabase.from('customers').select('*', { count: 'exact', head: true }).is('n2_name', null);
  const { count: noResidence } = await supabase.from('customers').select('*', { count: 'exact', head: true }).is('residence', null);

  console.log('\n--- Data Completeness Report ---');
  console.log(`  Total customers:          ${total}`);
  console.log(`  Missing gender:           ${noGender} (${pct(noGender, total)}%)`);
  console.log(`  Missing business_name:    ${noBusinessName} (${pct(noBusinessName, total)}%)`);
  console.log(`  Missing business_location:${noLocation} (${pct(noLocation, total)}%)`);
  console.log(`  Missing residence:        ${noResidence} (${pct(noResidence, total)}%)`);
  console.log(`  Missing n1_name:          ${noN1} (${pct(noN1, total)}%)`);
  console.log(`  Missing n2_name:          ${noN2} (${pct(noN2, total)}%) ← expected if column was not fetched before this fix`);

  // 4. Check for synthesized "PENDING-" placeholder records
  const { data: pending } = await supabase.from('customers').select('id,name,id_no').like('id_no', 'PENDING-%').limit(20);
  if (pending?.length > 0) {
    console.log(`\n⚠️  Found ${pending.length} SYNTHESIZED placeholder records (id_no starts with PENDING-):`);
    pending.forEach(p => console.log(`   [${p.id}] ${p.name} — id_no: ${p.id_no}`));
    console.log('   → These are ghost records created from loan data when the full customer row was missing.');
    console.log('   → They should be merged with the real customer records and cleaned up.');
  } else {
    console.log('\n✅ No synthesized PENDING placeholder records found.');
  }

  console.log('\n=== DONE ===\n');
}

function pct(n, total) {
  if (!total) return '0';
  return Math.round((n / total) * 100);
}

run().catch(console.error);
