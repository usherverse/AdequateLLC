import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get Auth token
    const authHeader = req.headers.get("Authorization")!;
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) throw new Error("Unauthorized");

    const { loan_id } = await req.json();

    // 1. Fetch Loan & Customer Details
    const { data: loan, error: loanErr } = await supabaseClient
      .from("loans")
      .select(`id, amount, status, customer_id, customers(status, phone, risk)`)
      .eq("id", loan_id)
      .single();

    if (loanErr || !loan) throw new Error("Loan not found");
    if (loan.status !== "Approved")
      throw new Error("Loan must be Approved to disburse");
    if (loan.customers.status === "Blacklisted")
      throw new Error("Customer is blacklisted");

    // Process Phone Number (Kenyan Format 2547XXXXXXXX)
    let phoneStr = String(loan.customers.phone).replace(/\D/g, "");
    if (phoneStr.startsWith("0")) phoneStr = "254" + phoneStr.substring(1);
    if (phoneStr.startsWith("7") || phoneStr.startsWith("1"))
      phoneStr = "254" + phoneStr;
    if (!phoneStr.startsWith("254") || phoneStr.length !== 12)
      throw new Error("Invalid Kenyan phone number format");

    // Check for existing pending/completed disbursement to prevent doubles
    const { data: existingDisb } = await supabaseClient
      .from("mpesa_disbursements")
      .select("id")
      .eq("loan_id", loan_id)
      .in("status", ["pending", "completed"])
      .maybeSingle();

    if (existingDisb)
      throw new Error(
        "Disbursement already initiated or completed for this loan",
      );

    // 2. Daraja Token Generation
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);

    const mpesaEnv =
      Deno.env.get("MPESA_ENVIRONMENT") === "production"
        ? "api.safaricom.co.ke"
        : "sandbox.safaricom.co.ke";

    const tokenRes = await fetch(
      `https://${mpesaEnv}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${credentials}` },
      },
    );
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // 3. Initiate B2C
    const shortcode = Deno.env.get("MPESA_B2C_SHORTCODE");
    const cert = Deno.env.get("MPESA_B2C_SECURITY_CREDENTIAL"); // Base64 encoded encrypted initiator password

    const b2cPayload = {
      InitiatorName: Deno.env.get("MPESA_B2C_INITIATOR_NAME"),
      SecurityCredential: cert,
      CommandID: "BusinessPayment",
      Amount: loan.amount,
      PartyA: shortcode,
      PartyB: phoneStr,
      Remarks: `Loan Disbursement ${loan_id}`,
      QueueTimeOutURL: Deno.env.get("MPESA_B2C_CALLBACK_URL"),
      ResultURL: Deno.env.get("MPESA_B2C_CALLBACK_URL"),
      Occasion: `LMS-${loan_id}`,
    };

    const b2cRes = await fetch(
      `https://${mpesaEnv}/mpesa/b2c/v3/paymentrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(b2cPayload),
      },
    );

    const b2cData = await b2cRes.json();

    if (b2cData.ResponseCode !== "0") {
      throw new Error(
        `Safaricom Error: ${b2cData.errorMessage || b2cData.ResponseDescription}`,
      );
    }

    // 4. Record to Database
    await supabaseClient.from("mpesa_disbursements").insert({
      conversation_id: b2cData.ConversationID,
      originator_conversation_id: b2cData.OriginatorConversationID,
      amount: loan.amount,
      phone_number: phoneStr,
      customer_id: loan.customer_id,
      loan_id: loan_id,
      status: "pending",
      initiated_by: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Disbursement queued successfully",
        conversation_id: b2cData.ConversationID,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
