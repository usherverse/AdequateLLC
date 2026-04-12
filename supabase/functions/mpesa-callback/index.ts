import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const data = await req.json();
    console.log("[M-Pesa Edge] Callback Received:", JSON.stringify(data, null, 2));

    // Support both C2B Simulation/Real Callback and STK Push Callback formats
    let TransID, TransAmount, MSISDN, FirstName, MiddleName, LastName, BillRefNumber;

    if (data.Body?.stkCallback) {
      // STK Push Format
      const cb = data.Body.stkCallback;
      if (cb.ResultCode !== 0) return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Failure ignored" }));
      
      const items = cb.CallbackMetadata?.Item || [];
      TransID = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
      TransAmount = items.find((i: any) => i.Name === 'Amount')?.Value;
      MSISDN = String(items.find((i: any) => i.Name === 'PhoneNumber')?.Value);
      BillRefNumber = 'STK_PUSH'; // Usually not provided in STK
    } else {
      // Standard C2B Format
      ({ TransID, TransAmount, MSISDN, FirstName, MiddleName, LastName, BillRefNumber } = data);
    }

    if (!TransID) throw new Error("Missing TransID");

    const amount = parseFloat(String(TransAmount));
    const displayName = `${FirstName || ''} ${MiddleName || ''} ${LastName || ''}`.trim();
    const phone = String(MSISDN);

    // --- 0. Idempotency Check ---
    const { data: existing } = await supabase.from('payments').select('id').eq('mpesa', TransID).maybeSingle();
    if (existing) {
      console.log(`[M-Pesa Edge] Skipping duplicate TxID: ${TransID}`);
      await supabase.from('unallocated_payments').delete().eq('transaction_id', TransID);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Duplicate Ignored" }));
    }

    // --- 1. Matching Logic ---
    let matchedCustomer = null;
    let targetLoanId = null;

    // 1.1 Match by BillRefNumber
    if (BillRefNumber && BillRefNumber !== 'STK_PUSH') {
      const ref = String(BillRefNumber).trim();
      const { data: loanMatch } = await supabase.from('loans').select('id, customer_id').eq('id', ref).maybeSingle();
      if (loanMatch) {
        targetLoanId = loanMatch.id;
        const { data: cus } = await supabase.from('customers').select('id, name').eq('id', loanMatch.customer_id).single();
        if (cus) matchedCustomer = cus;
      }
      if (!matchedCustomer) {
        const { data: cusMatch } = await supabase.from('customers').select('id, name').eq('id', ref).maybeSingle();
        if (cusMatch) matchedCustomer = cusMatch;
      }
    }

    // 1.2 Match by Phone Suffix
    if (!matchedCustomer && MSISDN) {
      const phoneSuffix = String(MSISDN).slice(-9);
      const { data: phoneMatch } = await supabase.from('customers').select('id, name').like('phone', `%${phoneSuffix}`).limit(1).maybeSingle();
      if (phoneMatch) matchedCustomer = phoneMatch;
    }

    // 1.3 Match by Name (Fuzzy matching)
    if (!matchedCustomer && displayName) {
      const { data: allCus } = await supabase.from('customers').select('id, name');
      if (allCus) {
        const dName = displayName.toLowerCase();
        const match = allCus.find(c => {
          const cName = (c.name || '').toLowerCase();
          return cName === dName || (FirstName && cName.includes(FirstName.toLowerCase()) && LastName && cName.includes(LastName.toLowerCase()));
        });
        if (match) matchedCustomer = match;
      }
    }

    // --- 2. Allocation Logic ---
    if (matchedCustomer) {
      let activeLoan = null;
      if (targetLoanId) {
        const { data } = await supabase.from('loans').select('id, balance, status').eq('id', targetLoanId).maybeSingle();
        activeLoan = data;
      }
      if (!activeLoan) {
        const { data } = await supabase.from('loans').select('id, balance, status').eq('customer_id', matchedCustomer.id).eq('status', 'Active').order('created_at', { ascending: false }).limit(1).maybeSingle();
        activeLoan = data;
      }

      // Record in payments table
      const { error: payErr } = await supabase.from('payments').insert([{
        customer_id: matchedCustomer.id,
        loan_id: activeLoan?.id || null,
        customer_name: matchedCustomer.name,
        amount,
        mpesa: TransID,
        date: new Date().toISOString().split('T')[0],
        status: activeLoan ? 'Allocated' : 'Unallocated',
        allocated_by: activeLoan ? 'M-Pesa Edge Service' : null,
        allocated_at: activeLoan ? new Date().toISOString() : null,
        note: (activeLoan ? `Auto-allocated to loan ${activeLoan.id} ` : 'Matched to customer but no active loan found ') + `from ${displayName} (${phone})`
      }]);

      if (payErr) console.error("[M-Pesa Edge] Payment Insert Error:", payErr.message);

      // Update Loan Balance
      if (activeLoan) {
        const newBal = Math.max(0, parseFloat(activeLoan.balance) - amount);
        const newStatus = newBal <= 0 ? 'Settled' : activeLoan.status;
        await supabase.from('loans').update({ balance: newBal, status: newStatus }).eq('id', activeLoan.id);
      }

      // Cleanup unallocated
      await supabase.from('unallocated_payments').delete().eq('transaction_id', TransID);

      // Audit Log
      await supabase.from('audit_log').insert([{
        user_name: 'M-Pesa System',
        action: 'C2B Payment Allocated',
        target_id: matchedCustomer.id,
        detail: `Payment ${TransID} of KES ${amount} from ${displayName} (${phone}) allocated to ${matchedCustomer.name}.${activeLoan ? ` Applied to loan ${activeLoan.id}.` : ''}`
      }]);

    } else {
      // --- 3. Totally Unallocated ---
      const { data: existingUnalloc } = await supabase.from('unallocated_payments').select('id').eq('transaction_id', TransID).maybeSingle();
      if (!existingUnalloc) {
        await supabase.from('unallocated_payments').insert([{
          transaction_id: TransID,
          amount,
          msisdn: MSISDN,
          first_name: FirstName || 'Unknown',
          last_name: LastName || '',
          status: 'Unallocated'
        }]);
      }
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[M-Pesa Edge] Critical Error:", err.message);
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: err.message }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
