require('dotenv').config({ path: 'production.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema(table) {
  console.log(`--- Schema for ${table} ---`);
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) console.error(error);
  else console.log("Columns:", Object.keys(data[0] || {}));
}

async function run() {
  await checkSchema('customers');
  await checkSchema('loans');
  await checkSchema('payments');
}
run();
