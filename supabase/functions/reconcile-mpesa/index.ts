import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Initialize Supabase Client with Service Role (Admin privileges required for background jobs)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify Authorization (optional: secure the endpoint if called manually)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || authHeader.replace('Bearer ', '') !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
       // Allow execution, but log a warning if not using service role key (useful for local testing)
       console.warn("Reconciliation triggered without Service Role Key.");
    }

    // 2. Determine target requests
    const { checkout_request_id } = await req.json().catch(() => ({}));
    
    let pendingRequests;
    if (checkout_request_id) {
       console.log(`[Reconcile] Targeted check for: ${checkout_request_id}`);
       const { data, error: fetchErr } = await supabaseClient
         .from('stk_requests')
         .select('*')
         .eq('checkout_request_id', checkout_request_id)
         .maybeSingle();
       if (fetchErr) throw fetchErr;
       pendingRequests = data ? [data] : [];
    } else {
       console.log('[Reconcile] Checking all pending STK requests...');
       const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
       const { data, error: fetchErr } = await supabaseClient
         .from('stk_requests')
         .select('*')
         .eq('status', 'Pending')
         .lt('created_at', fiveMinsAgo);
       if (fetchErr) throw fetchErr;
       pendingRequests = data || [];
    }

    console.log(`[Reconcile] Found ${pendingRequests.length} requests to verify.`);
    let processed = 0;

    for (const request of pendingRequests) {
      try {
        console.log(`[Reconcile] Querying Safaricom for CheckoutRequestID: ${request.checkout_request_id}`);
        
        // --- Safaricom Auth ---
        const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
        const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
        const credentials = btoa(`${consumerKey}:${consumerSecret}`);
        const mpesaEnv = Deno.env.get("MPESA_ENVIRONMENT") === "production" ? "api.safaricom.co.ke" : "sandbox.safaricom.co.ke";

        const tokenRes = await fetch(`https://${mpesaEnv}/oauth/v1/generate?grant_type=client_credentials`, {
          headers: { Authorization: `Basic ${credentials}` },
        });
        const tokenData = await tokenRes.json();
        const token = tokenData.access_token;

        // --- STK Query ---
        const shortcode = Deno.env.get("MPESA_SHORTCODE") || "4166191";
        const passkey = Deno.env.get("MPESA_PASSKEY");
        const now = new Date();
        const ts = now.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = btoa(`${shortcode}${passkey}${ts}`);

        const queryPayload = {
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: ts,
          CheckoutRequestID: request.checkout_request_id
        };

        const queryRes = await fetch(`https://${mpesaEnv}/mpesa/stkpushquery/v1/query`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(queryPayload),
        });
        
        const result = await queryRes.json();
        const resultCode = parseInt(result.ResultCode);
        const resultDesc = result.ResultDesc || result.errorMessage;

        // --- Resolve Logic ---
        if (resultCode === 0) {
          // SUCCESS CASE
          console.log(`[Reconcile] ✅ Finalizing successful STK for Request ${request.id}`);
          
          await supabaseClient.from('stk_requests').update({ status: 'Completed', result_code: 0, result_desc: resultDesc }).eq('id', request.id);
          
          const { data: customer } = await supabaseClient.from('customers').select('name').eq('id', request.reference).single();
          await supabaseClient.from('customers').update({ mpesa_registered: true }).eq('id', request.reference);
          
          await supabaseClient.from('payments').insert([{
            customer_id: request.reference,
            customer_name: customer?.name || null,
            amount: request.amount || 500,
            mpesa: result.MpesaReceiptNumber || null, // Capture receipt if available
            status: 'Allocated',
            is_reg_fee: true,
            note: 'Reconciled: M-Pesa STK Push Registration Fee'
          }]);
          
          await supabaseClient.from('audit_log').insert([{ // FIXED: audit_logs -> audit_log
            user_name: 'System (Reconciliation)',
            action: 'Payment Resolved',
            detail: `STK push resolved via reconciliation job. ID: ${request.checkout_request_id}`
          }]);
        } else if (resultCode === 1032 || resultCode === 1) {
          // FAILED CASE
          console.log(`[Reconcile] ❌ Marking failed STK for Request ${request.id} (Code: ${resultCode})`);
          await supabaseClient.from('stk_requests').update({ status: 'Failed', result_code: resultCode, result_desc: resultDesc }).eq('id', request.id);
          
          await supabaseClient.from('audit_log').insert([{ // FIXED: audit_logs -> audit_log
            user_name: 'System (Reconciliation)',
            action: 'Payment Failed (Resolved)',
            detail: `STK push marked failed via reconciliation. Code: ${resultCode}. Desc: ${resultDesc}`
          }]);
        } else {
          console.warn(`[Reconcile] Unexpected ResultCode ${resultCode} for ${request.checkout_request_id}. Manual review may be needed.`);
        }
        processed++;
      } catch (err: any) {
        console.error(`[Reconcile] Failed to reconcile ${request.checkout_request_id}:`, err.message);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Reconciliation complete. Processed ${processed} requests.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
