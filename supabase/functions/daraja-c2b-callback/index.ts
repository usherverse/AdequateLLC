import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * PRODUCTION-READY M-PESA C2B (PAYBILL) CALLBACK HANDLER
 * Centralizes multiple validation/confirmation logic into a 
 * single trigger-safe ingestion point.
 */

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const TransID = payload.TransID;
    const amount = Number(payload.TransAmount);
    const MSISDN = payload.MSISDN;
    const BillRefNumber = (payload.BillRefNumber || "").trim();

    console.log(`[M-Pesa Edge C2B] Received TxID: ${TransID}, Amount: ${amount}, Ref: ${BillRefNumber}`);

    // 1. Identification: Match Customer by BillRef or Phone
    let matchedCustomer = null;
    if (BillRefNumber) {
        const { data: cust } = await supabase.from('customers')
          .select('id, name, status')
          .or(`id.eq."${BillRefNumber}",id_no.eq."${BillRefNumber}",account_number.eq."${BillRefNumber}"`) // FIXED: quotes added for robustness
          .maybeSingle();
        if (cust) matchedCustomer = cust;
    }

    if (!matchedCustomer && MSISDN) {
        const phoneSuffix = String(MSISDN).slice(-9);
        const { data: phoneMatch } = await supabase.from('customers')
          .select('id, name, status')
          .like('phone', `%${phoneSuffix}`)
          .limit(1)
          .maybeSingle();
        if (phoneMatch) matchedCustomer = phoneMatch;
    }

    // Fetch customer name for the ledger
    const customerName = matchedCustomer?.name || 'Unknown Paybill User';
    
    // Get current date in Nairobi time for the dashboard filter
    const todayStr = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Africa/Nairobi',
        year: 'numeric', month: '2-digit', day: '2-digit' 
    }).format(new Date());

    // 2. Logic Split: Registration vs Loan Payment
    if (matchedCustomer && amount === 500 && (matchedCustomer.status === 'Pending' || matchedCustomer.status === 'pending')) {
        // Handle Registration Fee
        const { error } = await supabase.from("registration_fees").insert({
            customer_id: matchedCustomer.id,
            amount: amount,
            paid_at: new Date().toISOString(),
            status: 'paid' 
        });
        
        if (!error) {
            // Also record in central payments ledger for audit visibility
            await supabase.from('payments').insert({
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
            console.error("[Edge C2B] Reg Fee Error:", error.message);
        }
    } else {
        // Handle Loan Payment
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

        const { error: payErr } = await supabase.from("payments").insert({
            customer_id: matchedCustomer?.id || null,
            customer_name: customerName,
            loan_id: targetLoanId,
            amount: amount,
            mpesa: TransID,
            date: todayStr,
            status: targetLoanId ? "Allocated" : "Unallocated",
            allocated_by: targetLoanId ? "M-Pesa Edge C2B" : null
        });
        if (payErr) console.error("[Edge C2B] Payment Log Error:", payErr.message);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[M-Pesa Edge C2B] Critical Error:", err.message);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted with error" }));
  }
});
