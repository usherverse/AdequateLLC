-- ================================================================
-- PRODUCTION HOTFIX 4: MISSING TABLES (STK & B2C)
-- Ensures stk_requests and b2c_disbursements actually exist.
-- Fixes the remaining 400 Bad Request errors.
-- ================================================================

-- Create stk_requests if it doesn't exist (Using gen_random_uuid() to avoid extension schema issues)
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

-- Basic RLS for stk_requests
ALTER TABLE public.stk_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stk_requests_read" ON public.stk_requests;
CREATE POLICY "stk_requests_read" ON public.stk_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "stk_requests_insert" ON public.stk_requests;
CREATE POLICY "stk_requests_insert" ON public.stk_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "stk_requests_update" ON public.stk_requests;
CREATE POLICY "stk_requests_update" ON public.stk_requests FOR UPDATE TO authenticated USING (true);


-- Create b2c_disbursements if it doesn't exist
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

-- Basic RLS for b2c_disbursements
ALTER TABLE public.b2c_disbursements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "b2c_disbursements_read" ON public.b2c_disbursements;
CREATE POLICY "b2c_disbursements_read" ON public.b2c_disbursements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "b2c_disbursements_insert" ON public.b2c_disbursements;
CREATE POLICY "b2c_disbursements_insert" ON public.b2c_disbursements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "b2c_disbursements_update" ON public.b2c_disbursements;
CREATE POLICY "b2c_disbursements_update" ON public.b2c_disbursements FOR UPDATE TO authenticated USING (true);


-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
