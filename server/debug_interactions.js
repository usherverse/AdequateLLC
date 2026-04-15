import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Diagnosing 500 error on interactions...');
  const { count, error } = await supabase
    .from('interactions')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Count Error:', error.message);
  } else {
    console.log('Interactions count:', count);
  }

  console.log('Fetching first page of interactions (200)...');
  const { data, error: fErr } = await supabase
    .from('interactions')
    .select('*')
    .order('date', { ascending: false })
    .range(0, 199);
  
  if (fErr) {
    console.error('Fetch Error:', fErr.message);
  } else {
    console.log('Successfully fetched:', data?.length, 'rows');
  }
}

run();
