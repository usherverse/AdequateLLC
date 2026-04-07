-- ============================================================
-- MIGRATION: Unified Audit Trail — Device & Location Fields
-- Run this in your Supabase SQL Editor → New Query
-- Safe to re-run (all statements use IF NOT EXISTS)
-- ============================================================

-- 1. Add new columns to audit_log
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS device_type  TEXT,   -- 'mobile' | 'tablet' | 'desktop'
  ADD COLUMN IF NOT EXISTS browser      TEXT,   -- 'Chrome' | 'Firefox' | 'Safari' | etc.
  ADD COLUMN IF NOT EXISTS os           TEXT,   -- 'Windows' | 'macOS' | 'Android' | 'iOS'
  ADD COLUMN IF NOT EXISTS ip_address   TEXT,
  ADD COLUMN IF NOT EXISTS country      TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS session_id   TEXT;   -- groups events in one login session

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_device  ON audit_log(device_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts_desc ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user    ON audit_log(user_name);

-- 3. Ensure RLS allows authenticated users (admin) to read all rows
-- (Existing policy may already cover this; safe no-op if so)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log' AND policyname = 'admin_read_all_audit'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY admin_read_all_audit
        ON audit_log
        FOR SELECT
        TO authenticated
        USING (true);
    $pol$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log' AND policyname = 'admin_insert_audit'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY admin_insert_audit
        ON audit_log
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
    $pol$;
  END IF;
END $$;
