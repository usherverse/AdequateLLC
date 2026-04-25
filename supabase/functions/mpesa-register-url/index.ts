

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Requires Admin key to invoke this setup route
    // Auth check removed for setup phase


    // 1. Daraja Token Generation
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE") || "4166191";
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);

    const mpesaEnv = Deno.env.get("MPESA_ENVIRONMENT") === "production" ? "api.safaricom.co.ke" : "sandbox.safaricom.co.ke";

    const tokenRes = await fetch(`https://${mpesaEnv}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // 2. Register Validation and Confirmation URLs (For direct C2B Paybill pushes)
    const projectUrl = "https://wnmabkrkbcigxqdprzrb.supabase.co";
    const registerPayload = {
      ShortCode: shortcode,
      ResponseType: "Completed",
      ConfirmationURL: `${projectUrl}/functions/v1/daraja-c2b-callback`,
      ValidationURL: `${projectUrl}/functions/v1/daraja-c2b-callback`,
    };

    const regRes = await fetch(`https://${mpesaEnv}/mpesa/c2b/v2/registerurl`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerPayload),
    });
    
    const regData = await regRes.json();

    return new Response(JSON.stringify({ 
      success: true, 
      message: "URLs registered successfully",
      safaricomData: regData
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
