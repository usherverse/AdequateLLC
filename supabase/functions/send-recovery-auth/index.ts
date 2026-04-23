/**
 * INFRASTRUCTURE SMOKE TEST
 * Does absolutely nothing. If this returns 500, the project quota is the culprit.
 */

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  console.log("Smoke Test triggered.");
  
  return new Response(JSON.stringify({ 
    status: "ALIVE", 
    message: "Infrastructure is working. The issue is likely in the secrets or service connection." 
  }), { 
    status: 200, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  });
});
