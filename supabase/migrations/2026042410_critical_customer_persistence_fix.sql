-- ================================================================
-- CRITICAL FIX: Add ALL columns that toSupabaseCustomer() sends
-- Without these columns, every customer upsert silently fails
-- causing customers to disappear after page refresh.
-- ================================================================

DO $$
BEGIN
  -- Columns sent by toSupabaseCustomer() that may be missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='account_number') THEN
    ALTER TABLE public.customers ADD COLUMN account_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='id_number') THEN
    ALTER TABLE public.customers ADD COLUMN id_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='uses_id_as_account') THEN
    ALTER TABLE public.customers ADD COLUMN uses_id_as_account BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='from_lead') THEN
    ALTER TABLE public.customers ADD COLUMN from_lead TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='gps_coordinates') THEN
    ALTER TABLE public.customers ADD COLUMN gps_coordinates TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='bl_reason') THEN
    ALTER TABLE public.customers ADD COLUMN bl_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='alt_phone') THEN
    ALTER TABLE public.customers ADD COLUMN alt_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='gender') THEN
    ALTER TABLE public.customers ADD COLUMN gender TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='dob') THEN
    ALTER TABLE public.customers ADD COLUMN dob DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='residence') THEN
    ALTER TABLE public.customers ADD COLUMN residence TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_name') THEN
    ALTER TABLE public.customers ADD COLUMN business_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_type') THEN
    ALTER TABLE public.customers ADD COLUMN business_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_location') THEN
    ALTER TABLE public.customers ADD COLUMN business_location TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='documents') THEN
    ALTER TABLE public.customers ADD COLUMN documents JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n1_relation') THEN
    ALTER TABLE public.customers ADD COLUMN n1_relation TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n2_relation') THEN
    ALTER TABLE public.customers ADD COLUMN n2_relation TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='n3_relation') THEN
    ALTER TABLE public.customers ADD COLUMN n3_relation TEXT;
  END IF;
END $$;

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
