import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: '../.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function setAdminPassword() {
  const email = 'gkadi97@gmail.com';

  console.log(`Setting password for ${email}...`);

  // 1. Get User ID
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing users:', listErr.message);
    return;
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.error(`User ${email} not found in Auth system.`);
    return;
  }

  // 2. Update Password
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: 'Adequate!123', email_confirm: true }
  );

  if (error) {
    console.error('Error updating user:', error.message);
  } else {
    console.log(`SUCCESS: Password for ${email} has been set to Adequate!123`);

    console.log(`User ID: ${user.id}`);
  }
}

setAdminPassword();
