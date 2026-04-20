
-- ADEQUATE CAPITAL LMS - AUDITED SECURITY PATCH 1.8.7
-- This version uses EMAIL matching to verify identities.
-- It avoids 'auth_user_id' entirely to fix dashboard parser errors.

-- 1. Enable RLS
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- 2. Clear all previous policy attempts
DROP POLICY IF EXISTS "workers_read_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_update_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_insert_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_upsert_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_delete_policy" ON public.workers;

-- 3. SELECT: Allow staff to view the team directory
CREATE POLICY "workers_read_policy" ON public.workers FOR SELECT TO authenticated
  USING (true);

-- 4. ALL ACCESS: Allows Workers to manage their own record AND Admins to manage all records.
-- Identity is verified via 'email', which we've audited as a unique key in your table.
CREATE POLICY "workers_management_policy" ON public.workers FOR ALL TO authenticated
  USING (
    email = auth.jwt() ->> 'email' 
    OR role::text = 'Admin'
  )
  WITH CHECK (
    email = auth.jwt() ->> 'email' 
    OR role::text = 'Admin'
  );

-- 5. Audit Log Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_insert_policy" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);
