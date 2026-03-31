import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Safaricom sends POST directly, no cors strictly needed
serve(async (req) => {
  try {
    const payload = await req.json();

    // Determine payload type: C2B Validation/Confirmation VS STK Push Result
    let transactionCode = "";
    let amount = 0;
    let phoneNumber = "";
    let accountNumber = "";
    let isStk = false;

    // Handle STK Push Format
    if (payload.Body && payload.Body.stkCallback) {
        isStk = true;
        const cb = payload.Body.stkCallback;
        if (cb.ResultCode !== 0) {
            // Unsuccessful STK (user cancelled, timeout, etc.)
            const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
            await supabase.from("mpesa_collections")
              .update({ status: "failed" })
              .eq("checkout_request_id", cb.CheckoutRequestID);
            return new Response("OK", { status: 200 }); // Safaricom acknowledged
        }
        
        const metadata = cb.CallbackMetadata.Item;
        amount = metadata.find((i:any) => i.Name === "Amount")?.Value;
        transactionCode = metadata.find((i:any) => i.Name === "MpesaReceiptNumber")?.Value;
        phoneNumber = metadata.find((i:any) => i.Name === "PhoneNumber")?.Value.toString();
        // For STK, we'll grab account number from our DB tracking since Safaricom drops it in callback
        
    } else {
        // Handle Standard C2B URL Format (from Register_URL)
        transactionCode = payload.TransID;
        amount = Number(payload.TransAmount);
        phoneNumber = payload.MSISDN;
        accountNumber = payload.BillRefNumber || "";
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Find account number if STK
    if (isStk) {
        const {data: rec} = await supabase.from("mpesa_collections")
            .select("account_number")
            .eq("checkout_request_id", payload.Body.stkCallback.CheckoutRequestID)
            .single();
        if (rec) accountNumber = rec.account_number;
    }

    // 1. Guard against duplicate Mpesa Transactions
    const { data: existingTrx } = await supabase.from("payments").select("id").eq("mpesa_code", transactionCode).maybeSingle();
    if (existingTrx) return new Response("OK", { status: 200 }); // Ignore duplicated callback

    // 2. Identify Customer via Account Number (Customer ID)
    let customerId = null;
    if (accountNumber) {
        const { data: cust } = await supabase.from("customers").select("id").eq("id", accountNumber).maybeSingle();
        if (cust) customerId = cust.id;
    }

    // Is it a registration fee? 
    // Trigger `trg_auto_activate_cust` handles activation, but we need to insert to registration_fees.
    if (customerId && amount === 500) {
        // Check if customer is pending
        const { data: cStatus } = await supabase.from("customers").select("status").eq("id", customerId).single();
        if (cStatus?.status === 'Pending') {
             await supabase.from("registration_fees").insert({
                customer_id: customerId,
                amount: amount,
                mpesa_code: transactionCode,
                status: 'verified' -- verified immediately since we got CB
             });
             return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }));
        }
    }

    // 3. Find target loan for this customer (Find oldest overdue or active loan)
    let targetLoanId = null;
    if (customerId) {
        const { data: loans } = await supabase.from("loans")
            .select("id, status")
            .eq("customer_id", customerId)
            .in("status", ["Overdue", "Active"])
            .order("days_overdue", { ascending: false })
            .limit(1);
        if (loans && loans.length > 0) targetLoanId = loans[0].id;
    }

    let pStatus = targetLoanId ? "Allocated" : "Unallocated";
    let pAlloc = targetLoanId ? "System (Auto)" : "System (Hold)";

    // 4. Record Payment
    // Auto-deduct trigger (trg_apply_payment) will fire if state is "Allocated", reducing balance, marking settled if 0, and patching schedules!
    await supabase.from("payments").insert({
        customer_id: customerId,
        loan_id: targetLoanId,
        amount: amount,
        mpesa_code: transactionCode,
        phone_number: phoneNumber,
        status: pStatus,
        allocated_by: pAlloc
    });

    // 5. Update STK collection tracker if stk
    if (isStk) {
        await supabase.from("mpesa_collections")
            .update({ status: "completed" })
            .eq("checkout_request_id", payload.Body.stkCallback.CheckoutRequestID);
    }

    // Provide Daraja Acknowledgment response
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("C2B Callback Error:", err);
    return new Response("OK", { status: 200 }); // Always 200 to prevent CB retry spam
  }
});
