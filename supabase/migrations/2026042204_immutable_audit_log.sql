-- ================================================================
-- MIGRATION: Make audit_log immutable (VULN-09 fix)
-- Problem: The 20260421_fix_restore_rls migration granted DELETE to
--          all authenticated users on audit_log, allowing any insider
--          to erase evidence of fraudulent activity after the fact.
-- Fix:
--   1. Drop the DELETE policy added in the previous migration.
--   2. Add a Postgres-level trigger that REJECTS any DELETE or UPDATE
--      on audit_log, regardless of the caller's role. Even service_role
--      cannot delete rows through normal SQL — only a superuser can,
--      establishing a true immutable chain of custody.
-- ================================================================

-- 1. Remove the destructive DELETE policy that was added for restoration ops.
--    Restoration should never need to wipe the audit trail.
DROP POLICY IF EXISTS "Allow authenticated delete audit_log"  ON public.audit_log;
DROP POLICY IF EXISTS "Allow authenticated delete audit_logs" ON public.audit_log;

-- 2. Explicitly confirm no UPDATE policy exists for authenticated users.
DROP POLICY IF EXISTS "Allow authenticated update audit_log"  ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated users can update audit_log" ON public.audit_log;

-- 3. Immutability trigger function
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_log is immutable. Rows may only be inserted, never modified or deleted. '
    'Operation: %, Table: audit_log', TG_OP;
  RETURN NULL;
END;
$$;

-- 4. Attach trigger — fires BEFORE any DELETE or UPDATE attempt
--    FOR EACH ROW ensures it fires even for bulk operations.
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE DELETE OR UPDATE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 5. Re-confirm the only allowed operations for authenticated users are
--    SELECT and INSERT (the RLS from 20260407_audit_log_rls_fix.sql is kept).
--    Explicitly revoke DELETE from all non-superuser roles.
REVOKE DELETE ON public.audit_log FROM authenticated;
REVOKE DELETE ON public.audit_log FROM anon;
REVOKE UPDATE ON public.audit_log FROM authenticated;
REVOKE UPDATE ON public.audit_log FROM anon;

-- Note: service_role still has full access via its existing policy, but the
-- trigger above will also block it at the row level. This is intentional —
-- the audit log should be immutable for ALL automated processes.
-- Only a direct superuser DB session can remove rows (emergency ops only).

COMMENT ON TABLE public.audit_log IS
  'Immutable financial audit trail. Rows are append-only — '
  'modification and deletion are blocked at the trigger level (VULN-09 fix).';

-- Verify: confirm trigger is attached
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'audit_log'
ORDER BY trigger_name;
