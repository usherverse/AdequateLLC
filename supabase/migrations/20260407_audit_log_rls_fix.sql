-- ================================================================
-- MIGRATION: Fix audit_log RLS for cross-device visibility
-- All authenticated users (admin/workers) can read ALL audit rows.
-- Without this, each device only sees its own entries and logs
-- disappear after logout because React state is wiped.
-- Safe to re-run (uses DROP IF EXISTS + CREATE).
-- ================================================================

-- 1. Enable RLS on audit_log if not already enabled
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing restrictive or user-scoped policies that 
--    would cause cross-device filtering.
DROP POLICY IF EXISTS admin_read_all_audit    ON audit_log;
DROP POLICY IF EXISTS admin_insert_audit      ON audit_log;
DROP POLICY IF EXISTS user_read_own_audit     ON audit_log;
DROP POLICY IF EXISTS authenticated_read_audit ON audit_log;

-- 3. Service role: full unrestricted access (used by server-side triggers)
DROP POLICY IF EXISTS service_role_full_audit ON audit_log;
CREATE POLICY service_role_full_audit
  ON audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Authenticated users: READ ALL rows (no user_id filter — this is
--    the critical policy. Without USING (true), each user session would
--    only see rows it inserted, making cross-device audit impossible.)
CREATE POLICY admin_read_all_audit
  ON audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. Authenticated users: INSERT their own audit entries
CREATE POLICY admin_insert_audit
  ON audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6. Anon (unauthenticated): no access
--    (implicitly blocked when RLS is enabled and no anon policy exists)

-- Verify: show current policies
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'audit_log'
ORDER BY policyname;
