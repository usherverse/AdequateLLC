import { supabase } from '../../config/db.js';
import * as MpesaClient from './mpesa.client.js';

export const isEligibleToBorrow = async (customerId) => {
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) return { eligible: false, reason: 'Customer not found' };

  if (!customer.id_no || !customer.phone) {
    return { eligible: false, reason: 'Registration incomplete: missing ID or Phone' };
  }

  if (!customer.mpesa_registered) {
    return { eligible: false, reason: 'Registration fee not paid (KES 1 required)' };
  }

  if (customer.blacklisted) {
    return { eligible: false, reason: `Customer blacklisted: ${customer.bl_reason}` };
  }

  const { data: activeLoans } = await supabase
    .from('loans')
    .select('id, status')
    .eq('customer_id', customerId)
    .eq('status', 'Overdue');
  
  if (activeLoans && activeLoans.length > 0) {
    return { eligible: false, reason: 'Customer has active defaulted loans' };
  }

  return { eligible: true };
};

export const triggerRegistrationStkPush = async (customerId, phone) => {
  // Hardcoded 500 KES fee for registration
  const result = await MpesaClient.stkPush(phone, 1, customerId, 'Registration Fee');
  
  if (result.ResponseCode === '0') {
    await supabase.from('stk_requests').insert([{
      merchant_request_id: result.MerchantRequestID,
      checkout_request_id: result.CheckoutRequestID,
      phone_number: phone,
      amount: 1,
      reference: customerId,
      description: 'Registration Fee',
      status: 'Pending'
    }]);
  }
  return result;
};

export const disburseLoan = async (loanId, adminId, customPhone = null) => {
  // 1. Simple fetch for the loan first
  const { data: loan, error: loanErr } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single();

  if (loanErr || !loan) {
    console.error(`[Disbursement Error] Loan ${loanId} not found:`, loanErr?.message || 'No record');
    throw new Error(`Loan not found: ${loanErr?.message || 'Database returned no record'}`);
  }
  if (loan.status !== 'Approved') throw new Error(`Loan status is ${loan.status}, not Approved`);

  // 2. Fetch customer to check registration status
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('phone, mpesa_registered')
    .eq('id', loan.customer_id)
    .single();

  if (custErr || !customer) throw new Error('Customer record not found');

  // 3. Ensure registration fee is verified
  // We check the mpesa_registered flag which is updated by the M-Pesa webhook
  if (!customer.mpesa_registered) {
    throw new Error('Registration fee not verified for this customer');
  }

  // 4. Ensure no pending disbursement (Only block if truly in-flight or done)
  const { data: existing } = await supabase
    .from('b2c_disbursements')
    .select('status')
    .eq('loan_id', loanId)
    .in('status', ['Pending', 'Completed'])
    .maybeSingle();

  // If there's a failed attempt, we allow a retry. 
  // If no record exists, or it's 'Failed', we proceed.
  if (existing && existing.status !== 'Failed') {
    throw new Error(`Disbursement already ${existing.status.toLowerCase()}. Verify with M-Pesa before retrying.`);
  }

  const amount = loan.amount;
  // Prioritize selection -> loan record -> customer records
  const phone = customPhone || loan.phone || (customer && customer.phone);
  
  if (!phone) throw new Error('Customer phone missing');
  if (amount > 150000) throw new Error('Amount exceeds B2C daily limit of KES 150,000');

  const result = await MpesaClient.b2cDisbursement(phone, amount, `Loan ${loanId}`, `Disbursement for ${loanId}`);

  if (result.ResponseCode === '0') {
    // 5. Insert into b2c_disbursements table (matching your migration)
    const { error: insertErr } = await supabase.from('b2c_disbursements').insert([
      {
        loan_id: loanId,
        customer_id: loan.customer_id,
        amount: amount,
        phone_number: phone,
        conversation_id: result.ConversationID,
        originator_conversation_id: result.OriginatorConversationID,
        status: 'Pending'
      }
    ]);
    
    if (insertErr) {
      console.error('Database Insert Error:', insertErr);
      throw new Error(`Internal B2C Recording Database Error: ${insertErr.message}`);
    }
    
    // Root Cause Fix: Record the date immediately so the system doesn't treat this as an "undated" dead loan
    await supabase.from('loans').update({ 
      status: 'Disbursing',
      disbursed: new Date().toISOString().split('T')[0]
    }).eq('id', loanId);
  }
  return result;
};

// --- Payment Allocation Engine ---
export const allocatePaymentEngine = async (mpesaCallbackData) => {
  const { TransID, TransAmount, TransTime, MSISDN, FirstName, MiddleName, LastName, BillRefNumber } = mpesaCallbackData;
  const amount = parseFloat(TransAmount);
  
  const firstName = (FirstName || '').trim().toLowerCase();
  const lastName = (LastName || '').trim().toLowerCase();
  const rawSenderName = `${FirstName || ''} ${MiddleName || ''} ${LastName || ''}`.trim().toLowerCase();
  const displayName = `${FirstName || ''} ${MiddleName || ''} ${LastName || ''}`.trim();

  console.log(`[C2B Allocation] TxID: ${TransID}, Amount: ${amount}, From: ${displayName} (${MSISDN}), Ref: ${BillRefNumber}`);

  // --- 0. Idempotency Check ---
  // If already in ledger, we are done
  const { data: existingLedger } = await supabase.from('payments').select('id').eq('mpesa', TransID).maybeSingle();
  if (existingLedger) {
    console.log(`[C2B Allocation] Skipping TxID ${TransID}: already in payments table.`);
    // Cleanup unallocated just in case a previous attempt landed there
    await supabase.from('unallocated_payments').delete().eq('transaction_id', TransID);
    return;
  }

  let matchedCustomer = null;

  let targetLoanId = null;

  // 1. Try matching by BillRefNumber (customer ID or loan ID in payment reference)
  if (BillRefNumber) {
    const ref = BillRefNumber.trim();
    // Check if it's a loan ID
    const { data: loanMatch } = await supabase
      .from('loans')
      .select('id, customer_id')
      .eq('id', ref)
      .maybeSingle();
    
    if (loanMatch) {
      targetLoanId = loanMatch.id;
      const { data: cus } = await supabase.from('customers').select('id, name').eq('id', loanMatch.customer_id).single();
      if (cus) { matchedCustomer = cus; console.log(`[C2B Allocation] Matched by loan BillRefNumber: ${ref}`); }
    }
    
    // Check if it's a customer ID
    if (!matchedCustomer) {
      const { data: cusMatch } = await supabase.from('customers').select('id, name').eq('id', ref).maybeSingle();
      if (cusMatch) { matchedCustomer = cusMatch; console.log(`[C2B Allocation] Matched by customer BillRefNumber: ${ref}`); }
    }
  }

  // 2. Try exact phone match
  if (!matchedCustomer) {
    const phoneSuffix = MSISDN.toString().slice(-9);
    const { data: phoneMatch } = await supabase
      .from('customers')
      .select('id, name')
      .like('phone', `%${phoneSuffix}`)
      .limit(1)
      .maybeSingle();
    if (phoneMatch) { matchedCustomer = phoneMatch; console.log(`[C2B Allocation] Matched by phone suffix: ${phoneSuffix}`); }
  }

  // 3. Try name matching
  if (!matchedCustomer && rawSenderName) {
    const { data: allCustomers } = await supabase.from('customers').select('id, name');
    if (allCustomers) {
      let bestMatch = null;
      let highestScore = 0;
      for (const cus of allCustomers) {
        const cusName = (cus.name || '').toLowerCase().trim();
        let score = 0;
        if (cusName === rawSenderName) score = 100;
        else if (firstName && lastName && cusName.includes(firstName) && cusName.includes(lastName)) score = 80;
        else if (firstName && cusName.includes(firstName)) score = 50;
        if (score > highestScore) { highestScore = score; bestMatch = cus; }
      }
      if (highestScore >= 80) { matchedCustomer = bestMatch; console.log(`[C2B Allocation] Matched by name (score ${highestScore}): ${bestMatch.name}`); }
    }
  }

  if (matchedCustomer) {
    // --- Find the most recent Active loan to apply payment against ---
    // If we didn't get one from BillRefNumber, fetch the latest Active one
    let activeLoan = null;
    if (targetLoanId) {
      const { data } = await supabase.from('loans').select('id, balance, status').eq('id', targetLoanId).maybeSingle();
      activeLoan = data;
    }

    if (!activeLoan) {
      const { data, error: loanErr } = await supabase
        .from('loans')
        .select('id, balance, status')
        .eq('customer_id', matchedCustomer.id)
        .eq('status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (loanErr) console.error('[C2B Allocation] Loan fetch error:', loanErr.message);
      activeLoan = data;
    }

    // --- Record in payments table ---
    const { error: payErr } = await supabase.from('payments').insert([{
      customer_id: matchedCustomer.id,
      loan_id: activeLoan?.id || null, // LINK TO LOAN
      customer_name: matchedCustomer.name,
      amount,
      mpesa: TransID,
      date: new Date().toISOString().split('T')[0],
      status: activeLoan ? 'Allocated' : 'Unallocated',
      allocated_by: activeLoan ? 'System Engine' : null,
      allocated_at: activeLoan ? new Date().toISOString() : null,
      note: (activeLoan ? `Auto-allocated to loan ${activeLoan.id} ` : 'Matched to customer but no active loan found ') + `from ${displayName} (${MSISDN})`
    }]);
    if (payErr) console.error('[C2B Allocation] Payment insert error:', payErr.message);

    if (activeLoan) {
      const newBal = Math.max(0, parseFloat(activeLoan.balance) - amount);
      const newStatus = newBal <= 0 ? 'Settled' : activeLoan.status;
      const { error: loanUpdateErr } = await supabase
        .from('loans')
        .update({ balance: newBal, status: newStatus })
        .eq('id', activeLoan.id);
      if (loanUpdateErr) console.error('[C2B Allocation] Loan update error:', loanUpdateErr.message);
      if (loanUpdateErr) console.error('[C2B Allocation] Loan update error:', loanUpdateErr.message);
      else console.log(`[C2B Allocation] Loan ${activeLoan.id} balance updated: KES ${activeLoan.balance} → KES ${newBal} (${newStatus})`);
    } else {
      console.log(`[C2B Allocation] No active loan found for customer ${matchedCustomer.id}. Payment recorded as generic customer payment.`);
    }

    // --- Cleanup deduplication ---
    // If this payment was previously in the unallocated_payments table, remove it now that it's matched
    const { error: delErr } = await supabase.from('unallocated_payments').delete().eq('transaction_id', TransID);
    if (!delErr) console.log(`[C2B Allocation] Cleaned up TxID ${TransID} from unallocated_payments table.`);

    // --- Audit Log ---
    const { error: auditErr } = await supabase.from('audit_log').insert([{
      user_name: 'System',
      action: 'C2B Payment Allocated',
      target_id: matchedCustomer.id,
      detail: `M-Pesa C2B payment ${TransID} of KES ${amount} from ${displayName} (${MSISDN}) allocated to ${matchedCustomer.name}.${activeLoan ? ` Applied to loan ${activeLoan.id}. New balance: KES ${Math.max(0, parseFloat(activeLoan.balance) - amount)}` : ''}`
    }]);
    if (auditErr) console.error('[C2B Allocation] Audit log error:', auditErr.message);
    else console.log(`[C2B Allocation] ✅ Audit log recorded for customer ${matchedCustomer.id}`);

    return { allocated: true, customerId: matchedCustomer.id, loanId: activeLoan?.id };
  } else {
    // --- 0. Secondary Idempotency for Unallocated ---
    const { data: existingUnalloc } = await supabase.from('unallocated_payments').select('id').eq('transaction_id', TransID).maybeSingle();
    if (existingUnalloc) {
      console.log(`[C2B Allocation] Skipping TxID ${TransID}: already in unallocated_payments table.`);
      return;
    }

    // --- Unallocated ---
    console.warn(`[C2B Allocation] No customer match found for ${displayName} (${MSISDN}). Saving as Unallocated.`);
    const { error: unallocErr } = await supabase.from('unallocated_payments').insert([{
      transaction_id: TransID,
      amount,
      msisdn: MSISDN,
      first_name: FirstName,
      last_name: LastName,
      status: 'Unallocated'
    }]);
    if (unallocErr) console.error('[C2B Allocation] Unallocated insert error:', unallocErr.message);

    await supabase.from('audit_log').insert([{
      user_name: 'System',
      action: 'C2B Payment Unallocated',
      target_id: null,
      detail: `Unmatched M-Pesa payment ${TransID} of KES ${amount} from ${displayName} (${MSISDN}). Stored for manual review.`
    }]);

    return { allocated: false };
  }
};
