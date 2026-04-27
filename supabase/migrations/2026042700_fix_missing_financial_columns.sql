-- ================================================================
-- MIGRATION: Fix Missing Financial Columns (Critical for Payments)
-- Ensures the 'loans' table has all columns required by the 
-- master trigger function 'apply_payment_to_loan()'.
-- ================================================================

DO $$ 
BEGIN 
    -- 1. LOANS TABLE
    -- 'penalties' is used in the master trigger waterfall. If missing, all allocated payments fail.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='penalties') THEN 
        ALTER TABLE public.loans ADD COLUMN penalties DECIMAL(15,2) DEFAULT 0; 
    END IF;

    -- 'balance' is the principal + interest remaining
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='balance') THEN 
        ALTER TABLE public.loans ADD COLUMN balance DECIMAL(15,2) DEFAULT 0; 
    END IF;

    -- 'settled_at' is used to track completion
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='settled_at') THEN 
        ALTER TABLE public.loans ADD COLUMN settled_at TIMESTAMPTZ; 
    END IF;

    -- 2. PAYMENTS TABLE
    -- Ensure columns used in triggers exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='loan_id') THEN 
        ALTER TABLE public.payments ADD COLUMN loan_id TEXT; 
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='amount') THEN 
        ALTER TABLE public.payments ADD COLUMN amount DECIMAL(15,2) DEFAULT 0; 
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='status') THEN 
        ALTER TABLE public.payments ADD COLUMN status TEXT DEFAULT 'Unallocated'; 
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='note') THEN 
        ALTER TABLE public.payments ADD COLUMN note TEXT; 
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='is_reg_fee') THEN 
        ALTER TABLE public.payments ADD COLUMN is_reg_fee BOOLEAN DEFAULT false; 
    END IF;

END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
