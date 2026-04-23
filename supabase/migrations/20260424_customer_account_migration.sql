-- 20260424_customer_account_migration.sql
-- PART 1: ACCOUNT NUMBER MIGRATION

-- 1. Add new fields if they don't exist
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS uses_id_as_account BOOLEAN DEFAULT false;

-- 2. Add indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_id_number ON customers(id_number) WHERE id_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_account_number ON customers(account_number) WHERE account_number IS NOT NULL;

-- 3. Backfill id_number from id_no (KYC field) for data consistency
UPDATE customers 
SET id_number = id_no 
WHERE id_number IS NULL AND id_no IS NOT NULL;

-- 4. Note: Existing random account numbers (which might be the 'id' field in current implementation) 
-- are preserved as the 'id' remains the primary key. 
-- The new 'account_number' column will be used for M-Pesa C2B Paybill references going forward.

COMMENT ON COLUMN customers.id_number IS 'National ID Number used for M-Pesa C2B matching.';
COMMENT ON COLUMN customers.account_number IS 'M-Pesa Paybill account reference. Defaults to id_number for new customers.';
COMMENT ON COLUMN customers.uses_id_as_account IS 'Flag to track if this customer is using their National ID as their Paybill account number.';
