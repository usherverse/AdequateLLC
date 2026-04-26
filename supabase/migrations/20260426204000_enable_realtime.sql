-- ================================================================
-- REALTIME SETUP: PAYBILL BALANCE
-- Ensures the paybill_balance table is broadcast via Realtime.
-- ================================================================

-- 1. Ensure table is in the realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'paybill_balance'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.paybill_balance;
    END IF;
END $$;

-- 2. Set replica identity to FULL so we get all columns in the update event
ALTER TABLE public.paybill_balance REPLICA IDENTITY FULL;

-- 3. Reload PostgREST (optional but good practice)
NOTIFY pgrst, 'reload schema';
