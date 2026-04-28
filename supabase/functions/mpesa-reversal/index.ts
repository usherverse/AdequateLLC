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
      const { data: p, error: pErr } = await supabaseClient.from('payments').select('amount, mpesa').eq('id', id).single();
      if (pErr || !p) throw new Error("Payment record not found in database.");
      amount = p.amount;
      mpesa_receipt = p.mpesa;
    } else {
      const { data: d, error: dErr } = await supabaseClient.from('b2c_disbursements').select('amount, transaction_id').eq('id', id).single();
      if (dErr || !d) throw new Error("Disbursement record not found in database.");
      amount = d.amount;
      mpesa_receipt = d.transaction_id;
    }

    if (!mpesa_receipt) throw new Error("This transaction has no M-Pesa Receipt Number (Reference) and cannot be reversed via API.");

    // 2. Daraja Token Generation
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    if (!consumerKey || !consumerSecret) throw new Error("Missing M-Pesa API Keys (Consumer Key/Secret) in Supabase Secrets.");

    const credentials = btoa(`${consumerKey}:${consumerSecret}`);
    const mpesaEnv = Deno.env.get("MPESA_ENVIRONMENT") === "production" ? "api.safaricom.co.ke" : "sandbox.safaricom.co.ke";
    
    const tokenRes = await fetch(`https://${mpesaEnv}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    
    if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Failed to generate M-Pesa Access Token: ${errText}`);
    }
    
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // 3. Initiate Reversal
    const initiator = Deno.env.get("MPESA_B2C_INITIATOR_NAME");
    const securityCert = Deno.env.get("MPESA_B2C_SECURITY_CREDENTIAL");
    const shortcode = Deno.env.get("MPESA_B2C_SHORTCODE");
    const callbackUrl = Deno.env.get("MPESA_REVERSAL_CALLBACK_URL");

    if (!initiator || !securityCert || !shortcode) throw new Error("Missing M-Pesa Initiator details in Supabase Secrets.");

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
      Remarks: `LMS Reversal: ${reason}`.substring(0, 100),
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
    console.log("[M-Pesa API Response]:", JSON.stringify(revData));

    if (revData.ResponseCode !== "0") {
      throw new Error(`Safaricom Rejection: ${revData.ResponseDescription || revData.errorMessage || "Unknown Error"}`);
    }

    // 4. Update Database (Local LMS Reversal)
    const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('reverse_transaction', {
      p_type: tx_type,
      p_id: id,
      p_reason: `M-PESA REVERSAL INITIATED: ${reason}`
    });

    if (rpcErr) throw new Error(`M-Pesa success, but local database update failed: ${rpcErr.message}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Reversal request accepted by Safaricom. The ledger has been updated.",
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
