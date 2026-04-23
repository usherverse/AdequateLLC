
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function scan() {
  console.log('🚀 Adequate Capital Security Scanner Started...');
  
  // 1. Check for exec_sql vulnerability
  console.log('\n--- Checking for exec_sql vulnerability ---');
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: 'SELECT 1;' });
    if (error) {
       console.log('✅ exec_sql is restricted or does not exist (Safe).');
    } else {
       console.log('❌ CRITICAL: exec_sql function EXISTS and is accessible via Service Role.');
       console.log('   Checking if it is accessible to public...');
       // In a real scan we would try calling it with an anon key, but we don't have it easily here.
    }
  } catch (e) {
    console.log('✅ exec_sql call failed (Safe).');
  }

  // 2. Check is_admin() definition
  console.log('\n--- Checking is_admin() helper ---');
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
       console.warn('⚠️ is_admin() check returned error:', error.message);
    } else {
       console.log('✅ is_admin() function exists. Result:', data);
    }
  } catch (e) {
    console.warn('⚠️ is_admin() check failed catch.');
  }

  // 3. Scan for Public Buckets
  console.log('\n--- Checking Storage Buckets ---');
  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) {
       console.error('❌ Could not list buckets:', bErr.message);
    } else {
       buckets.forEach(b => {
         console.log(`- Bucket: ${b.name} | Public: ${b.public}`);
         if (b.public && (b.name === 'documents' || b.name === 'worker-docs' || b.name === 'kyc')) {
            console.log(`  ❌ CRITICAL: Sensitive bucket "${b.name}" is PUBLIC!`);
         }
       });
    }
  } catch (e) {
    console.error('❌ Storage check failed.');
  }

  console.log('\n--- Scan Complete ---');
}

scan();
