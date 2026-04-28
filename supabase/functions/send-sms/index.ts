import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

/**
 * INTOUCH VAS SMS SENDER (API Key auth)
 *
 * Uses the API Key generated in sms.intouchvas.io → My Account → API Key tab.
 *
 * Environment secrets required:
 *   INTOUCH_API_KEY   — generated from sms.intouchvas.io → My Account → API Key
 *   INTOUCH_SENDER_ID — your registered sender name (e.g. ADEQUATE)
 */

const INTOUCH_SMS_URL = "https://sms.intouchvas.io/api/v1/send";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { msisdn, message } = await req.json();

    if (!msisdn || !message) {
      return new Response(
        JSON.stringify({ error: "msisdn and message are required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const apiKey   = Deno.env.get("INTOUCH_API_KEY") || "";
    const senderId = Deno.env.get("INTOUCH_SENDER_ID") || "ADEQUATE";

    if (!apiKey) {
      throw new Error("INTOUCH_API_KEY secret not configured.");
    }

    // Normalise phone to 254XXXXXXXXX
    const phone = msisdn.replace(/^\+/, "").replace(/^0/, "254");

    const res = await fetch(INTOUCH_SMS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ message, msisdn: phone, sender_id: senderId }),
    });

    const responseBody = await res.json().catch(() => ({}));
    console.log(`[send-sms] Sent to ${phone}: status=${res.status}`, JSON.stringify(responseBody));

    return new Response(JSON.stringify({ success: res.ok, response: responseBody }), {
      status: res.ok ? 200 : 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-sms] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
