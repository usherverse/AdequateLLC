require('dotenv').config({ path: 'production.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkType() {
  const { data, error } = await supabase.from('payments').select('id').limit(1);
  if (data && data.length > 0) {
    console.log("ID sample:", data[0].id);
    console.log("Type seems to be:", typeof data[0].id);
  } else {
    console.log("No data in payments table.");
  }
}
checkType();
