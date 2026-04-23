import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bgcnenjnrnicsmnyvqhq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY25lbmpucm5pY3Ntbnl2cWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTc0NDAsImV4cCI6MjA5MDk3MzQ0MH0.RdOfuL_lV0hv8ZgjnNVE-1PtMCVK4HhjRySsEU19g3g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function dump() {
    const { data, error } = await supabase.from('customers').select('*').limit(5);
    console.log('Customers Dump:', JSON.stringify(data, null, 2));
    
    const { data: loans } = await supabase.from('loans').select('*').limit(5);
    console.log('Loans Dump:', JSON.stringify(loans, null, 2));
}

dump();
