/**
 * One-time fix: marks all KES 500 "Unallocated" payments as is_reg_fee=true
 * and sets mpesa_registered=true on the matching customers.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bgcnenjnrnicsmnyvqhq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY25lbmpucm5pY3Ntbnl2cWhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM5NzQ0MCwiZXhwIjoyMDkwOTczNDQwfQ.v7Gw8Sfx81NdFxaW-QBS0O7iOcaFql5j4hW0De2bKJE'
);

async function fix() {
  // 1. Find all payments that look like registration fees but aren't flagged
  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('id, customer_id, amount, note')
    .gte('amount', 499).lte('amount', 501); // KES 500 range

  if (pErr) { console.error('fetch payments error:', pErr.message); return; }
  console.log(`Found ${payments.length} payments in the KES 500 range.`);

  const customerIds = new Set();

  for (const p of payments) {
    // Mark payment as reg fee
    const { error: upErr } = await supabase
      .from('payments')
      .update({ is_reg_fee: true, status: 'Allocated', note: p.note?.includes('Registration') ? p.note : 'Registration Fee — Manual' })
      .eq('id', p.id);
    if (upErr) console.error(`  Payment ${p.id} update failed:`, upErr.message);
    else console.log(`  ✓ Payment ${p.id} (KES ${p.amount}) → is_reg_fee=true`);
    
    if (p.customer_id) customerIds.add(p.customer_id);
  }

  // 2. Set mpesa_registered=true for all affected customers
  for (const cid of customerIds) {
    const { error: cErr } = await supabase
      .from('customers')
      .update({ mpesa_registered: true })
      .eq('id', cid);
    if (cErr) console.error(`  Customer ${cid} update failed:`, cErr.message);
    else console.log(`  ✓ Customer ${cid} → mpesa_registered=true`);
  }

  console.log('\nDone. Reload the app to see changes.');
  process.exit(0);
}

fix();
