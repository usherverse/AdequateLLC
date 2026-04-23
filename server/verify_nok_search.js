// Verify NOK search works against the live DB
// Run with: node server/verify_nok_search.js
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function verify() {
  console.log('\n=== NOK SEARCH VERIFICATION ===\n');

  // 1. Test: search by NOK name (Aaron Achieng is NOK for Mary Kamau / CUS-0001)
  let { data, error } = await supabase
    .from('customers')
    .select('id, name, n1_name, n1_phone, n2_name, n2_phone, n3_name, n3_phone')
    .ilike('n1_name', '%Aaron Achieng%');
  console.log('Search n1_name = "Aaron Achieng":', error ? error.message : `${data.length} result(s)`);
  if (data?.length) data.forEach(c => console.log(`  → [${c.id}] ${c.name} | NOK1: ${c.n1_name}`));

  // 2. Test: search by NOK phone
  ({ data, error } = await supabase
    .from('customers')
    .select('id, name, n1_name, n1_phone')
    .ilike('n1_phone', '%0728471901%'));
  console.log('\nSearch n1_phone = "0728471901":', error ? error.message : `${data.length} result(s)`);
  if (data?.length) data.forEach(c => console.log(`  → [${c.id}] ${c.name} | NOK1: ${c.n1_name} (${c.n1_phone})`));

  // 3. Test: search by n2 NOK name
  ({ data, error } = await supabase
    .from('customers')
    .select('id, name, n2_name, n2_phone')
    .ilike('n2_name', '%Caleb Mwangangi%'));
  console.log('\nSearch n2_name = "Caleb Mwangangi":', error ? error.message : `${data.length} result(s)`);
  if (data?.length) data.forEach(c => console.log(`  → [${c.id}] ${c.name} | NOK2: ${c.n2_name}`));

  // 4. Test: search by customer name (basic sanity)
  ({ data, error } = await supabase
    .from('customers')
    .select('id, name')
    .ilike('name', '%Mary Kamau%'));
  console.log('\nSearch name = "Mary Kamau":', error ? error.message : `${data.length} result(s)`);
  if (data?.length) data.forEach(c => console.log(`  → [${c.id}] ${c.name}`));

  // 5. Test: Sky Walker (the PENDING record)
  ({ data, error } = await supabase
    .from('customers')
    .select('id, name, n1_name, n1_phone')
    .ilike('name', '%Sky Walker%'));
  console.log('\nSearch name = "Sky Walker":', error ? error.message : `${data.length} result(s)`);
  if (data?.length) data.forEach(c => console.log(`  → [${c.id}] ${c.name} | NOK1: ${c.n1_name} (${c.n1_phone})`));

  console.log('\n=== DONE ===\n');
}

verify().catch(console.error);
