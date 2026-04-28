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
    console.log(`[Reversal] Starting for ${tx_type} ID: ${id}`);

    // 1. Fetch Transaction Details
    let amount: number;
    let mpesa_receipt: string;
    
    if (tx_type === 'payment') {
      const { data: p } = await supabaseClient.from('payments').select('amount, mpesa').eq('id', id).single();
      if (!p) throw new Error("Payment record not found.");
      amount = p.amount;
      mpesa_receipt = p.mpesa;
    } else {
      const { data: d } = await supabaseClient.from('b2c_disbursements').select('amount, transaction_id').eq('id', id).single();
      if (!d) throw new Error("Disbursement record not found.");
      amount = d.amount;
      mpesa_receipt = d.transaction_id;
    }

    if (!mpesa_receipt) throw new Error("No M-Pesa reference found. Manual entries cannot be reversed via API.");

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

    // 3. Robust Shortcode Detection
    const c2bShortcode = Deno.env.get("MPESA_C2B_SHORTCODE") || Deno.env.get("MPESA_SHORTCODE");
    const b2cShortcode = Deno.env.get("MPESA_B2C_SHORTCODE");

    // If it's a payment, we MUST use the collection shortcode (Paybill). 
    // If it's a disbursement, we MUST use the disbursement shortcode.
    const shortcode = tx_type === 'payment' ? c2bShortcode : b2cShortcode;

    console.log(`[Reversal] Using Shortcode: ${shortcode} for ${tx_type}`);

    const initiator = Deno.env.get("MPESA_B2C_INITIATOR_NAME");
    const securityCert = Deno.env.get("MPESA_B2C_SECURITY_CREDENTIAL");
    const callbackUrl = Deno.env.get("MPESA_REVERSAL_CALLBACK_URL");

    if (!shortcode) throw new Error(`Missing Shortcode secret for ${tx_type}. Please check MPESA_C2B_SHORTCODE or MPESA_B2C_SHORTCODE.`);
    if (!initiator || !securityCert) throw new Error("Missing M-Pesa Initiator/Security secrets.");

    const reversalPayload = {
      Initiator: initiator,
      SecurityCredential: securityCert,
      CommandID: "TransactionReversal",
      TransactionID: mpesa_receipt,
      Amount: amount,
      ReceiverParty: shortcode,
      RecieverIdentifierType: "11",
      ResultURL: callbackUrl,
      QueueTimeOutURL: callbackUrl,
      Remarks: `LMS Rev: ${reason}`.substring(0, 100),
      Occasion: `LMS-REV-${id}`.substring(0, 100)
    };

    const revRes = await fetch(`https://${mpesaEnv}/mpesa/reversal/v1/requestapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reversalPayload),
    });

    const revData = await revRes.json();
    console.log("[Reversal] Raw Response:", JSON.stringify(revData));

    if (revData.ResponseCode !== "0") {
      throw new Error(`Safaricom Rejection: ${revData.ResponseDescription || revData.errorMessage}`);
    }

    // 4. Update Database (Local LMS Reversal)
    await supabaseClient.rpc('reverse_transaction', {
      p_type: tx_type,
      p_id: id,
      p_reason: `M-PESA REVERSAL INITIATED: ${reason}`
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Reversal request sent to Safaricom.",
      conversation_id: revData.ConversationID 
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
