
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bgcnenjnrnicsmnyvqhq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY25lbmpucm5pY3Ntbnl2cWhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM5NzQ0MCwiZXhwIjoyMDkwOTczNDQwfQ.v7Gw8Sfx81NdFxaW-QBS0O7iOcaFql5j4hW0De2bKJE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { count, error } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  if (error) {
    console.error(error);
  } else {
    console.log('Total Customers:', count);
    const { data } = await supabase.from('customers').select('name, n1_name').not('n1_name', 'is', null).limit(5);
    console.log('Sample with NOK:', JSON.stringify(data, null, 2));
  }
}

check();
