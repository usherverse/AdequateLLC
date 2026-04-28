import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { tx_type, id, reason } = await req.json();

    // 1. Fetch Transaction Details
    let amount: number;
    let mpesa_receipt: string;
    let loan_id: string;

    if (tx_type === 'payment') {
      const { data: p } = await supabaseClient.from('payments').select('amount, mpesa, loan_id').eq('id', id).single();
      if (!p) throw new Error("Payment not found");
      amount = p.amount;
      mpesa_receipt = p.mpesa;
      loan_id = p.loan_id;
    } else {
      const { data: d } = await supabaseClient.from('b2c_disbursements').select('amount, transaction_id, loan_id').eq('id', id).single();
      if (!d) throw new Error("Disbursement not found");
      amount = d.amount;
      mpesa_receipt = d.transaction_id;
      loan_id = d.loan_id;
    }

    if (!mpesa_receipt) throw new Error("No M-Pesa receipt number found for this transaction");

    // 2. Daraja Token Generation
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);

    const mpesaEnv = Deno.env.get("MPESA_ENVIRONMENT") === "production" ? "api.safaricom.co.ke" : "sandbox.safaricom.co.ke";
    const tokenRes = await fetch(`https://${mpesaEnv}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // 3. Initiate Reversal
    const reversalPayload = {
      Initiator: Deno.env.get("MPESA_B2C_INITIATOR_NAME"),
      SecurityCredential: Deno.env.get("MPESA_B2C_SECURITY_CREDENTIAL"),
      CommandID: "TransactionReversal",
      TransactionID: mpesa_receipt,
      Amount: amount,
      ReceiverParty: Deno.env.get("MPESA_B2C_SHORTCODE"),
      RecieverIdentifierType: "11", // Organization
      ResultURL: Deno.env.get("MPESA_REVERSAL_CALLBACK_URL"),
      QueueTimeOutURL: Deno.env.get("MPESA_REVERSAL_CALLBACK_URL"),
      Remarks: `Reversal: ${reason}`,
      Occasion: `LMS-REV-${id}`
    };

    console.log("[M-Pesa Reversal] Initiating for", mpesa_receipt, reversalPayload);

    const revRes = await fetch(`https://${mpesaEnv}/mpesa/reversal/v1/requestapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reversalPayload),
    });

    const revData = await revRes.json();

    if (revData.ResponseCode !== "0") {
      throw new Error(`Safaricom API Error: ${revData.ResponseDescription || revData.errorMessage}`);
    }

    // 4. Update Database (Local LMS Reversal)
    const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('reverse_transaction', {
      p_type: tx_type,
      p_id: id,
      p_reason: `M-PESA REVERSAL INITIATED: ${reason}`
    });

    if (rpcErr) throw rpcErr;

    return new Response(JSON.stringify({ 
      success: true, 
      message: "M-Pesa Reversal request sent to Safaricom.",
      conversation_id: revData.ConversationID 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[M-Pesa Reversal] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
