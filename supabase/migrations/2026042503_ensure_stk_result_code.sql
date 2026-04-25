-- ================================================================
-- PRODUCTION FIX: Ensure result_code in stk_requests
-- ================================================================

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='result_code') THEN
        ALTER TABLE public.stk_requests ADD COLUMN result_code INTEGER;
    END IF;
END $$;
