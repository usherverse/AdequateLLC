import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { supabase } from './config/db.js';

async function checkB2C() {
  const { data, error } = await supabase
    .from('b2c_disbursements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) console.error('Error:', error);
  else {
    console.log('=== Latest B2C Disbursements ===');
    data.forEach(d => {
      console.log(`Loan ID: ${d.loan_id} | Phone: ${d.phone_number} | Status: ${d.status} | Code: ${d.result_code} | Desc: ${d.result_desc}`);
    });
  }
}

checkB2C();
