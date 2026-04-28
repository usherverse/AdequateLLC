require('dotenv').config({ path: 'production.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const { data, error } = await supabase.rpc('inspect_table_schema', { table_name: 'payments' });
  if (error) {
     // fallback to a simple query to see columns
     const { data: cols, error: err2 } = await supabase.from('payments').select('*').limit(1);
     if (err2) console.error(err2);
     else console.log("Columns:", Object.keys(cols[0] || {}));
  } else {
     console.log(data);
  }
}
checkSchema();
