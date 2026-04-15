import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function repair() {
  console.log('--- Repairing Payment Statuses ---');
  
  // 1. Revert Registration Fees to 'Allocated'
  const { error: err1 } = await supabase
    .from('payments')
    .update({ status: 'Allocated', allocated_by: 'Admin' })
    .eq('is_reg_fee', true);
  
  if (err1) console.error('Error fixing Reg Fees:', err1.message);
  else console.log('✅ Restored "Allocated" status to all Registration Fees.');

  // 2. Fix manual payments that were matched to customers (PAY-0015 etc)
  const { error: err2 } = await supabase
    .from('payments')
    .update({ status: 'Allocated', allocated_by: 'Admin' })
    .not('customer_id', 'is', null) // Has a customer
    .is('loan_id', null)            // No loan
    .eq('status', 'Unallocated');    // Currently unallocated (by my previous mistake)

  if (err2) console.error('Error fixing matched payments:', err2.message);
  else console.log('✅ Restored "Allocated" status to customer-matched payments.');
  
  console.log('\nRefresh your app to see the changes!');
}

repair();
