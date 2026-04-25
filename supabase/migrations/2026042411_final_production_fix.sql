-- ================================================================
-- FINAL PRODUCTION FIX: All remaining console errors
-- 1. Creates stk_requests and b2c_disbursements tables
-- 2. Fixes audit_log RLS to allow admin DELETE (for Global Wipe)
-- 3. Reloads schema cache
-- ================================================================

-- 1. CREATE stk_requests TABLE
CREATE TABLE IF NOT EXISTS public.stk_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_request_id text,
    checkout_request_id text UNIQUE NOT NULL,
    phone_number text NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference text,
    description text,
    status text DEFAULT 'Pending',
    result_code integer,
    result_desc text,
    mpesa_receipt text,
    transaction_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.stk_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stk_read"   ON public.stk_requests;
DROP POLICY IF EXISTS "stk_insert" ON public.stk_requests;
DROP POLICY IF EXISTS "stk_update" ON public.stk_requests;
CREATE POLICY "stk_read"   ON public.stk_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "stk_insert" ON public.stk_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "stk_update" ON public.stk_requests FOR UPDATE TO authenticated USING (true);
-- Allow service role (Edge Functions) to insert without auth
DROP POLICY IF EXISTS "stk_service_insert" ON public.stk_requests;
CREATE POLICY "stk_service_insert" ON public.stk_requests FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "stk_service_update" ON public.stk_requests;
CREATE POLICY "stk_service_update" ON public.stk_requests FOR UPDATE TO service_role USING (true);


-- 2. CREATE b2c_disbursements TABLE
CREATE TABLE IF NOT EXISTS public.b2c_disbursements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    loan_id text,
    phone_number text,
    amount numeric,
    status text DEFAULT 'Pending',
    conversation_id text,
    receipt text,
    result_desc text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.b2c_disbursements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "b2c_read"   ON public.b2c_disbursements;
DROP POLICY IF EXISTS "b2c_insert" ON public.b2c_disbursements;
DROP POLICY IF EXISTS "b2c_update" ON public.b2c_disbursements;
CREATE POLICY "b2c_read"   ON public.b2c_disbursements FOR SELECT TO authenticated USING (true);
CREATE POLICY "b2c_insert" ON public.b2c_disbursements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "b2c_update" ON public.b2c_disbursements FOR UPDATE TO authenticated USING (true);


-- 3. FIX audit_log RLS — allow admins to DELETE (required by Global Wipe & Restore)
-- First ensure table has RLS enabled
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_delete" ON public.audit_log;
CREATE POLICY "audit_log_delete" ON public.audit_log
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);


-- 4. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
