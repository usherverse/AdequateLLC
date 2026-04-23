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

async function checkSchema() {
  const tables = ['workers', 'customers', 'loans'];
  for (const table of tables) {
    const { data, error } = await supabase.rpc('get_table_columns_debug', { t_name: table });
    if (error) {
       // Try raw query via postgres if RPC fails? But I can't do raw SQL easily.
       // Let's try to just insert a dummy and see error again.
       console.log(`Checking ${table} by trying to select...`);
       const { data: d } = await supabase.from(table).select('*').limit(1);
       console.log(`${table} sample row:`, d);
    } else {
       console.log(`${table} columns:`, data);
    }
  }
}

checkSchema();
