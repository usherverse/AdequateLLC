import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const result = await supabase.from('b2c_disbursements').insert([
    {
      loan_id: 'LN-TEST',
      customer_id: 'CUS-TEST',
      amount: 100,
      phone_number: '254712345678',
      conversation_id: 'conv_123',
      originator_conversation_id: 'orig_123',
      status: 'Pending'
    }
  ]);
  console.log('Insert Result:', result.error || 'Success');
}
check();
