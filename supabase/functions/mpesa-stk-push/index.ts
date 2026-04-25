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

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Unauthorized");

    const { amount, phone_number, customer_id, description } = await req.json();

    if (!amount || amount <= 0 || !phone_number || !customer_id) {
        throw new Error("Missing amount, phone_number, or customer_id");
    }

    // Fetch the customer's National ID (id_no) to use as the AccountReference
    const { data: customer, error: custError } = await supabaseClient
      .from('customers')
      .select('id_no, account_number')
      .eq('id', customer_id)
      .maybeSingle();

    const accountRef = customer?.id_no || customer?.account_number || customer_id;

    // Process Phone Number (Kenyan Format 2547XXXXXXXX)
    let phoneStr = String(phone_number).replace(/\D/g, "");
    if (phoneStr.startsWith("0")) phoneStr = "254" + phoneStr.substring(1);
    if (!phoneStr.startsWith("254") || phoneStr.length !== 12) throw new Error("Invalid Kenyan phone format. Must be 2547XXXXXXXX or 07XXXXXXXX");

    // 1. Daraja Token
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);

    const mpesaEnv = Deno.env.get("MPESA_ENVIRONMENT") === "production" ? "api.safaricom.co.ke" : "sandbox.safaricom.co.ke";

    const tokenRes = await fetch(`https://${mpesaEnv}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // 2. STK Payload Definition (Lipa Na M-Pesa Online)
    const shortcode = Deno.env.get("MPESA_SHORTCODE") || "4166191";
    const passkey = Deno.env.get("MPESA_PASSKEY");
    
    const now = new Date();
    const ts = now.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${ts}`);

    // Sanitize AccountReference (Max 12 chars, no spaces)
    const accRef = String(accountRef).substring(0, 12).replace(/\s/g, '');
    
    // Sanitize TransactionDesc (Max 13 chars)
    // If it's a registration fee, we'll use "Reg: [ID]" 
    const isReg = description?.toLowerCase().includes('registration');
    const displayDesc = isReg 
      ? `Reg:${accRef.replace('CUS-', '')}`.substring(0, 13) 
      : description?.substring(0, 13) || `Pay:${accRef}`.substring(0, 13);

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline", 
      Amount: Math.ceil(amount),
      PartyA: phoneStr,
      PartyB: shortcode,
      PhoneNumber: phoneStr,
      CallBackURL: Deno.env.get("MPESA_STK_CALLBACK_URL"),
      AccountReference: accRef, 
      TransactionDesc: displayDesc
    };

    const stkRes = await fetch(`https://${mpesaEnv}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });
    
    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== "0") {
       throw new Error(`Safaricom STK Error: ${stkData.errorMessage || stkData.ResponseDescription}`);
    }

    // 3. Record Pending Push
    await supabaseClient.from("stk_requests").insert({
      merchant_request_id: stkData.MerchantRequestID,
      checkout_request_id: stkData.CheckoutRequestID,
      amount: Math.ceil(amount),
      phone_number: phoneStr,
      reference: customer_id, // FIXED: was customer_id
      description: description || 'Loan Payment',
      status: "Pending"
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Push sent to customer phone",
      checkout_id: stkData.CheckoutRequestID
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
