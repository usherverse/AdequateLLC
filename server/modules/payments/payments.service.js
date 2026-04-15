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
  let matchConfidence = null; // 'billref' | 'phone' | 'name_exact' | 'name_suggestion'
  let suggestedCustomer = null; // Set when name partially matches — requires admin confirmation

  // 1. BillRefNumber match — highest confidence (exact DB lookup)
  if (BillRefNumber) {
    const ref = BillRefNumber.trim();
    const { data: loanMatch } = await supabase
      .from('loans')
      .select('id, customer_id')
      .eq('id', ref)
      .maybeSingle();
    
    if (loanMatch) {
      targetLoanId = loanMatch.id;
      const { data: cus } = await supabase.from('customers').select('id, name').eq('id', loanMatch.customer_id).single();
      if (cus) { matchedCustomer = cus; matchConfidence = 'billref'; console.log(`[C2B Allocation] ✅ HIGH-CONFIDENCE match by loan BillRefNumber: ${ref}`); }
    }
    
    if (!matchedCustomer) {
      const { data: cusMatch } = await supabase.from('customers').select('id, name').eq('id', ref).maybeSingle();
      if (cusMatch) { matchedCustomer = cusMatch; matchConfidence = 'billref'; console.log(`[C2B Allocation] ✅ HIGH-CONFIDENCE match by customer BillRefNumber: ${ref}`); }
    }
  }

  // 2. Phone match — high confidence (phone registered in our system)
  if (!matchedCustomer) {
    const phoneSuffix = MSISDN.toString().slice(-9);
    const { data: phoneMatch } = await supabase
      .from('customers')
      .select('id, name')
      .like('phone', `%${phoneSuffix}`)
      .limit(1)
      .maybeSingle();
    if (phoneMatch) { matchedCustomer = phoneMatch; matchConfidence = 'phone'; console.log(`[C2B Allocation] ✅ HIGH-CONFIDENCE match by phone suffix: ${phoneSuffix}`); }
  }

  // 3. Name matching — two tiers:
  //    score 100 (exact full name)  → auto-allocate
  //    score 80  (first + last hit) → suggestion only, requires admin confirmation
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

      if (highestScore === 100) {
        // Full exact match — safe to auto-allocate
        matchedCustomer = bestMatch;
        matchConfidence = 'name_exact';
        console.log(`[C2B Allocation] ✅ EXACT name match: "${bestMatch.name}"`);
      } else if (highestScore >= 80) {
        // Partial match — store as suggestion, DO NOT auto-allocate
        suggestedCustomer = bestMatch;
        matchConfidence = 'name_suggestion';
        console.warn(`[C2B Allocation] ⚠️  PARTIAL name match (score ${highestScore}): "${bestMatch.name}" — stored as suggestion, NOT auto-allocated.`);
      }
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

    // --- Atomically record payment + update loan balance via RPC ---
    // A single PostgreSQL transaction: if either step fails, both roll back.
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('apply_c2b_payment', {
      p_customer_id:   matchedCustomer.id,
      p_customer_name: matchedCustomer.name,
      p_loan_id:       activeLoan?.id || null,
      p_amount:        amount,
      p_mpesa_txid:    TransID,
      p_date:          new Date().toISOString().split('T')[0],
      p_note:          (activeLoan
        ? `Auto-allocated to loan ${activeLoan.id} `
        : 'Matched to customer but no active loan found ') + `from ${displayName} (${MSISDN})`
    });

    if (rpcErr) {
      console.error('[C2B Allocation] RPC error:', rpcErr.message);
      return { allocated: false, error: rpcErr.message };
    }

    if (!rpcResult?.success) {
      console.warn('[C2B Allocation] RPC returned failure:', rpcResult?.reason);
      if (rpcResult?.reason === 'duplicate_txid') {
        console.log(`[C2B Allocation] Duplicate TxID ${TransID} caught by RPC idempotency guard.`);
      }
      return { allocated: false, reason: rpcResult?.reason };
    }

    const newBal    = rpcResult.new_balance;
    const newStatus = rpcResult.new_status;
    console.log(
      activeLoan
        ? `[C2B Allocation] ✅ Loan ${activeLoan.id} balance: KES ${activeLoan.balance} → KES ${newBal} (${newStatus}) [ATOMIC]`
        : `[C2B Allocation] ✅ Payment recorded for customer ${matchedCustomer.id} — no active loan. [ATOMIC]`
    );

    // --- Cleanup deduplication ---
    // If this payment was previously in the unallocated_payments table, remove it now that it's matched
    const { error: delErr } = await supabase.from('unallocated_payments').delete().eq('transaction_id', TransID);
    if (!delErr) console.log(`[C2B Allocation] Cleaned up TxID ${TransID} from unallocated_payments table.`);

    // --- Audit Log ---
    const { error: auditErr } = await supabase.from('audit_log').insert([{
      user_name: 'System',
      action: 'C2B Payment Allocated',
      target_id: matchedCustomer.id,
      detail: `[${matchConfidence?.toUpperCase()}] M-Pesa C2B ${TransID} of KES ${amount} from ${displayName} (${MSISDN}) allocated to ${matchedCustomer.name}.${rpcResult?.loan_id ? ` Applied to loan ${rpcResult.loan_id}. New balance: KES ${rpcResult.new_balance}` : ''}`
    }]);
    if (auditErr) console.error('[C2B Allocation] Audit log error:', auditErr.message);
    else console.log(`[C2B Allocation] ✅ Audit log recorded for customer ${matchedCustomer.id}`);

    return { allocated: true, confidence: matchConfidence, customerId: matchedCustomer.id, loanId: rpcResult?.loan_id };
  } else {
    // --- Secondary Idempotency for Unallocated ---
    const { data: existingUnalloc } = await supabase.from('unallocated_payments').select('id').eq('transaction_id', TransID).maybeSingle();
    if (existingUnalloc) {
      console.log(`[C2B Allocation] Skipping TxID ${TransID}: already in unallocated_payments table.`);
      return;
    }

    // Store as unallocated — include suggestion if name partially matched
    console.warn(`[C2B Allocation] No confirmed match for ${displayName} (${MSISDN}). Saving as Unallocated${suggestedCustomer ? ` (suggested: ${suggestedCustomer.name})` : ''}.`);
    const { error: unallocErr } = await supabase.from('unallocated_payments').insert([{
      transaction_id:         TransID,
      amount,
      msisdn:                 MSISDN,
      first_name:             FirstName,
      last_name:              LastName,
      status:                 'Unallocated',
      suggested_customer_id:  suggestedCustomer?.id   || null,
      suggested_customer_name: suggestedCustomer?.name || null,
    }]);
    if (unallocErr) console.error('[C2B Allocation] Unallocated insert error:', unallocErr.message);

    await supabase.from('audit_log').insert([{
      user_name: 'System',
      action: suggestedCustomer ? 'C2B Payment — Suggested Match' : 'C2B Payment Unallocated',
      target_id: suggestedCustomer?.id || null,
      detail: suggestedCustomer
        ? `Partial name match for TxID ${TransID} of KES ${amount} from ${displayName} (${MSISDN}). Suggested customer: ${suggestedCustomer.name}. Requires admin confirmation.`
        : `Unmatched M-Pesa payment ${TransID} of KES ${amount} from ${displayName} (${MSISDN}). Stored for manual review.`
    }]);

    return { allocated: false, confidence: matchConfidence, suggestedCustomerId: suggestedCustomer?.id };
  }
};
