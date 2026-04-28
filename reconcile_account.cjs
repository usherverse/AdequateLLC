require('dotenv').config({ path: 'production.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findAndApply() {
  const accountNo = '29590263';
  console.log(`Searching for missing payments for account: ${accountNo}`);

  // 1. Search raw_mpesa_logs for the account number in the payload
  const { data: logs, error: logError } = await supabase
    .from('raw_mpesa_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (logError) {
    console.error("Error fetching logs:", logError);
    return;
  }

  const missingPayments = [];
  logs.forEach(log => {
    const payload = log.payload;
    if (JSON.stringify(payload).includes(accountNo)) {
      // Handle different payload formats
      const transId = payload.TransID || payload.reference || payload.transaction_id;
      const amount = parseFloat(payload.TransAmount || payload.amount || 0);
      
      if (transId && amount > 0) {
        missingPayments.push({
          transId: transId,
          amount: amount,
          date: payload.TransTime ? payload.TransTime.substring(0, 8) : log.created_at.split('T')[0],
          raw: payload
        });
      }
    }
  });

  console.log(`Found ${missingPayments.length} candidate transactions in raw logs.`);

  if (missingPayments.length === 0) return;

  // 2. Find the customer and their active loan
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .select('id, name')
    .or(`id_no.eq.${accountNo},account_number.eq.${accountNo}`)
    .maybeSingle();

  if (custError || !customer) {
    console.error("Customer not found for account:", accountNo, custError);
    return;
  }

  console.log(`Matched Customer: ${customer.name} (ID: ${customer.id})`);

  const { data: loan } = await supabase
    .from('loans')
    .select('id')
    .eq('customer_id', customer.id)
    .in('status', ['Active', 'Overdue'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const loanId = loan?.id || null;
  console.log(`Target Loan ID: ${loanId}`);

  // 3. Apply each missing payment if it doesn't already exist in the payments table
  for (const pay of missingPayments) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('mpesa', pay.transId)
      .maybeSingle();

    if (existing) {
      console.log(`Transaction ${pay.transId} already applied. Skipping.`);
      continue;
    }

    console.log(`Applying missing payment ${pay.transId} of KES ${pay.amount}...`);
    
    // Call the RPC to apply payment (which fires the trigger)
    const { data: result, error: applyError } = await supabase.rpc('apply_c2b_payment', {
      p_customer_id: customer.id,
      p_customer_name: customer.name,
      p_loan_id: loanId,
      p_amount: pay.amount,
      p_mpesa_txid: pay.transId,
      p_date: new Date().toISOString().split('T')[0],
      p_note: 'Manual Recovery (Post-Migration Fix)'
    });

    if (applyError) {
      console.error(`Failed to apply ${pay.transId}:`, applyError);
    } else {
      console.log(`Successfully applied ${pay.transId}. Result:`, result);
    }
  }
}

findAndApply();
