import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://bgcnenjnrnicsmnyvqhq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY25lbmpucm5pY3Ntbnl2cWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTc0NDAsImV4cCI6MjA5MDk3MzQ0MH0.RdOfuL_lV0hv8ZgjnNVE-1PtMCVK4HhjRySsEU19g3g');

async function checkAudit() {
  const { data, error } = await supabase.from('audit_log').select('*').order('ts', { ascending: false }).limit(20);
  if (error) {
    console.error('Error fetching audit:', error);
  } else {
    console.log('Recent Audit Logs:');
    data.forEach(a => console.log(`[${a.ts}] ${a.user_name}: ${a.action} - ${a.detail}`));
  }
}

checkAudit();
