import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: lData } = await supabase.from('loans').select('*').limit(1);
  console.log('Loan columns:', Object.keys(lData[0] || {}));
  const { data: cData } = await supabase.from('customers').select('*').limit(1);
  console.log('Customer columns:', Object.keys(cData[0] || {}));
}

check();
