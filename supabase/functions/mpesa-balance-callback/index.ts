import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || "";
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("Balance Callback Payload:", JSON.stringify(payload));
    
    await supabase.from("raw_mpesa_logs").insert({
      source: "mpesa-balance-callback",
      payload: payload
    });

    const result = payload?.Result;
    if (result && result.ResultCode === 0) {
      // Success. Parse the parameters
      const params = result.ResultParameters?.ResultParameter || [];
      const accountBalancesStr = params.find((p: any) => p.Key === "AccountBalance")?.Value;
      
      // The string is usually in the format:
      // "Working Account|KES|254000.00|254000.00|0.00|0.00&Utility Account|KES|1250000.00|1250000.00|0.00|0.00"
      
      let utility_balance = 0;
      let working_balance = 0;
      let charges_balance = 0;

      if (accountBalancesStr) {
        const accounts = accountBalancesStr.split('&');
        for (const acc of accounts) {
          const parts = acc.split('|');
          if (parts.length >= 3) {
            const accName = parts[0];
            const currentBal = parseFloat(parts[2]);
            if (accName === "Utility Account") utility_balance = currentBal;
            if (accName === "Working Account") working_balance = currentBal;
            if (accName === "Charges Paid Account") charges_balance = currentBal;
          }
        }
      }

      await supabase.from("paybill_balance").update({
        utility_balance,
        working_balance,
        charges_balance,
        last_updated: new Date().toISOString()
      }).eq('id', 1);
    }

    // Always respond with 200 OK so Safaricom doesn't retry
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (err) {
    console.error("Error in balance callback:", err);
    return new Response("Error processing callback", { status: 500 });
  }
});
