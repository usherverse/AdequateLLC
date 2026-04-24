-- ================================================================
-- PRODUCTION HOTFIX 3: COMPREHENSIVE SCHEMA SYNC
-- Dynamically adds any missing columns requested by the frontend 
-- to prevent 400 Bad Request crashes.
-- ================================================================

DO $$ 
BEGIN 
    -- 1. LOANS TABLE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='customer_name') THEN ALTER TABLE public.loans ADD COLUMN customer_name TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='status') THEN ALTER TABLE public.loans ADD COLUMN status TEXT DEFAULT 'Active'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='repayment_type') THEN ALTER TABLE public.loans ADD COLUMN repayment_type TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='officer') THEN ALTER TABLE public.loans ADD COLUMN officer TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='collections_officer') THEN ALTER TABLE public.loans ADD COLUMN collections_officer TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='risk') THEN ALTER TABLE public.loans ADD COLUMN risk TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='disbursed') THEN ALTER TABLE public.loans ADD COLUMN disbursed TIMESTAMPTZ; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='mpesa') THEN ALTER TABLE public.loans ADD COLUMN mpesa TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='phone') THEN ALTER TABLE public.loans ADD COLUMN phone TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='days_overdue') THEN ALTER TABLE public.loans ADD COLUMN days_overdue INTEGER DEFAULT 0; END IF;

    -- 2. CUSTOMERS TABLE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='id_no') THEN ALTER TABLE public.customers ADD COLUMN id_no TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='officer') THEN ALTER TABLE public.customers ADD COLUMN officer TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='loans') THEN ALTER TABLE public.customers ADD COLUMN loans INTEGER DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='risk') THEN ALTER TABLE public.customers ADD COLUMN risk TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='blacklisted') THEN ALTER TABLE public.customers ADD COLUMN blacklisted BOOLEAN DEFAULT false; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='joined') THEN ALTER TABLE public.customers ADD COLUMN joined TIMESTAMPTZ; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='status') THEN ALTER TABLE public.customers ADD COLUMN status TEXT DEFAULT 'Active'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='assigned_officer') THEN ALTER TABLE public.customers ADD COLUMN assigned_officer UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='mpesa_registered') THEN ALTER TABLE public.customers ADD COLUMN mpesa_registered BOOLEAN DEFAULT false; END IF;
    
    -- NOK Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n1_name') THEN ALTER TABLE public.customers ADD COLUMN n1_name TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n1_phone') THEN ALTER TABLE public.customers ADD COLUMN n1_phone TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n2_name') THEN ALTER TABLE public.customers ADD COLUMN n2_name TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n2_phone') THEN ALTER TABLE public.customers ADD COLUMN n2_phone TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n3_name') THEN ALTER TABLE public.customers ADD COLUMN n3_name TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n3_phone') THEN ALTER TABLE public.customers ADD COLUMN n3_phone TEXT; END IF;

    -- 3. PAYMENTS TABLE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='customer_name') THEN ALTER TABLE public.payments ADD COLUMN customer_name TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='status') THEN ALTER TABLE public.payments ADD COLUMN status TEXT DEFAULT 'Unallocated'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='allocated_by') THEN ALTER TABLE public.payments ADD COLUMN allocated_by TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='is_reg_fee') THEN ALTER TABLE public.payments ADD COLUMN is_reg_fee BOOLEAN DEFAULT false; END IF;

END $$;
