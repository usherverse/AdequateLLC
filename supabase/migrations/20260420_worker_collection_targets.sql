
-- ADEQUATE CAPITAL LMS - INFRASTRUCTURE PATCH v1.8.9
-- Purpose: Support tiered collection-based commissions for Collections Officers.

-- 1. Add collection_target column to workers table
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS collection_target numeric(15,2) DEFAULT 500000;

-- 2. Ensure RLS allows workers to view their own target
-- This is already covered by the broad workers select policies.

-- 3. Document the fix in audit logs
INSERT INTO public.audit_log (ts, user_name, action, target_id, detail)
VALUES (now(), 'System', 'Infrastructure Patch', 'workers', 'Added collection_target column to workers table for tiered performance pay');
