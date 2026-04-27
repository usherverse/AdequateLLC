-- ================================================================
-- MIGRATION: Add Note and Is_Reg_Fee Columns to Payments
-- Required for manual allocation and proper system categorization.
-- ================================================================

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='note') THEN 
        ALTER TABLE public.payments ADD COLUMN note TEXT; 
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='is_reg_fee') THEN 
        ALTER TABLE public.payments ADD COLUMN is_reg_fee BOOLEAN DEFAULT false; 
    END IF;

    -- Ensure 'id' has a default value for SQL-based insertions
    ALTER TABLE public.payments ALTER COLUMN id SET DEFAULT ('PAY-' || upper(substring(gen_random_uuid()::text from 1 for 8)));
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
