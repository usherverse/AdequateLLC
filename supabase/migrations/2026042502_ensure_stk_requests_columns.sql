-- ================================================================
-- PRODUCTION FIX: Ensure missing columns in stk_requests
-- ================================================================

DO $$ 
BEGIN 
    -- 1. Ensure 'created_at' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='created_at') THEN
        ALTER TABLE public.stk_requests ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- 2. Ensure 'result_desc' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='result_desc') THEN
        ALTER TABLE public.stk_requests ADD COLUMN result_desc TEXT;
    END IF;

    -- 3. Ensure 'result_code' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='result_code') THEN
        ALTER TABLE public.stk_requests ADD COLUMN result_code INTEGER;
    END IF;

    -- 4. Ensure 'updated_at' exists (consistency)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='updated_at') THEN
        ALTER TABLE public.stk_requests ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;
