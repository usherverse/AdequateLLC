-- ================================================================
-- DATABASE SCHEMA SYNC: B2C DISBURSEMENTS
-- Ensures the b2c_disbursements table has all required columns.
-- Fixes the 'column loan_id does not exist' frontend error.
-- ================================================================

-- 1. Create table if missing
CREATE TABLE IF NOT EXISTS public.b2c_disbursements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Ensure columns exist with correct types
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='loan_id') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN loan_id text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='customer_id') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN customer_id uuid REFERENCES public.customers(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='amount') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN amount numeric(12,2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='phone_number') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN phone_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='conversation_id') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN conversation_id text UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='originator_conversation_id') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN originator_conversation_id text UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='transaction_id') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN transaction_id text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='status') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN status text DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='result_desc') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN result_desc text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='initiated_by') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN initiated_by uuid;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='b2c_disbursements' AND column_name='updated_at') THEN
        ALTER TABLE public.b2c_disbursements ADD COLUMN updated_at timestamp with time zone DEFAULT now();
    END IF;
END $$;

-- 3. RLS
ALTER TABLE public.b2c_disbursements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "b2c_disbursements_read_all" ON public.b2c_disbursements;
CREATE POLICY "b2c_disbursements_read_all" ON public.b2c_disbursements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "b2c_disbursements_insert_all" ON public.b2c_disbursements;
CREATE POLICY "b2c_disbursements_insert_all" ON public.b2c_disbursements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "b2c_disbursements_update_all" ON public.b2c_disbursements;
CREATE POLICY "b2c_disbursements_update_all" ON public.b2c_disbursements FOR UPDATE TO authenticated USING (true);

-- 4. Reload PostgREST to recognize new columns
NOTIFY pgrst, 'reload schema';
