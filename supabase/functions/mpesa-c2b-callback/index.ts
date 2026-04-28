import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ── Intouch VAS SMS helper (API Key auth) ────────────────────────────────────
const INTOUCH_SMS_URL = "https://sms.intouchvas.io/api/v1/send";

async function sendBalanceSMS(msisdn: string, customerName: string, amountPaid: number, loanBalance: number, transID: string): Promise<void> {
  try {
    const apiKey   = Deno.env.get("INTOUCH_API_KEY") || "";
    const senderId = Deno.env.get("INTOUCH_SENDER_ID") || "ADEQUATE";

    if (!apiKey || !msisdn) {
      console.warn("[SMS] INTOUCH_API_KEY not set or no MSISDN — skipping.");
      return;
    }

    // Normalise phone to 254XXXXXXXXX
    const phone = msisdn.replace(/^\+/, "").replace(/^0/, "254");

    // Format currency
    const fmt = (n: number) => `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const firstName = customerName.split(' ')[0];
    const message = loanBalance > 0
      ? `Dear ${firstName}, payment of ${fmt(amountPaid)} received (Ref: ${transID}). Your outstanding loan balance is ${fmt(loanBalance)}. Thank you - Adequate Capital.`
      : `Dear ${firstName}, payment of ${fmt(amountPaid)} received (Ref: ${transID}). Your loan is now FULLY SETTLED! Thank you - Adequate Capital.`;

    // Send SMS — API Key used directly as Bearer token
    const smsRes = await fetch(INTOUCH_SMS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ message, msisdn: phone, sender_id: senderId }),
    });

    const smsJson = await smsRes.json().catch(() => ({}));
    console.log(`[SMS] Sent to ${phone}: status=${smsRes.status}`, JSON.stringify(smsJson));
  } catch (smsErr: any) {
    // SMS failure must NEVER crash the payment flow
    console.error("[SMS] Failed to send balance SMS:", smsErr.message);
  }
}

/**
 * PRODUCTION-READY M-PESA C2B (PAYBILL) CALLBACK HANDLER
 *
 * Account Number Matching Priority:
 *   1. id_no  (National ID) — this is the canonical "account number" customers use at paybill
 *   2. id     (numeric customer record ID) — numeric fallback
 *   3. MSISDN (phone number) — last resort when account field is missing
 */

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/** Generate a PAY-XXXXXXX style ID matching the frontend format */
const genPayId = () => 'PAY-' + crypto.randomUUID().replace(/-/g, '').substring(0, 7).toUpperCase();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const requestId = crypto.randomUUID();

  // READ BODY INSTANTLY BEFORE CONNECTION CLOSES
  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch (err) {
    console.error(`[C2B ${requestId}] Failed to read body`, err);
  }

  // Respond to Safaricom IMMEDIATELY — must be within 5 seconds
  const response = new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
    headers: { "Content-Type": "application/json" }
  });

  // Background processing (non-blocking)
  (async () => {
    let payload: any = {};

    try {
      console.log(`[C2B ${requestId}] Raw Body: ${bodyText}`);

      try {
        payload = JSON.parse(bodyText);
      } catch (e) {
        console.warn(`[C2B ${requestId}] JSON parse failed — raw body stored.`);
      }

      // Always log raw payload for audit/debugging
      await supabase.from('raw_mpesa_logs').insert({
        payload: payload && Object.keys(payload).length > 0 ? payload : { rawText: bodyText },
        source: 'mpesa-c2b-callback'
      });

      const TransID = payload.TransID || payload.reference;
      if (!TransID) {
        console.warn(`[C2B ${requestId}] No TransID found — skipping.`);
        return;
      }

      const amount        = Number(payload.TransAmount || payload.amount || 0);
      const MSISDN        = String(payload.MSISDN || payload.msisdn || '').trim();
      // BillRefNumber is what the customer typed as their "account number" at the paybill prompt.
      // Adequate Capital instructs customers to use their National ID number here.
      const BillRefNumber = String(payload.BillRefNumber || payload.account || '').trim();

      console.log(`[C2B ${requestId}] TransID=${TransID} Amount=${amount} BillRef="${BillRefNumber}" MSISDN=${MSISDN}`);

      // ── Step 1: Match customer ─────────────────────────────────────────────
      // Priority: National ID (id_no) → Customer record ID (id) → Phone (MSISDN)
      let matchedCustomer: any = null;
      let matchMethod = 'none';

      if (BillRefNumber) {
        // FIX: PostgREST .or() does NOT use embedded quotes around values.
        // Use separate .eq() calls with maybeSingle() instead to be explicit and safe.

        // Try id_no first (National ID = the canonical account number)
        const { data: byIdNo } = await supabase
          .from('customers')
          .select('id, name, status, mpesa_registered')
          .eq('id_no', BillRefNumber)
          .maybeSingle();

        if (byIdNo) {
          matchedCustomer = byIdNo;
          matchMethod = 'id_no';
        } else {
          // Fallback: try matching numeric customer record ID
          const { data: byId } = await supabase
            .from('customers')
            .select('id, name, status, mpesa_registered')
            .eq('id', BillRefNumber)
            .maybeSingle();

          if (byId) {
            matchedCustomer = byId;
            matchMethod = 'customer_id';
          }
        }
      }

      // Last resort: match by phone number suffix
      if (!matchedCustomer && MSISDN) {
        const phoneSuffix = MSISDN.slice(-9);
        const { data: byPhone } = await supabase
          .from('customers')
          .select('id, name, status, mpesa_registered')
          .like('phone', `%${phoneSuffix}`)
          .limit(1)
          .maybeSingle();

        if (byPhone) {
          matchedCustomer = byPhone;
          matchMethod = 'phone';
        }
      }

      console.log(`[C2B ${requestId}] Customer match: method="${matchMethod}" id="${matchedCustomer?.id}" name="${matchedCustomer?.name}"`);

      // Build payer name — handle both Safaricom format (FirstName) and Itouch VAS format (first_name)
      // Itouch VAS also sends invoice_number which sometimes contains the payer's full name
      const mpesaName = [
        payload.FirstName  || payload.first_name,
        payload.MiddleName || payload.middle_name,
        payload.LastName   || payload.last_name
      ].filter(Boolean).join(' ').trim()
        || String(payload.invoice_number || '').trim();

      // Use matched customer name first, then M-Pesa sender name, then phone as last resort
      const customerName = matchedCustomer?.name
        || mpesaName
        || (MSISDN ? `M-Pesa (${MSISDN})` : `Paybill (${BillRefNumber})`);
      const nowISO = new Date().toISOString();

      // ── Step 2: Registration fee (KES 500) vs loan repayment ──────────────
      if (matchedCustomer && amount === 500 && !matchedCustomer.mpesa_registered) {
        // Registration fee path
        console.log(`[C2B ${requestId}] Processing as registration fee for customer ${matchedCustomer.id}`);

        await supabase.from("registration_fees").insert({
          customer_id: matchedCustomer.id,
          amount,
          paid_at: new Date().toISOString(),
          status: 'paid'
        });

        await supabase.from('payments').insert({
          id: genPayId(),
          customer_id: matchedCustomer.id,
          customer_name: customerName,
          amount,
          mpesa: TransID,
          date: nowISO,
          status: 'Allocated',
          is_reg_fee: true,
          allocated_by: 'M-Pesa C2B Auto'
        });

        await supabase.from('customers')
          .update({ mpesa_registered: true, status: 'Active' })
          .eq('id', matchedCustomer.id);

        console.log(`[C2B ${requestId}] Registration fee processed for customer ${matchedCustomer.id}`);

      } else {
        // Loan repayment path — find most overdue active loan
        let targetLoanId: string | null = null;

        if (matchedCustomer) {
          const { data: loan } = await supabase
            .from("loans")
            .select("id")
            .eq("customer_id", matchedCustomer.id)
            .in("status", ["Overdue", "Active"])
            .order("days_overdue", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (loan) targetLoanId = loan.id;
        }

        const status = targetLoanId ? "Allocated" : "Unallocated";
        console.log(`[C2B ${requestId}] Inserting payment: status=${status} loan_id=${targetLoanId}`);

        await supabase.from('payments').insert({
          id: genPayId(),
          customer_id: matchedCustomer?.id || null,
          customer_name: customerName,
          loan_id: targetLoanId,
          amount,
          mpesa: TransID,
          date: nowISO,
          status,
          allocated_by: targetLoanId ? `M-Pesa C2B Auto (${matchMethod})` : null
        });

        // ── Send loan balance SMS via Intouch VAS ──────────────────────────
        if (matchedCustomer && targetLoanId) {
          // Fetch the updated loan balance (already decremented by DB trigger)
          // Also fetch the customer's registered phone number
          const { data: customerData } = await supabase
            .from('customers')
            .select('phone, balance:loans(balance)')
            .eq('id', matchedCustomer.id)
            .eq('loans.id', targetLoanId)
            .single();

          const loanBalance = customerData?.balance?.[0]?.balance ?? 0;
          
          // Use the paying number if valid, otherwise fallback to the registered number
          const targetPhone = (MSISDN && MSISDN !== "0" && MSISDN.length > 5) 
            ? MSISDN 
            : customerData?.phone;

          if (targetPhone) {
            await sendBalanceSMS(targetPhone, customerName, amount, loanBalance, TransID);
          } else {
            console.warn(`[SMS] No valid phone found for customer ${matchedCustomer.id} (MSISDN was ${MSISDN})`);
          }
        }
      }

      console.log(`[C2B ${requestId}] Processing complete.`);

    } catch (err: any) {
      console.error(`[C2B ${requestId}] Fatal error:`, err.message);
    }
  })();

  return response;
});
