import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTOUCH_SMS_URL = "https://sms-service.intouchvas.io/message/send/transactional";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get Current Hour in EAT (UTC+3)
    const now = new Date();
    const eatOffset = 3 * 60 * 60 * 1000;
    const eatDate = new Date(now.getTime() + eatOffset);
    const hour = eatDate.getUTCHours();

    console.log(`[Reminders] Running for hour: ${hour} EAT`);

    // Only run if it's 7 AM or 7 PM
    if (hour !== 7 && hour !== 19) {
      return new Response(JSON.stringify({ message: "Not a reminder window. Skipping." }), { status: 200 });
    }

    // 1. Fetch Queue from DB
    const { data: queue, error: qErr } = await supabaseClient.rpc('get_reminder_queue', { p_hour: hour });
    if (qErr) throw qErr;

    console.log(`[Reminders] Found ${queue?.length || 0} customers to notify.`);

    const apiKey = Deno.env.get("INTOUCH_API_KEY");
    const senderId = Deno.env.get("INTOUCH_SENDER_ID") || "Adequate";

    if (!apiKey) throw new Error("INTOUCH_API_KEY not set.");

    const results = [];

    // 2. Process Queue
    for (const item of (queue || [])) {
      const { customer_name, phone, balance, due_date, message_type } = item;
      const firstName = customer_name.split(' ')[0];
      const fmtBalance = `KES ${Number(balance).toLocaleString()}`;
      
      let message = "";
      if (message_type === 'morning_reminder') {
        message = `Dear ${firstName}, this is a reminder to make your partial payment today. Your current loan balance is ${fmtBalance}, due on ${due_date}. Thank you - Adequate Capital.`;
      } else if (message_type === 'evening_alert') {
        message = `Dear ${firstName}, we noticed you haven't made your partial payment today. Please settle it to avoid penalties. Your balance is ${fmtBalance}, due on ${due_date}. - Adequate Capital.`;
      } else if (message_type === 'pre_due_reminder') {
        message = `Dear ${firstName}, a reminder that your partial payment is due tomorrow. Current balance: ${fmtBalance}. Due date: ${due_date}. Thank you - Adequate Capital.`;
      }

      if (message && phone) {
        // Send SMS
        const normalizedPhone = phone.replace(/^\+/, "").replace(/^0/, "254");
        
        try {
            const smsRes = await fetch(INTOUCH_SMS_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": apiKey },
                body: JSON.stringify({ message, msisdn: normalizedPhone, sender_id: senderId }),
            });
            
            results.push({ phone, status: smsRes.status });

            // Log to DB
            await supabaseClient.from('sms_logs').insert({
                phone: normalizedPhone,
                message,
                status_code: smsRes.status,
                source: 'automated-reminders'
            });
        } catch (e) {
            console.error(`Failed to send to ${phone}`, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
