-- M-Pesa Integration Tables and Modifications

-- 1. Modify Customers Table to track Registration Fee Status
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS mpesa_registered boolean DEFAULT false;

-- 2. Unallocated Payments (C2B)
CREATE TABLE IF NOT EXISTS public.unallocated_payments (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    transaction_type text,
    transaction_id text UNIQUE NOT NULL,
    transaction_date timestamp with time zone,
    amount numeric(12,2) NOT NULL,
    business_shortcode text,
    bill_ref_number text,
    invoice_number text,
    org_account_balance numeric(12,2),
    msisdn text,
    first_name text,
    middle_name text,
    last_name text,
    status text DEFAULT 'Unallocated', -- Unallocated, Allocated
    allocated_to text REFERENCES public.customers(id),
    allocated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS for unallocated_payments
ALTER TABLE public.unallocated_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated to view unallocated payments" ON public.unallocated_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all authenticated to modify unallocated payments" ON public.unallocated_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow service role insertion" ON public.unallocated_payments FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Allow authenticated insertion" ON public.unallocated_payments FOR INSERT TO authenticated WITH CHECK (true);


-- 3. Disbursements (B2C)
CREATE TABLE IF NOT EXISTS public.b2c_disbursements (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    conversation_id text,
    originator_conversation_id text,
    amount numeric(12,2) NOT NULL,
    phone_number text NOT NULL,
    customer_id text REFERENCES public.customers(id),
    status text DEFAULT 'Pending', -- Pending, Completed, Failed
    mpesa_receipt text,
    result_code integer,
    result_desc text,
    b2c_working_account_available numeric(12,2),
    b2c_utility_account_available numeric(12,2),
    b2c_charges_paid_account_available numeric(12,2),
    transaction_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Trigger to set updated_at
CREATE TRIGGER trg_b2c_disbursements_updated_at 
BEFORE UPDATE ON public.b2c_disbursements 
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS for b2c_disbursements
ALTER TABLE public.b2c_disbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated to view disbursements" ON public.b2c_disbursements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all authenticated to insert disbursements" ON public.b2c_disbursements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service role update disbursements" ON public.b2c_disbursements FOR UPDATE TO service_role USING (true);
CREATE POLICY "Allow authenticated update disbursements" ON public.b2c_disbursements FOR UPDATE TO authenticated USING (true);


-- 4. STK Push Requests tracking
CREATE TABLE IF NOT EXISTS public.stk_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    merchant_request_id text,
    checkout_request_id text UNIQUE NOT NULL,
    phone_number text NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference text, -- e.g. Customer ID
    description text,
    status text DEFAULT 'Pending', -- Pending, Completed, Failed
    result_code integer,
    result_desc text,
    mpesa_receipt text,
    transaction_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TRIGGER trg_stk_requests_updated_at 
BEFORE UPDATE ON public.stk_requests 
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.stk_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated to view stk" ON public.stk_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated to insert stk" ON public.stk_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow service role update stk" ON public.stk_requests FOR UPDATE TO service_role USING (true);
CREATE POLICY "Allow authenticated update stk" ON public.stk_requests FOR UPDATE TO authenticated USING (true);
