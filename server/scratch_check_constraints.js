import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkConstraints() {
  const { data, error } = await supabase.rpc('get_table_constraints', { t_name: 'customers' });
  if (error) {
    // If RPC doesn't exist, we'll try a different way.
    console.log('RPC Error (likely does not exist):', error.message);
    
    // Attempting to brute-force check by trying to insert a dummy duplicate
    console.log('Attempting brute-force duplicate check...');
    const dummyId = 'check_' + Date.now();
    const { error: insErr } = await supabase.from('customers').insert([{
        id: dummyId,
        name: 'Constraint Check',
        phone: 'DUPLICATE_TEST',
        id_no: 'DUPLICATE_TEST'
    }]);
    
    if (insErr) { console.log('Insert Error:', insErr.message); }
    
    const { error: dupErr } = await supabase.from('customers').insert([{
        id: dummyId + '_2',
        name: 'Constraint Check 2',
        phone: 'DUPLICATE_TEST',
        id_no: 'DUPLICATE_TEST'
    }]);
    
    if (dupErr && dupErr.code === '23505') {
        console.log('✅ SUCCESS: Database HAS Unique Constraints on Phone/ID (Error 23505 detected)');
    } else {
        console.log('⚠️ WARNING: Database ALLOWED duplicates or returned non-unique error:', dupErr?.message || 'No error');
    }
    
    // Cleanup
    await supabase.from('customers').delete().ilike('name', 'Constraint Check%');
  } else {
    console.log('Constraints:', data);
  }
}

checkConstraints();
