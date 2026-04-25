-- Standardize account_number to be the National ID (id_no)
-- Requirement: "I want the account number to be 36920250 because that is my ID number"

-- 1. Update all existing customers to use their National ID as the account number
UPDATE public.customers 
SET account_number = id_no
WHERE id_no IS NOT NULL;

-- 2. Create or update the trigger function to sync account_number with id_no
CREATE OR REPLACE FUNCTION public.trg_standardize_customer_account()
RETURNS TRIGGER AS $$
BEGIN
  -- If id_no is provided, use it as the account_number
  IF NEW.id_no IS NOT NULL AND NEW.id_no <> '' THEN
    NEW.account_number := NEW.id_no;
  ELSE
    -- Fallback to system ID if no National ID is available yet
    NEW.account_number := NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Ensure the trigger is active
DROP TRIGGER IF EXISTS trg_customer_account_standardization ON public.customers;
CREATE TRIGGER trg_customer_account_standardization
BEFORE INSERT OR UPDATE OF id, id_no ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.trg_standardize_customer_account();

-- 4. Update documentation
COMMENT ON COLUMN public.customers.account_number IS 'M-Pesa Paybill account reference. Mirrored from the National ID (id_no) for customer familiarity.';
