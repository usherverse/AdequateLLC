import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { supabase } from './config/db.js';

async function fixStuckLoans() {
  console.log('Fetching stuck loans...');
  const { data: stuckLoans, error } = await supabase
    .from('loans')
    .select('id, status')
    .eq('status', 'Disbursing');

  if (error) {
    console.error('Error fetching loans:', error);
    process.exit(1);
  }

  if (!stuckLoans || stuckLoans.length === 0) {
    console.log('No stuck loans found.');
    process.exit(0);
  }

  console.log(`Found ${stuckLoans.length} stuck loans. Reverting to Approved...`);

  for (const loan of stuckLoans) {
    const { error: updateError } = await supabase
      .from('loans')
      .update({ status: 'Approved', disbursed: null })
      .eq('id', loan.id);
    
    if (updateError) {
      console.error(`Failed to revert loan ${loan.id}:`, updateError.message);
    } else {
      console.log(`Loan ${loan.id} reverted to Approved.`);
    }
  }

  console.log('Done!');
  process.exit(0);
}

fixStuckLoans();
