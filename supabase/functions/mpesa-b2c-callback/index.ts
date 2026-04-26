import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const result = payload.Result;

    if (!result) return new Response("OK"); // Acknowledge without doing anything if malformed

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const convId = result.ConversationID;
    const origConvId = result.OriginatorConversationID;
    const resultCode = result.ResultCode; // 0 is success
    
    let transactionId = "FAILED";
    // Extract transaction ID if successful
    if (resultCode === 0 && result.ResultParameters?.ResultParameter) {
      const trxParam = result.ResultParameters.ResultParameter.find((p: any) => p.Key === "TransactionReceipt");
      if (trxParam) transactionId = trxParam.Value;
    }

    const finalStatus = resultCode === 0 ? "completed" : "failed";

    // 1. Find the pending disbursement record
    const { data: record, error: fetchErr } = await supabaseClient
      .from("b2c_disbursements")
      .select("id, loan_id, customer_id, amount")
      .eq("originator_conversation_id", origConvId)
      .eq("status", "pending")
      .maybeSingle();

    if (!record) {
      console.warn("Disbursement record not found for OrigConvID:", origConvId);
      return new Response("OK", { status: 200 });
    }

    // 2. Update Disbursement Status
    await supabaseClient
      .from("b2c_disbursements")
      .update({
        transaction_id: transactionId,
        status: finalStatus,
        result_desc: result.ResultDesc,
        updated_at: new Date().toISOString()
      })
      .eq("id", record.id);

    // 3. Update Loan Status if Success
    if (finalStatus === "completed") {
      const { error: loanUpdateErr } = await supabaseClient
        .from("loans")
        .update({ 
          status: "Active", 
          disbursed: new Date().toISOString(),
          balance: record.amount // Now record.amount is correctly selected
        })
        .eq("id", record.loan_id)
        .eq("status", "Approved");

      if (loanUpdateErr) {
        console.error("Loan update failed:", loanUpdateErr);
      }

      await supabaseClient.from("audit_log").insert({
        ts: new Date().toISOString(),
        user_name: "System",
        action: "Daraja Disbursed",
        target_table: "loans",
        target_id: record.loan_id,
        detail: `M-Pesa System Auto Disbursement OK. Receipt: ${transactionId}. Amount: KES ${record.amount}`
      });
    } else {
      // Failed callback logic
      await supabaseClient.from("audit_log").insert({
        action: "Daraja Disburse Failed",
        target_table: "loans",
        target_id: record.loan_id,
        detail: `B2C Callback resulted in fail. Code: ${resultCode}. Desc: ${result.ResultDesc}`
      });
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("B2C Callback Processing Error:", err);
    return new Response("OK", { status: 200 }); // Safaricom expects 200 regardless
  }
});
