-- ================================================================
-- PRODUCTION HOTFIX: RLS & SCHEMA ALIGNMENT
-- Fixes "auth_user_id" errors and ensures column parity for Payments Hub
-- ================================================================

-- 1. Ensure 'payments' table matches current application expectations
DO $$ 
BEGIN 
    -- Add is_reg_fee if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='is_reg_fee') THEN
        ALTER TABLE public.payments ADD COLUMN is_reg_fee BOOLEAN DEFAULT false;
    END IF;

    -- Standardize mpesa column (legacy mpesa_code vs modern mpesa)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='mpesa_code') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='mpesa') THEN
        ALTER TABLE public.payments RENAME COLUMN mpesa_code TO mpesa;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='mpesa') THEN
        ALTER TABLE public.payments ADD COLUMN mpesa TEXT;
    END IF;
END $$;

-- 2. Fix STK Requests tracking parity
CREATE TABLE IF NOT EXISTS public.stk_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
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

-- 3. FIX RLS POLICIES (Handle auth_user_id vs id discrepancy)
-- This function dynamically detects which column to use to avoid "column does not exist" errors
CREATE OR REPLACE FUNCTION public.check_worker_role(p_role_list TEXT[]) 
RETURNS BOOLEAN AS $$
DECLARE
    v_has_auth_user_id BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='workers' AND column_name='auth_user_id'
    ) INTO v_has_auth_user_id;

    IF v_has_auth_user_id THEN
        RETURN EXISTS (
            SELECT 1 FROM public.workers 
            WHERE auth_user_id = auth.uid() 
            AND (role::text = ANY(p_role_list))
        );
    ELSE
        RETURN EXISTS (
            SELECT 1 FROM public.workers 
            WHERE id = auth.uid() 
            AND (role::text = ANY(p_role_list))
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply storage policies with the new robust check
-- First, ensure the 'documents' bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- SELECT: All authenticated staff can view
DROP POLICY IF EXISTS "Allow Authenticated View" ON storage.objects;
CREATE POLICY "Allow Authenticated View" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

-- INSERT: All authenticated staff can upload
DROP POLICY IF EXISTS "Allow Authenticated Upload" ON storage.objects;
CREATE POLICY "Allow Authenticated Upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

-- DELETE: Only Admins can delete
DROP POLICY IF EXISTS "Allow Admins to Delete" ON storage.objects;
CREATE POLICY "Allow Admins to Delete" ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'documents' AND 
    public.check_worker_role(ARRAY['Admin', 'Super Admin'])
);

-- UPDATE: Only Admins can update
DROP POLICY IF EXISTS "Allow Admins to Update" ON storage.objects;
CREATE POLICY "Allow Admins to Update" ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'documents' AND 
    public.check_worker_role(ARRAY['Admin', 'Super Admin'])
);

-- 5. Fix the core 'payments' RLS which might also be using the broken check
DROP POLICY IF EXISTS "View Payments" ON public.payments;
CREATE POLICY "View Payments" ON public.payments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert Payments" ON public.payments;
CREATE POLICY "Insert Payments" ON public.payments FOR INSERT TO authenticated 
WITH CHECK (public.check_worker_role(ARRAY['Admin', 'Finance', 'Collections Officer', 'Loan Officer', 'Super Admin']) OR (current_setting('request.jwt.claim.role', true) = 'service_role'));
