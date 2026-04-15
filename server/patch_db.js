import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' }); // Assuming run from root

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function patch() {
  console.log('--- Database Patching & Recovery ---');
  
  // 1. Ensure loan_id exists in b2c_disbursements
  const { error: colErr } = await supabase.rpc('exec_sql', { 
    query: 'ALTER TABLE public.b2c_disbursements ADD COLUMN IF NOT EXISTS loan_id text;' 
  });
  if (colErr) {
    console.error('1. Adding loan_id column FAILED. Run this SQL manually in Supabase:');
    console.log('\n   ALTER TABLE public.b2c_disbursements ADD COLUMN IF NOT EXISTS loan_id text;\n');
  } else {
    console.log('1. Adding loan_id column: Success');
  }

  // 2. Recovery: Reset any loans stuck in "Disbursing" for more than 4 hours back to "Approved"
  // This allows the admin to retry them.
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { data: stuck, error: stuckErr } = await supabase
    .from('loans')
    .update({ status: 'Approved', disbursed: null })
    .eq('status', 'Disbursing')
    .lt('created_at', fourHoursAgo) // Simplified: if they are old and Disbursing, they are stuck
    .select('id');

  if (stuckErr) console.error('2. Recovery Error:', stuckErr.message);
  else console.log(`2. Recovered ${stuck?.length || 0} stuck loans.`);
}
patch();
