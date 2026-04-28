-- ================================================================
-- FIX: CUSTOMER MISSING FIELDS PERSISTENCE
-- Ensures that gender, NOK relations, and assigned officer IDs
-- are correctly stored and retrieved.
-- ================================================================

DO $$ 
BEGIN 
    -- 1. Ensure Gender Column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='gender') THEN
        ALTER TABLE public.customers ADD COLUMN gender TEXT;
    END IF;

    -- 2. Ensure NOK Relationship Columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n1_relation') THEN
        ALTER TABLE public.customers ADD COLUMN n1_relation TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n2_relation') THEN
        ALTER TABLE public.customers ADD COLUMN n2_relation TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n3_relation') THEN
        ALTER TABLE public.customers ADD COLUMN n3_relation TEXT;
    END IF;

    -- 3. Ensure Assigned Officer (UUID) Column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='assigned_officer') THEN
        ALTER TABLE public.customers ADD COLUMN assigned_officer UUID;
    END IF;

    -- 4. Ensure id_no vs id_number parity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='id_no') THEN
        ALTER TABLE public.customers ADD COLUMN id_no TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='id_number') THEN
        ALTER TABLE public.customers ADD COLUMN id_number TEXT;
    END IF;

END $$;
