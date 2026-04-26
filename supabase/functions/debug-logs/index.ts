import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL') || "", Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "");
  const { data } = await supabase.from("raw_mpesa_logs").select("*").order("created_at", { ascending: false }).limit(20);
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});
