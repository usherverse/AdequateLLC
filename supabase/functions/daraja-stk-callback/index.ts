import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * PRODUCTION-READY M-PESA STK CALLBACK HANDLER (Unified)
 * This function is now "Trigger-Driven". It logs the payment 
 * and lets the Database Master Trigger handle the financial math.
 */

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response("Method Not Allowed", { status: 405 });

  try {
    const payload = await req.json();
    console.log("[M-Pesa Edge] Callback Raw:", JSON.stringify(payload));

    const cb = payload.Body?.stkCallback;
    if (!cb) throw new Error("Invalid STK Callback payload");

    const checkoutId = cb.CheckoutRequestID;
    console.log(`[M-Pesa Edge] Processing Callback for: ${checkoutId}`);

    // 1. IMMEDIATE DIAGNOSTIC UPDATE: Mark as 'Processing' so we know the callback reached us
    await supabase.from('stk_requests').update({ 
        status: 'Processing',
        result_desc: `Callback received at ${new Date().toISOString()}`
    }).eq('checkout_request_id', checkoutId);

    // 2. Handle Failures (User cancelled, Timeout, etc.)
    if (cb.ResultCode !== 0) {
      console.warn(`[M-Pesa Edge] STK Failed: ${cb.ResultDesc} (${cb.ResultCode})`);
      await supabase.from('stk_requests').update({ 
        status: 'Failed', 
        result_code: cb.ResultCode, 
        result_desc: cb.ResultDesc 
      }).eq('checkout_request_id', checkoutId);
      
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Failure Acknowledged" }));
    }

    // 3. Extract Success Data
    const meta = cb.CallbackMetadata?.Item || [];
    const mpesaReceipt = meta.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
    const amount = parseFloat(meta.find((i: any) => i.Name === 'Amount')?.Value);
    const phone = meta.find((i: any) => i.Name === 'PhoneNumber')?.Value;

    // 4. Match and Update Request in DB
    const { data: request, error: reqErr } = await supabase
      .from('stk_requests')
      .update({ 
        status: 'Completed', 
        mpesa_receipt: mpesaReceipt, 
        result_code: 0,
        result_desc: 'Success'
      })
      .eq('checkout_request_id', checkoutId)
      .select()
      .maybeSingle();

    if (!request || reqErr) {
        console.error("[M-Pesa Edge] STK Request record NOT FOUND for CheckoutRequestID:", checkoutId);
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Orphaned Success Logged" }));
    }

    // 5. Fetch Customer Details for Ledger Consistency
    const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('id', request.reference)
        .maybeSingle();

    const customerName = customer?.name || 'Unknown Customer';
    const todayStr = new Date().toISOString().split('T')[0];

    console.log(`[M-Pesa Edge] matched request: ${request.id}, reference: ${request.reference}, desc: ${request.description}`);

    // 6. Record the Payment (CONSISTENT WITH SCHEMAv4)
    if (request.description === 'Registration Fee') {
        // 1. Registration Fee Record
        const { error: regErr } = await supabase.from('registration_fees').insert({
            customer_id: request.reference,
            amount: amount,
            paid_at: new Date().toISOString(),
            status: 'paid' // FIXED: must be 'paid' to match registration_fee_status enum
        });
        if (regErr) console.error("[M-Pesa Edge] Reg Fee Record Error:", regErr.message);

        // 2. Also Record in Payments Ledger for frontend visibility
        const { error: payErr } = await supabase.from('payments').insert({
            customer_id: request.reference,
            customer_name: customerName,
            amount: amount,
            mpesa: mpesaReceipt, 
            date: todayStr,
            status: 'Allocated',
            is_reg_fee: true,
            allocated_by: 'M-Pesa STK Callback',
            note: 'STK Registration Fee Verified'
        });

        if (payErr) {
            console.error("[M-Pesa Edge] Registration Payment Log Error:", payErr.message);
            throw new Error(`Payment insertion failed: ${payErr.message}`);
        }

        // 3. Activate Customer
        await supabase.from('customers')
            .update({ mpesa_registered: true, status: 'Active' })
            .eq('id', request.reference);
    } else {
        // Standard Loan Payment Logic
        const { data: loan } = await supabase.from('loans')
            .select('id')
            .eq('customer_id', request.reference)
            .in('status', ['Active', 'Overdue'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { error: payErr } = await supabase.from('payments').insert({
            customer_id: request.reference,
            customer_name: customerName,
            loan_id: loan?.id || null,
            amount,
            mpesa: mpesaReceipt,
            date: todayStr,
            status: loan ? 'Allocated' : 'Unallocated',
            allocated_by: 'M-Pesa STK Callback',
            note: `STK Push Resolved for ${phone}`
        });

        if (payErr) {
            console.error("[M-Pesa Edge] Loan Payment Log Error:", payErr.message);
            throw new Error(`Payment insertion failed: ${payErr.message}`);
        }
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[M-Pesa Edge] Critical Error:", err.message);
    
    // Attempt to log the error to the database if we have a CheckoutID
    try {
        const payload = await req.clone().json().catch(() => ({}));
        const checkoutId = payload.Body?.stkCallback?.CheckoutRequestID;
        if (checkoutId) {
            await supabase.from('stk_requests').update({
                status: 'Failed',
                result_desc: `Internal Processing Error: ${err.message}`
            }).eq('checkout_request_id', checkoutId);
        }
    } catch (loggingErr) {
        console.error("Failed to log error to DB:", loggingErr.message);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Acknowledged Error" }));
  }
});
