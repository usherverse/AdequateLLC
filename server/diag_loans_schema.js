// Diagnostic: Check loans table schema
// Run with: node server/diag_loans_schema.js

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('\n=== LOANS TABLE SCHEMA DIAGNOSTIC ===\n');

  // First insert a minimal dummy loan to see what columns are available
  const { data: sample, error } = await supabase
    .from('loans')
    .select('*')
    .limit(1);

  if (error && error.code !== 'PGRST116') {
    console.error('Fetch error:', error);
  } else if (sample?.length > 0) {
    console.log('✅ Columns available on loans table:');
    console.log('  ', Object.keys(sample[0]).join(', '));
  } else {
    console.log('⚠️  Loans table is empty - cannot detect columns from data.');
    console.log('   Attempting INSERT of a probe row to detect schema...\n');

    const probe = {
      id: '__PROBE__',
      customer_id: 'CUS-0001',
      customer_name: 'Test',
      customer_phone: '0700000000',
      amount: 1000,
      disbursed: null,
      duration: 12,
      type: 'Business',
      frequency: 'Monthly',
      interest: 20,
      balance: 1000,
      status: 'Draft',
      assigned_officer: null,
      collections_officer: null,
      days_overdue: 0,
      notes: null,
      mpesa_code: null,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase.from('loans').insert(probe).select('*');
    if (insertErr) {
      console.error('Insert failed:', insertErr.message);
    } else {
      console.log('✅ Columns available on loans table (after probe insert):');
      console.log('  ', Object.keys(inserted[0]).join(', '));
      // Clean up the probe row
      await supabase.from('loans').delete().eq('id', '__PROBE__');
      console.log('\n  (Probe row cleaned up)');
    }
  }

  console.log('\n=== DONE ===\n');
}

run().catch(console.error);
