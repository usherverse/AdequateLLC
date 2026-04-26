require('dotenv').config({ path: 'production.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('raw_mpesa_logs')
    .select('*')
    .eq('endpoint', 'mpesa-balance-callback')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error("Error querying logs:", error);
  } else {
    console.log("Found logs:", data.length);
    data.forEach(d => {
      console.log(JSON.stringify(d, null, 2));
    });
  }
}

check();
