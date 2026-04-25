-- ================================================================
-- PRODUCTION FIX: Comprehensive Column Parity for stk_requests
-- Ensures ALL columns required by the STK Push logic exist.
-- ================================================================

DO $$ 
BEGIN 
    -- 1. Ensure 'merchant_request_id' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='merchant_request_id') THEN
        ALTER TABLE public.stk_requests ADD COLUMN merchant_request_id TEXT;
    END IF;

    -- 2. Ensure 'checkout_request_id' exists (CRITICAL for Realtime)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='checkout_request_id') THEN
        ALTER TABLE public.stk_requests ADD COLUMN checkout_request_id TEXT;
        -- Add unique constraint if we just added the column
        ALTER TABLE public.stk_requests ADD CONSTRAINT stk_requests_checkout_request_id_key UNIQUE (checkout_request_id);
    END IF;

    -- 3. Ensure 'phone_number' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='phone_number') THEN
        ALTER TABLE public.stk_requests ADD COLUMN phone_number TEXT;
    END IF;

    -- 4. Ensure 'amount' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='amount') THEN
        ALTER TABLE public.stk_requests ADD COLUMN amount NUMERIC(12,2);
    END IF;

    -- 5. Ensure 'reference' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='reference') THEN
        ALTER TABLE public.stk_requests ADD COLUMN reference TEXT;
    END IF;

    -- 6. Ensure 'description' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='description') THEN
        ALTER TABLE public.stk_requests ADD COLUMN description TEXT;
    END IF;

    -- 7. Ensure 'status' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='status') THEN
        ALTER TABLE public.stk_requests ADD COLUMN status TEXT DEFAULT 'Pending';
    END IF;

    -- 8. Ensure 'mpesa_receipt' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='mpesa_receipt') THEN
        ALTER TABLE public.stk_requests ADD COLUMN mpesa_receipt TEXT;
    END IF;

    -- 9. Ensure 'transaction_date' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stk_requests' AND column_name='transaction_date') THEN
        ALTER TABLE public.stk_requests ADD COLUMN transaction_date TIMESTAMPTZ;
    END IF;
END $$;
