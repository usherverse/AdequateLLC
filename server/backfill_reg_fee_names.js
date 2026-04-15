/**
 * backfill_reg_fee_names.js
 * 
 * One-off script to backfill missing customer_name on registration fee
 * payments that were inserted by the STK webhook before the fix.
 * 
 * Run: node server/backfill_reg_fee_names.js
 */
import { supabase } from './config/db.js';

const run = async () => {
  console.log('[Backfill] Fetching reg fee payments with missing customer_name...');

  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, customer_id')
    .eq('is_reg_fee', true)
    .is('customer_name', null);

  if (error) {
    console.error('[Backfill] Failed to fetch payments:', error.message);
    process.exit(1);
  }

  if (!payments || payments.length === 0) {
    console.log('[Backfill] ✅ No payments to backfill — all reg fee payments already have a name.');
    process.exit(0);
  }

  console.log(`[Backfill] Found ${payments.length} payment(s) to backfill.`);

  let updated = 0;
  let failed = 0;

  for (const payment of payments) {
    if (!payment.customer_id) {
      console.warn(`[Backfill] Payment ${payment.id} has no customer_id — skipping.`);
      failed++;
      continue;
    }

    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('name')
      .eq('id', payment.customer_id)
      .single();

    if (custErr || !customer) {
      console.warn(`[Backfill] Could not find customer for payment ${payment.id} (customer_id: ${payment.customer_id}).`);
      failed++;
      continue;
    }

    const { error: updateErr } = await supabase
      .from('payments')
      .update({ customer_name: customer.name })
      .eq('id', payment.id);

    if (updateErr) {
      console.error(`[Backfill] Failed to update payment ${payment.id}:`, updateErr.message);
      failed++;
    } else {
      console.log(`[Backfill] ✅ Updated payment ${payment.id} → "${customer.name}"`);
      updated++;
    }
  }

  console.log(`\n[Backfill] Done. Updated: ${updated}, Failed: ${failed}`);
};

run();
