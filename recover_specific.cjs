require('dotenv').config({ path: 'production.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findSpecific() {
  const txId = 'UDRMB1ZMYQ';
  const accountNo = '29590263';
  console.log(`Searching for transaction: ${txId}`);

  const { data: logs, error } = await supabase
    .from('raw_mpesa_logs')
    .select('*');

  if (error) { console.error(error); return; }

  const match = logs.find(l => JSON.stringify(l.payload).includes(txId));
  
  if (match) {
    console.log("Found transaction in raw logs!");
    const p = match.payload;
    const amount = parseFloat(p.TransAmount || p.Amount || 0);
    
    if (isNaN(amount) || amount <= 0) {
      console.log("Invalid amount in payload:", p.TransAmount);
      return;
    }
    // Find customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name')
      .or(`id_no.eq.${accountNo},account_number.eq.${accountNo}`)
      .maybeSingle();

    if (!customer) { console.log("Customer not found"); return; }
    
    // Find loan
    const { data: loan } = await supabase
      .from('loans')
      .select('id')
      .eq('customer_id', customer.id)
      .in('status', ['Active', 'Overdue'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log(`Applying KES ${amount} to ${customer.name} for loan ${loan?.id}`);

    const { data: res, error: e } = await supabase.rpc('apply_c2b_payment', {
      p_customer_id: customer.id,
      p_customer_name: customer.name,
      p_loan_id: loan?.id || null,
      p_amount: amount,
      p_mpesa_txid: txId,
      p_date: new Date().toISOString().split('T')[0],
      p_note: 'Manual Recovery of UDRMB1ZMYQ'
    });

    if (e) console.error("Apply error:", e);
    else console.log("Success:", res);

  } else {
    console.log("Transaction ID not found in raw_mpesa_logs.");
  }
}

findSpecific();
