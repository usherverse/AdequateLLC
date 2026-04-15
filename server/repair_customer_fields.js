// DATA REPAIR: Migrate customers with data in the old columns (`business`, `location`)
// to the new canonical columns (`business_name`, `business_location`).
//
// The diagnostic showed 96-97% of customers appear blank — but the data IS in the DB
// under the legacy `business` and `location` columns from before the schema migration.
//
// Run with: node server/repair_customer_fields.js

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const PAGE = 200;

async function run() {
  console.log('\n=== CUSTOMER FIELD MIGRATION REPAIR ===\n');
  console.log('Migrating: business → business_name, location → business_location\n');

  let offset = 0;
  let totalFixed = 0;
  let totalSkipped = 0;

  while (true) {
    // Fetch customers that have data in old columns but not in new columns
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, business, location, business_name, business_location, gender, residence, id_no, joined, created_at')
      .range(offset, offset + PAGE - 1)
      .order('id');

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;

    const toUpdate = [];

    for (const c of data) {
      const needsMigration =
        (!c.business_name && c.business) ||
        (!c.business_location && c.location) ||
        (!c.joined && c.created_at);  // backfill joined from created_at for legacy records

      if (needsMigration) {
        toUpdate.push({
          id: c.id,
          business_name: c.business_name || c.business || null,
          business_location: c.business_location || c.location || null,
          // Backfill joined from created_at only if joined is empty
          ...((!c.joined && c.created_at) ? { joined: c.created_at } : {}),
        });
      } else {
        totalSkipped++;
      }
    }

    if (toUpdate.length > 0) {
      console.log(`  Batch ${offset}-${offset + data.length - 1}: updating ${toUpdate.length} records...`);
      let batchOk = 0;
      for (const row of toUpdate) {
        const { id, ...fields } = row;
        const { error: upErr } = await supabase
          .from('customers')
          .update(fields)
          .eq('id', id);
        if (upErr) {
          console.error(`  ❌ Update error for ${id}:`, upErr.message);
        } else {
          batchOk++;
        }
      }
      totalFixed += batchOk;
      console.log(`  ✅ ${batchOk}/${toUpdate.length} records migrated`);
    }

    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log('\n--- Migration Complete ---');
  console.log(`  ✅ Records migrated: ${totalFixed}`);
  console.log(`  ℹ️  Already up-to-date: ${totalSkipped}`);

  // Re-verify after migration
  const { count: stillMissing } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .is('business_name', null);

  console.log(`  Remaining with null business_name: ${stillMissing}`);

  if (stillMissing > 0) {
    console.log('\n  ⚠️  Some records still have null business_name.');
    console.log('  These customers may have genuinely never had a business name entered.');
  } else {
    console.log('\n  ✅ All customers now have business_name populated!');
  }

  console.log('\n=== DONE ===\n');
}

run().catch(console.error);
