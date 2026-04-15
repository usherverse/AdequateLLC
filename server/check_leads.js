import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { count, error } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Total Leads in DB:', count);
  
  if (count > 0) {
    const { data } = await supabase.from('leads').select('*').limit(5);
    console.log('Sample leads:', JSON.stringify(data, null, 2));
  }
}

run();
