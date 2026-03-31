import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { SEED_CUSTOMERS } from "../src/data/seedData.js";

const env = loadEnv("", process.cwd(), "");
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

function toSupabaseCustomer(c) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    alt_phone: c.altPhone || c.alt_phone || null,
    id_no: c.idNo || c.id_no || null,
    business_name: c.businessName || c.business || c.business_name || null,
    business_type: c.businessType || c.business_type || null,
    business_location: c.businessLocation || c.location || c.business_location || null,
    residence: c.residence || null,
    officer: c.officer || null,
    loans: c.loans || 0,
    risk: c.risk || "Medium",
    gender: c.gender || null,
    dob: c.dob || null,
    blacklisted: !!c.blacklisted,
    bl_reason: c.blReason || c.bl_reason || null,
    from_lead: c.fromLead || c.from_lead || null,
    n1_name: c.n1n || c.n1_name || null,
    n1_phone: c.n1p || c.n1_phone || null,
    n1_relation: c.n1r || c.n1_relation || null,
    n2_name: c.n2n || c.n2_name || null,
    n2_phone: c.n2p || c.n2_phone || null,
    n2_relation: c.n2r || c.n2_relation || null,
    n3_name: c.n3n || c.n3_name || null,
    n3_phone: c.n3p || c.n3_phone || null,
    n3_relation: c.n3r || c.n3_relation || null,
    documents: c.docs || c.documents || [],
    created_at: c.joined || c.createdAt || c.created_at || null,
  };
}

async function main() {
  console.log(`Supabase: ${url}`);
  console.log(`Seed customers: ${SEED_CUSTOMERS.length}`);

  const { count, error: countErr } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true });
  if (countErr) {
    console.error("Unable to access customers table:", countErr.message);
    process.exit(2);
  }
  console.log(`Current customers in DB: ${count ?? 0}`);

  const payload = SEED_CUSTOMERS.map(toSupabaseCustomer);
  const BATCH = 250;
  let upserted = 0;

  for (let i = 0; i < payload.length; i += BATCH) {
    const batch = payload.slice(i, i + BATCH);
    const { error } = await supabase
      .from("customers")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      console.error("Upsert failed:", error.message);
      process.exit(3);
    }
    upserted += batch.length;
    console.log(`Upserted ${upserted}/${payload.length}`);
  }

  const { count: after } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true });
  console.log(`Customers in DB after restore: ${after ?? 0}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(99);
});

