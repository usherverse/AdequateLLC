import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { error } = await supabase.from('unallocated_payments').delete().eq('transaction_id', 'RJ8BK3DHE6');
  if (error) console.error('Error deleting:', error.message);
  else console.log('Successfully deleted ghost unallocated record RJ8BK3DHE6.');

  // Also fix the hidden payments I found earlier (loan_id: null, status: Allocated)
  const { error: error2 } = await supabase.from('payments').update({ status: 'Unallocated' }).is('loan_id', null).eq('status', 'Allocated');
  if (error2) console.error('Error updating hidden payments:', error2.message);
  else console.log('Successfully updated hidden payments to Unallocated state.');
}

fix();
