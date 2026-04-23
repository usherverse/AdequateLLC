import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bgcnenjnrnicsmnyvqhq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY25lbmpucm5pY3Ntbnl2cWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTc0NDAsImV4cCI6MjA5MDk3MzQ0MH0.RdOfuL_lV0hv8ZgjnNVE-1PtMCVK4HhjRySsEU19g3g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { data, error } = await supabase
        .from('customers')
        .select('name, n1_name, n1_phone')
        .not('n1_name', 'is', null)
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Results:', JSON.stringify(data, null, 2));
}

checkData();
