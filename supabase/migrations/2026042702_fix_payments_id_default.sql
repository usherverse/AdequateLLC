-- ================================================================
-- MIGRATION: Fix Payments ID Default
-- Ensures SQL-based insertions (RPCs) don't fail for missing IDs.
-- ================================================================

ALTER TABLE public.payments ALTER COLUMN id SET DEFAULT ('PAY-' || upper(substring(gen_random_uuid()::text from 1 for 8)));

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
