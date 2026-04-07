-- ================================================================
-- MIGRATION: Fix RLS for core tables (loans, customers, payments)
-- Problem: customers and payments return 0 rows in production even
-- though the admin is logged in. Root cause: policies on these      
-- tables use EXISTS(SELECT workers WHERE auth_user_id = auth.uid()) 
-- but the admin Supabase auth UID may not exist in the workers table.
-- Fix: allow all authenticated users to read all rows.
-- ================================================================

-- ── loans ────────────────────────────────────────────────────────
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read loans"  ON loans;
DROP POLICY IF EXISTS "Authenticated users can insert loans" ON loans;
DROP POLICY IF EXISTS "Authenticated users can update loans" ON loans;
DROP POLICY IF EXISTS "Service role full access loans"       ON loans;

CREATE POLICY "Service role full access loans"
  ON loans FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read loans"
  ON loans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert loans"
  ON loans FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update loans"
  ON loans FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ── customers ────────────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read customers"    ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers"  ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers"  ON customers;
DROP POLICY IF EXISTS "Authenticated users can upsert customers"  ON customers;
DROP POLICY IF EXISTS "Service role full access customers"        ON customers;

CREATE POLICY "Service role full access customers"
  ON customers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read customers"
  ON customers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ── payments ─────────────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payments"   ON payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;
DROP POLICY IF EXISTS "Service role full access payments"       ON payments;

CREATE POLICY "Service role full access payments"
  ON payments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read payments"
  ON payments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert payments"
  ON payments FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON payments FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ── workers ──────────────────────────────────────────────────────
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read workers"   ON workers;
DROP POLICY IF EXISTS "Authenticated users can insert workers" ON workers;
DROP POLICY IF EXISTS "Authenticated users can update workers" ON workers;
DROP POLICY IF EXISTS "Service role full access workers"       ON workers;

CREATE POLICY "Service role full access workers"
  ON workers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read workers"
  ON workers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert workers"
  ON workers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update workers"
  ON workers FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ── leads ────────────────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read leads"   ON leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON leads;
DROP POLICY IF EXISTS "Service role full access leads"       ON leads;

CREATE POLICY "Service role full access leads"
  ON leads FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read leads"
  ON leads FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert leads"
  ON leads FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update leads"
  ON leads FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ── interactions ─────────────────────────────────────────────────
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read interactions"   ON interactions;
DROP POLICY IF EXISTS "Authenticated users can insert interactions" ON interactions;
DROP POLICY IF EXISTS "Service role full access interactions"       ON interactions;

CREATE POLICY "Service role full access interactions"
  ON interactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read interactions"
  ON interactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert interactions"
  ON interactions FOR INSERT TO authenticated
  WITH CHECK (true);

-- Verify: list policies on key tables
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('loans','customers','payments','workers','leads','interactions','audit_log')
ORDER BY tablename, cmd;
