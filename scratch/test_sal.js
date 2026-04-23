import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://bgcnenjnrnicsmnyvqhq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnY25lbmpucm5pY3Ntbnl2cWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTc0NDAsImV4cCI6MjA5MDk3MzQ0MH0.RdOfuL_lV0hv8ZgjnNVE-1PtMCVK4HhjRySsEU19g3g');

async function testSal() {
  const { count, error } = await supabase.from('salary_payments').select('*', { count: 'exact', head: true });
  console.log('Salary Payments Count:', count);
}

testSal();
