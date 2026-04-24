-- 1. Customers Table Updates
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_number text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS uses_id_as_account boolean DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_id_number ON public.customers(id_number);
CREATE INDEX IF NOT EXISTS idx_customers_account_number ON public.customers(account_number);

-- Ensure id_number is unique (only if not null to allow multiple nulls)
-- However, Kenyan IDs are usually mandatory for fintech.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_id_number_unique') THEN
        ALTER TABLE public.customers ADD CONSTRAINT customers_id_number_unique UNIQUE (id_number);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_account_number_unique') THEN
        ALTER TABLE public.customers ADD CONSTRAINT customers_account_number_unique UNIQUE (account_number);
    END IF;
END $$;

-- 2. Mpesa Transactions Table (PART 3)
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    trans_id text UNIQUE NOT NULL,
    trans_time timestamp with time zone,
    trans_amount numeric(10,2) NOT NULL,
    bill_ref_number text,
    msisdn text,
    first_name text,
    last_name text,
    business_short_code text,
    allocation_status text CHECK (allocation_status IN ('allocated', 'unallocated')),
    allocation_method text CHECK (allocation_method IN ('account_number', 'phone', 'name')),
    customer_id text REFERENCES public.customers(id),
    allocated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    raw_payload jsonb
);

-- 3. Unallocated Payments Table (PART 3 Spec)
DO $$
BEGIN
    -- If it exists from previous basic migration, we'll keep it but ensure columns align
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'unallocated_payments') THEN
        ALTER TABLE public.unallocated_payments ADD COLUMN IF NOT EXISTS mpesa_transaction_id uuid REFERENCES public.mpesa_transactions(id);
        ALTER TABLE public.unallocated_payments ADD COLUMN IF NOT EXISTS reason text;
        ALTER TABLE public.unallocated_payments ADD COLUMN IF NOT EXISTS reviewed boolean DEFAULT false;
        ALTER TABLE public.unallocated_payments ADD COLUMN IF NOT EXISTS reviewed_by text;
        ALTER TABLE public.unallocated_payments ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;
        ALTER TABLE public.unallocated_payments ADD COLUMN IF NOT EXISTS manually_allocated_to text REFERENCES public.customers(id);
    ELSE
        CREATE TABLE public.unallocated_payments (
            id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
            mpesa_transaction_id uuid REFERENCES public.mpesa_transactions(id),
            reason text,
            reviewed boolean DEFAULT false,
            reviewed_by text,
            reviewed_at timestamp with time zone,
            manually_allocated_to text REFERENCES public.customers(id),
            created_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- RLS
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role all on mpesa_transactions" ON public.mpesa_transactions;
CREATE POLICY "Allow service role all on mpesa_transactions" ON public.mpesa_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated view mpesa_transactions" ON public.mpesa_transactions;
CREATE POLICY "Allow authenticated view mpesa_transactions" ON public.mpesa_transactions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.unallocated_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role all on unallocated_payments" ON public.unallocated_payments;
CREATE POLICY "Allow service role all on unallocated_payments" ON public.unallocated_payments FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated view unallocated_payments" ON public.unallocated_payments;
CREATE POLICY "Allow authenticated view unallocated_payments" ON public.unallocated_payments FOR SELECT TO authenticated USING (true);

-- Migration logic for existing customers:
-- We don't overwrite existing account numbers.
-- But the requirement is: "Adds a boolean flag uses_id_as_account... Marks all newly created customers as migrated = true"
-- This will be handled in the application logic.
