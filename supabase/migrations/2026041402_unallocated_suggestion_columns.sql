-- 20260414_unallocated_suggestion_columns.sql
-- Adds suggested_customer_id and suggested_customer_name to unallocated_payments.
-- These are populated when the allocation engine finds a partial name match (score 80)
-- but decides NOT to auto-allocate — requiring admin confirmation instead.

ALTER TABLE unallocated_payments
  ADD COLUMN IF NOT EXISTS suggested_customer_id   TEXT REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggested_customer_name TEXT;

COMMENT ON COLUMN unallocated_payments.suggested_customer_id   IS 'Set when a partial name match is found but not auto-allocated. Admin must confirm.';
COMMENT ON COLUMN unallocated_payments.suggested_customer_name IS 'Cached display name of the suggested customer for the admin UI.';
