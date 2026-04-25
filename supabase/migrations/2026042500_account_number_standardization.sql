-- Standardize account_number to be the system id (CUS-XXXX)
-- Requirement: "I want the cutomers account number to be their ids."

-- 1. Update all existing customers
UPDATE customers 
SET account_number = id;

-- 2. Create a trigger function to ensure future customers have account_number = id
CREATE OR REPLACE FUNCTION public.trg_standardize_customer_account()
RETURNS TRIGGER AS $$
BEGIN
  -- Always force account_number to match the id
  NEW.account_number := NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Apply the trigger
DROP TRIGGER IF EXISTS trg_customer_account_standardization ON public.customers;
CREATE TRIGGER trg_customer_account_standardization
BEFORE INSERT OR UPDATE OF id ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.trg_standardize_customer_account();

-- 4. Update comments to reflect new policy
COMMENT ON COLUMN customers.account_number IS 'M-Pesa Paybill account reference. Fixed to match the system ID (e.g. CUS-XXXX).';
