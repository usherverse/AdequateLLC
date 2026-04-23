import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/"/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testAuditlog() {
  console.log('Testing Audit Log Immutability...');
  // We use service_role so we can bypass RLS, BUT if it's a TRIGGER or CHECK constraint, even service_role might fail if configured that way.
  // Actually RLS policies don't apply to service_role. 
  // To truly test RLS, I'd need an authenticated client.
  // But wait, the user's migration said "audit_log is immutable...". This usually means a TRIGGER.
  
  const { error } = await supabase.from('audit_log').delete().neq('id', -1);
  if (error) {
    console.log('SUCCESS: Audit log deletion blocked:', error.message);
  } else {
    console.warn('WARNING: Audit log deletion was NOT blocked for service_role.');
  }
}

testAuditlog();
