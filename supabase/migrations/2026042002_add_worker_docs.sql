
-- ADEQUATE CAPITAL LMS - INFRASTRUCTURE PATCH v1.8.8
-- Purpose: Enable persistence for worker compliance documents.
-- Root Cause: 'docs' column was missing in Postgres, leading to silent persistence failures.

-- 1. Add docs column if it doesn't exist
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS docs jsonb DEFAULT '[]'::jsonb;

-- 2. Verify RLS grants (Audit)
-- The existing 'workers_management_policy' already allows workers to manage their own record.
-- Just ensuring the column is selectable.
GRANT SELECT, INSERT, UPDATE ON public.workers TO authenticated;

-- 3. Document the fix in audit logs
INSERT INTO public.audit_log (ts, user_name, action, target_id, detail)
VALUES (now(), 'System', 'Infrastructure Patch', 'workers', 'Added missing docs JSONB column to workers table');
