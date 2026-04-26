import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const MpesaConsumerKey = Deno.env.get('MPESA_CONSUMER_KEY') || "";
const MpesaConsumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET') || "";
const SecurityCredential = Deno.env.get('MPESA_SECURITY_CREDENTIAL') || "";
const InitiatorName = Deno.env.get('MPESA_INITIATOR_NAME') || "";
const ShortCode = Deno.env.get('MPESA_SHORTCODE') || "4166191";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken() {
  const credentials = btoa(`${MpesaConsumerKey}:${MpesaConsumerSecret}`);
  const response = await fetch("https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
    headers: { "Authorization": `Basic ${credentials}` }
  });
  if (!response.ok) throw new Error("Failed to get Daraja access token");
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = await getAccessToken();

    // In production, ResultURL must be HTTPS
    const resultUrl = "https://wnmabkrkbcigxqdprzrb.supabase.co/functions/v1/mpesa-balance-callback";
    
    const payload = {
      Initiator: InitiatorName,
      SecurityCredential: SecurityCredential,
      CommandID: "AccountBalance",
      PartyA: ShortCode,
      IdentifierType: "4",
      Remarks: "Check Balance",
      QueueTimeOutURL: resultUrl,
      ResultURL: resultUrl
    };

    const balanceRes = await fetch("https://api.safaricom.co.ke/mpesa/accountbalance/v1/query", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await balanceRes.json();
    
    // Log the immediate response to see if Daraja rejected it right away
    const supabase = createClient(Deno.env.get('SUPABASE_URL') || "", Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "");
    const { error: insertErr } = await supabase.from("raw_mpesa_logs").insert({
      source: "trigger-account-balance",
      payload: data
    });
    if (insertErr) console.error("Log insert failed:", insertErr);

    // If Daraja returns an error asynchronously, it will be in errorCode or ResponseCode
    if (data.errorCode || (data.ResponseCode && data.ResponseCode !== "0")) {
      return new Response(JSON.stringify({ error: data.errorMessage || data.ResponseDescription || "Daraja rejected the request." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: balanceRes.ok ? 200 : 400
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
