import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://bgcnenjnrnicsmnyvqhq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY25lbmpucm5pY3Ntbnl2cWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTc0NDAsImV4cCI6MjA5MDk3MzQ0MH0.RdOfuL_lV0hv8ZgjnNVE-1PtMCVK4HhjRySsEU19g3g');

async function checkLeads() {
  const { data, error, count } = await supabase.from('leads').select('*', { count: 'exact' });
  if (error) {
    console.error('Error fetching leads:', error);
  } else {
    console.log(`Found ${count} leads.`);
    if (data && data.length > 0) {
      console.log('Sample lead:', data[0]);
    }
  }
}

checkLeads();
