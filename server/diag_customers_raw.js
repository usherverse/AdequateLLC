// Quick check: show a raw sample of customers with their actual stored data
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Sample customers with AND without business_name to compare raw rows
  const { data: withBiz } = await supabase.from('customers').select('*').not('business_name', 'is', null).limit(3);
  const { data: noBiz }   = await supabase.from('customers').select('*').is('business_name', null).not('name', 'is', null).limit(3);

  console.log('\n=== CUSTOMERS *WITH* business_name ===');
  (withBiz || []).forEach(c => {
    console.log(`[${c.id}] ${c.name}`);
    console.log(`  business:          ${c.business}`);
    console.log(`  business_name:     ${c.business_name}`);
    console.log(`  location:          ${c.location}`);
    console.log(`  business_location: ${c.business_location}`);
    console.log(`  gender:            ${c.gender}`);
    console.log(`  residence:         ${c.residence}`);
    console.log(`  n1_name:           ${c.n1_name}`);
    console.log(`  joined:            ${c.joined}`);
    console.log(`  created_at:        ${c.created_at}`);
    console.log('');
  });

  console.log('\n=== CUSTOMERS *WITHOUT* business_name ===');
  (noBiz || []).forEach(c => {
    console.log(`[${c.id}] ${c.name}`);
    console.log(`  business:          ${c.business}`);
    console.log(`  business_name:     ${c.business_name}`);
    console.log(`  location:          ${c.location}`);
    console.log(`  business_location: ${c.business_location}`);
    console.log(`  gender:            ${c.gender}`);
    console.log(`  residence:         ${c.residence}`);
    console.log(`  n1_name:           ${c.n1_name}`);
    console.log(`  joined:            ${c.joined}`);
    console.log(`  created_at:        ${c.created_at}`);
    console.log('');
  });

  // Count how many have at least SOME data across old OR new columns
  const { count: hasAnyBiz } = await supabase.from('customers').select('*', { count: 'exact', head: true })
    .or('business_name.not.is.null,business.not.is.null');
  const { count: hasGender } = await supabase.from('customers').select('*', { count: 'exact', head: true }).not('gender', 'is', null);
  const { count: hasN1 }     = await supabase.from('customers').select('*', { count: 'exact', head: true }).not('n1_name', 'is', null);
  const { count: total }     = await supabase.from('customers').select('*', { count: 'exact', head: true });

  console.log('\n=== COMBINED (old OR new columns) ===');
  console.log(`Total customers:                  ${total}`);
  console.log(`Have ANY business info (either):  ${hasAnyBiz} (${pct(hasAnyBiz, total)}%)`);
  console.log(`Have gender:                      ${hasGender} (${pct(hasGender, total)}%)`);
  console.log(`Have Next of Kin 1:               ${hasN1} (${pct(hasN1, total)}%)`);
}
function pct(n, t) { return t ? Math.round(n/t*100) : 0; }
run().catch(console.error);
