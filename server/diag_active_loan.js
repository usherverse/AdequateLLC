/**
 * Diagnostic: Show raw loan + payment data for a customer 
 * showing "Account is clean" despite having an active loan.
 * Run: node server/diag_active_loan.js
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // bypass RLS
);

async function diag() {
  // Fetch ALL customers
  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .select('id, name, loans')
    .limit(10);

  if (cErr) { console.error('Customer fetch error:', cErr); return; }
  console.log('\n=== ALL CUSTOMERS (loans column) ===');
  customers.forEach(c => console.log(`  ${c.id} | ${c.name} | loans=${c.loans}`));

  // Fetch ALL loans
  const { data: loans, error: lErr } = await supabase
    .from('loans')
    .select('id, customer_id, amount, balance, status, disbursed, days_overdue')
    .limit(20);

  if (lErr) { console.error('Loan fetch error:', lErr); return; }
  console.log('\n=== ALL LOANS (raw DB) ===');
  if (!loans.length) {
    console.log('  !! NO loans found in DB !!');
  }
  loans.forEach(l => {
    console.log(`  ${l.id}`);
    console.log(`    customer_id : ${l.customer_id}`);
    console.log(`    amount      : ${l.amount}`);
    console.log(`    balance     : ${l.balance}`);
    console.log(`    status      : ${l.status}`);
    console.log(`    disbursed   : ${l.disbursed}`);  // <-- key: is this NULL?
    console.log(`    days_overdue: ${l.days_overdue}`);
  });

  // Fetch payments and check loan_id linkage
  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('id, customer_id, loan_id, amount, is_reg_fee, note')
    .limit(30);

  if (pErr) { console.error('Payments fetch error:', pErr); return; }
  console.log('\n=== PAYMENTS (raw DB) — checking loan_id linkage ===');
  if (!payments.length) {
    console.log('  (no payments found)');
  }
  payments.forEach(p => {
    console.log(`  ${p.id} | cust=${p.customer_id} | loan_id=${p.loan_id} | amount=${p.amount} | reg_fee=${p.is_reg_fee}`);
  });

  // Report: loans with no disbursed_at (these trigger isWrittenOff heuristic)
  const undated = loans.filter(l => !l.disbursed_at);
  if (undated.length) {
    console.log('\n⚠️  UNDATED LOANS (disbursed_at is NULL) — these get marked "Written off" by the engine:');
    undated.forEach(l => console.log(`    ${l.id} status=${l.status} amount=${l.amount}`));
  }
}

diag().catch(console.error);
