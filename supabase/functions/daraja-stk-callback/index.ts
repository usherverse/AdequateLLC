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

    // 1. Handle Failures (User cancelled, Timeout, etc.)
    if (cb.ResultCode !== 0) {
      console.warn(`[M-Pesa Edge] STK Failed: ${cb.ResultDesc} (${cb.ResultCode})`);
      await supabase.from('stk_requests').update({ 
        status: 'Failed', 
        result_code: cb.ResultCode, 
        result_desc: cb.ResultDesc 
      }).eq('checkout_request_id', cb.CheckoutRequestID);
      
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Failure Acknowledged" }));
    }

    // 2. Extract Success Data
    const meta = cb.CallbackMetadata?.Item || [];
    const mpesaReceipt = meta.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
    const amount = parseFloat(meta.find((i: any) => i.Name === 'Amount')?.Value);
    const phone = meta.find((i: any) => i.Name === 'PhoneNumber')?.Value;

    // 3. Match Request in DB
    const { data: request, error: reqErr } = await supabase
      .from('stk_requests')
      .update({ 
        status: 'Completed', 
        mpesa_receipt: mpesaReceipt, 
        result_code: 0 
      })
      .eq('checkout_request_id', cb.CheckoutRequestID)
      .select()
      .maybeSingle();

    if (!request || reqErr) {
        console.error("[M-Pesa Edge] STK Request record NOT FOUND for CheckoutRequestID:", cb.CheckoutRequestID);
        console.error("[M-Pesa Edge] Potential cause: The initial STK push failed to record in 'stk_requests' table (check for column mismatches).");
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Orphaned Success Logged" }));
    }

    console.log(`[M-Pesa Edge] matched request: ${request.id}, reference: ${request.reference}, desc: ${request.description}`);

    // 4. Record the Payment (CONSISTENT WITH SCHEMAv4)
    // This insertion fires 'trg_apply_payment' or 'trg_auto_activate_cust'
    if (request.description === 'Registration Fee') {
        // 1. Registration Fee Record
        await supabase.from('registration_fees').insert({
            customer_id: request.reference,
            amount: amount,
            paid_at: new Date().toISOString(),
            status: 'paid'
        });

        // 2. Also Record in Payments Ledger for frontend visibility
        const { error: payErr } = await supabase.from('payments').insert({
            customer_id: request.reference,
            amount: amount,
            mpesa: mpesaReceipt, // FIXED: mpesa_code -> mpesa
            status: 'Allocated',
            is_reg_fee: true,
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
        // Find recent active loan for the customer
        const { data: loan } = await supabase.from('loans')
            .select('id')
            .eq('customer_id', request.reference)
            .in('status', ['Active', 'Overdue'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { error: payErr } = await supabase.from('payments').insert({
            customer_id: request.reference,
            loan_id: loan?.id || null,
            amount,
            mpesa: mpesaReceipt, // FIXED: mpesa_code -> mpesa
            status: loan ? 'Allocated' : 'Unallocated',
            note: `Edge Logic: STK Push Resolved for ${phone}`
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
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Acknowledged Error" }));
  }
});
