import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bgcnenjnrnicsmnyvqhq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY25lbmpucm5pY3Ntbnl2cWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTc0NDAsImV4cCI6MjA5MDk3MzQ0MH0.RdOfuL_lV0hv8ZgjnNVE-1PtMCVK4HhjRySsEU19g3g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    const { data, error } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');

    if (error) {
        // Fallback for when pg_tables is restricted
        const tables = ['customers', 'loans', 'payments', 'leads', 'workers', 'interactions', 'repossessed_assets'];
        for (const t of tables) {
            const { count, error: countErr } = await supabase.from(t).select('*', { count: 'exact', head: true });
            console.log(`Table ${t}: ${countErr ? 'Error' : count + ' rows'}`);
        }
        return;
    }

    console.log('Tables:', data);
}

listTables();
