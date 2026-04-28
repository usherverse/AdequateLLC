import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    console.log("[M-Pesa Reversal Callback] Raw:", JSON.stringify(payload));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const result = payload.Result;
    if (!result) throw new Error("Invalid Reversal Callback payload");

    const conversationId = result.ConversationID;
    const resultCode = result.ResultCode;
    const resultDesc = result.ResultDesc;

    console.log(`[M-Pesa Reversal Callback] ConvID: ${conversationId}, Result: ${resultCode} - ${resultDesc}`);

    // Log the result to audit
    await supabase.from('audit_log').insert({
      ts: new Date().toISOString(),
      worker_name: 'M-Pesa Callback',
      action: resultCode === 0 ? 'M-Pesa Reversal Success' : 'M-Pesa Reversal Failed',
      summary: `ConvID: ${conversationId}. Safaricom Msg: ${resultDesc}`
    });

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[M-Pesa Reversal Callback] Error:", err.message);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Acknowledged Error" }));
  }
});
