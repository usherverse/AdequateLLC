import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd());
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  console.log("Starting tests...");
  console.time('loans');
  await supabase.from('loans').select('*').limit(2000);
  console.timeEnd('loans');

  console.time('customers ID only');
  await supabase.from('customers').select('id').limit(2000);
  console.timeEnd('customers ID only');

  console.time('customers Full (*)');
  await supabase.from('customers').select('*').limit(2000);
  console.timeEnd('customers Full (*)');

  console.time('payments');
  await supabase.from('payments').select('*').limit(5000);
  console.timeEnd('payments');

  console.time('workers');
  await supabase.from('workers').select('*').limit(2000);
  console.timeEnd('workers');
  console.log("Tests completed");
}
test();
