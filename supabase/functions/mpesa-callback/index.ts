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
    const payload = await req.json();
    console.log("M-Pesa Callback Payload Received:", JSON.stringify(payload, null, 2));

    let mpesaReceiptNumber = null;
    let amount = null;
    let phoneNumber = null;

    // Type 1: STK Push Callback (C2B)
    if (payload.Body?.stkCallback) {
      const cb = payload.Body.stkCallback;
      if (cb.ResultCode === 0) {
        const items = cb.CallbackMetadata?.Item || [];
        for (const item of items) {
          if (item.Name === 'Amount') amount = item.Value;
          if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
          if (item.Name === 'PhoneNumber') phoneNumber = String(item.Value);
        }
      } else {
        console.log(`STK Push Failed with ResultCode: ${cb.ResultCode}`, cb.ResultDesc);
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Acknowledged failure" }), { status: 200 });
      }
    } 
    // Type 2: Standard C2B Webhook
    else if (payload.TransID) {
      mpesaReceiptNumber = payload.TransID;
      amount = payload.TransAmount;
      phoneNumber = String(payload.MSISDN);
    }

    if (!mpesaReceiptNumber || !amount) {
      throw new Error(`Missing required fields. Receipt: ${mpesaReceiptNumber}, Amount: ${amount}`);
    }

    // Attempt to map to a customer based on phone number
    let customerId = null;
    let loanId = null;

    if (phoneNumber) {
      // Find customer by matching phone number format roughly
      let phoneQuery = phoneNumber;
      if (phoneNumber.startsWith("254")) {
         phoneQuery = `0${phoneNumber.substring(3)}`; // Map 2547... to 07... 
      }
      const { data: cData } = await supabase
        .from('customers')
        .select('id, name')
        .or(`phone.eq.${phoneNumber},phone.eq.${phoneQuery}`)
        .limit(1)
        .single();

      if (cData) {
        customerId = cData.id;
        
        // Find their most recent active loan to allocate the payment to
        const { data: lData } = await supabase
          .from('loans')
          .select('id')
          .eq('customer_id', customerId)
          .in('status', ['Active', 'Overdue'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lData) {
          loanId = lData.id;
        }
      }
    }

    // Insert payment record
    const paymentRecord = {
      id: `PAY-${Date.now().toString(36).toUpperCase()}`,
      customer_id: customerId,
      loan_id: loanId,
      amount: Number(amount),
      mpesa_code: mpesaReceiptNumber,
      date: new Date().toISOString(),
      status: 'Paid',
      allocated_by: 'M-Pesa System'
    };

    const { error: dbErr } = await supabase.from('payments').insert([paymentRecord]);
    
    if (dbErr) {
       console.error("Database Insert Error:", dbErr);
       throw dbErr;
    }

    // Log the automated interaction
    if (customerId) {
       await supabase.from('interactions').insert([{
         id: `SYS-${Date.now().toString(36)}`,
         customer_id: customerId,
         worker_id: null,
         type: 'System Note',
         notes: `Automated M-Pesa payment of KES ${amount} (${mpesaReceiptNumber})`
       }]);
    }

    // Safaricom expects a success acknowledgment
    return new Response(JSON.stringify({ 
      ResultCode: 0, 
      ResultDesc: "Data received and saved successfully" 
    }), { headers: { "Content-Type": "application/json" }, status: 200 });

  } catch (err) {
    console.error("Webhook processing error:", err);
    // Even on error, return 200 so Safaricom doesn't repeatedly retry indefinitely unless it's a catastrophic network issue
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error processing payload" }), { headers: { "Content-Type": "application/json" }, status: 200 });
  }
});
