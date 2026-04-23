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

async function forceProvisionAdmin(email) {
  console.log(`\n--- Force Provisioning: ${email} ---`);

  // 1. Check if user exists
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing users:', listErr.message);
    return;
  }

  const user = users.find(u => u.email === email);

  if (user) {
    console.log(`User exists (ID: ${user.id}). Updating password and confirming...`);
    const { error } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: 'Adequate!123', email_confirm: true }
    );
    if (error) console.error('Update Error:', error.message);
    else console.log(`SUCCESS: ${email} updated.`);
  } else {
    console.log(`User does not exist. Creating new account...`);
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: 'Adequate!123',
      email_confirm: true
    });
    if (createErr) console.error('Creation Error:', createErr.message);
    else console.log(`SUCCESS: ${email} created with ID: ${newUser.user.id}`);
  }
}

async function run() {
  await forceProvisionAdmin('gkadi97@gmail.com');
  await forceProvisionAdmin('ushurverse@gmail.com');
  console.log('\nAll Master Admins are now ready with password: Adequate!123');
}

run();
