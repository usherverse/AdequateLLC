import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/"/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data, error } = await supabase.rpc('inspect_table', { table_name: 'customers' });
  if (error) {
    // If RPC doesn't exist, try getting one row
    const { data: row, error: rowErr } = await supabase.from('customers').select('*').limit(1);
    if (row && row.length > 0) {
      console.log('Customer columns:', Object.keys(row[0]));
    } else {
       console.log('Customer table is empty, cannot infer columns.');
    }
  } else {
    console.log('Columns:', data);
  }
}

inspect();
