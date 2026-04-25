import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * PRODUCTION-READY M-PESA C2B (PAYBILL) CALLBACK HANDLER
 * Centralizes multiple validation/confirmation logic into a 
 * single trigger-safe ingestion point.
 */

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/** Generate a PAY-XXXXXXX style ID matching the frontend format */
const genPayId = () => 'PAY-' + crypto.randomUUID().replace(/-/g, '').substring(0, 7).toUpperCase();

Deno.serve(async (req: Request) => {
  // 1. FAST CORS/OPTIONS handling
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const requestId = crypto.randomUUID();
  
  // 1. READ BODY INSTANTLY BEFORE CONNECTION CLOSES
  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch (err) {
    console.error("Failed to read body", err);
  }

  // 2. Respond to Safaricom/IntouchVAS IMMEDIATELY
  const response = new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
    headers: { "Content-Type": "application/json" }
  });

  // Start background processing
  (async () => {
    let payload: any = {};

    try {
      console.log(`[C2B Callback ${requestId}] Raw Body: ${bodyText}`);

      try {
        payload = JSON.parse(bodyText);
      } catch (e) {
        console.warn(`[C2B Callback ${requestId}] JSON parse failed.`);
      }

      // ALWAYS Log to Raw Audit
      await supabase.from('raw_mpesa_logs').insert({ 
          payload: payload && Object.keys(payload).length > 0 ? payload : { rawText: bodyText }, 
          source: 'daraja-c2b-callback'
      });

      const TransID = payload.TransID || payload.reference;
      if (!payload || !TransID) return;

      const amount = Number(payload.TransAmount || payload.amount);
      const MSISDN = payload.MSISDN || payload.msisdn;
      const BillRefNumber = String(payload.BillRefNumber || payload.account || "").trim();

      // 1. Identification: Match Customer
      let matchedCustomer = null;
      if (BillRefNumber) {
          const { data: cust } = await supabase.from('customers')
            .select('id, name, status, mpesa_registered')
            .or(`id.eq."${BillRefNumber}",id_no.eq."${BillRefNumber}",account_number.eq."${BillRefNumber}"`)
            .maybeSingle();
          if (cust) matchedCustomer = cust;
      }

      if (!matchedCustomer && MSISDN) {
          const phoneSuffix = String(MSISDN).slice(-9);
          const { data: phoneMatch } = await supabase.from('customers')
            .select('id, name, status, mpesa_registered')
            .like('phone', `%${phoneSuffix}`)
            .limit(1)
            .maybeSingle();
          if (phoneMatch) matchedCustomer = phoneMatch;
      }

      const customerName = matchedCustomer?.name || payload.invoice_number || payload.FirstName || 'Paybill';
      const todayStr = new Intl.DateTimeFormat('en-CA', { 
          timeZone: 'Africa/Nairobi',
          year: 'numeric', month: '2-digit', day: '2-digit' 
      }).format(new Date());

      // 2. Logic Split: Registration Fee (500) vs Loan Payment
      if (matchedCustomer && amount === 500 && !matchedCustomer.mpesa_registered) {
          await supabase.from("registration_fees").insert({
              customer_id: matchedCustomer.id,
              amount: amount,
              paid_at: new Date().toISOString(),
              status: 'paid' 
          });
          
          await supabase.from('payments').insert({
              id: genPayId(),
              customer_id: matchedCustomer.id,
              customer_name: customerName,
              amount: amount,
              mpesa: TransID,
              date: todayStr,
              status: 'Allocated',
              is_reg_fee: true,
              allocated_by: 'M-Pesa Edge C2B'
          });

          await supabase.from('customers')
              .update({ mpesa_registered: true, status: 'Active' })
              .eq('id', matchedCustomer.id);
              
      } else {
          let targetLoanId = null;
          if (matchedCustomer) {
              const { data: loan } = await supabase.from("loans")
                  .select("id")
                  .eq("customer_id", matchedCustomer.id)
                  .in("status", ["Overdue", "Active"])
                  .order("days_overdue", { ascending: false })
                  .limit(1)
                  .maybeSingle();
              if (loan) targetLoanId = loan.id;
          }

          await supabase.from('payments').insert({
              id: genPayId(),
              customer_id: matchedCustomer?.id || null,
              customer_name: customerName,
              loan_id: targetLoanId,
              amount: amount,
              mpesa: TransID,
              date: todayStr,
              status: targetLoanId ? "Allocated" : "Unallocated",
              allocated_by: targetLoanId ? "M-Pesa Edge C2B" : null
          });
      }

      console.log(`[C2B Callback ${requestId}] Background processing complete.`);

    } catch (err: any) {
      console.error(`[C2B Callback ${requestId}] Background Fatal:`, err.message);
    }
  })();

  return response;
});
