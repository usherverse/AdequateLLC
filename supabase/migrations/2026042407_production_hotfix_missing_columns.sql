-- ================================================================
-- PRODUCTION HOTFIX 2: MISSING FRONTEND COLUMNS
-- Ensures the database schema matches the exact columns 
-- requested by the React frontend (lms-core.jsx) on startup.
-- ================================================================

DO $$ 
BEGIN 
    -- 1. LOANS TABLE
    -- Add 'mpesa' to loans if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='mpesa') THEN
        ALTER TABLE public.loans ADD COLUMN mpesa TEXT;
    END IF;

    -- Ensure 'officer' and 'collections_officer' exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='officer') THEN
        ALTER TABLE public.loans ADD COLUMN officer TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='collections_officer') THEN
        ALTER TABLE public.loans ADD COLUMN collections_officer TEXT;
    END IF;

    -- Ensure 'disbursed' exists (sometimes called disbursed_at)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='disbursed') THEN
        ALTER TABLE public.loans ADD COLUMN disbursed TIMESTAMPTZ;
    END IF;

    -- 2. CUSTOMERS TABLE
    -- Add 'blacklisted' to customers if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='blacklisted') THEN
        ALTER TABLE public.customers ADD COLUMN blacklisted BOOLEAN DEFAULT false;
    END IF;

    -- 3. PAYMENTS TABLE
    -- Add 'allocated_by' to payments if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='allocated_by') THEN
        ALTER TABLE public.payments ADD COLUMN allocated_by TEXT;
    END IF;

END $$;

-- 4. ENSURE FULL ACCESS TO STK/B2C TABLES
-- The frontend requests these tables, so they need basic RLS policies
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.stk_requests;
CREATE POLICY "Enable read access for all authenticated users" ON public.stk_requests FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON public.stk_requests;
CREATE POLICY "Enable insert for all authenticated users" ON public.stk_requests FOR INSERT TO authenticated WITH CHECK (true);

-- Ensure b2c_disbursements exists and has policies
CREATE TABLE IF NOT EXISTS public.b2c_disbursements (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    loan_id text,
    phone_number text,
    amount numeric,
    status text DEFAULT 'Pending',
    conversation_id text,
    receipt text,
    result_desc text,
    created_at timestamp with time zone DEFAULT now()
);

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.b2c_disbursements;
CREATE POLICY "Enable read access for all authenticated users" ON public.b2c_disbursements FOR SELECT TO authenticated USING (true);
