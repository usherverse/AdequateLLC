
-- ADEQUATE CAPITAL LMS - INFRASTRUCTURE PATCH v1.9.0
-- Purpose: Support attribution of loans to specifically assigned Collections Officers.

-- 1. Add collections_officer column to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS collections_officer text;

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_loans_collections_officer ON public.loans(collections_officer);

-- 3. Update Audit Log
INSERT INTO public.audit_log (ts, user_name, action, target_id, detail)
VALUES (now(), 'System', 'Infrastructure Patch', 'loans', 'Added collections_officer column to loans table');
