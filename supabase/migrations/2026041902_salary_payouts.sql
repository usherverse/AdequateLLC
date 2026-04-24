-- Migration to support M-Pesa B2C Salary Payouts for Workers
-- Records every disbursement attempt and success

CREATE TABLE IF NOT EXISTS public.salary_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id text NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    amount numeric(15,2) NOT NULL,
    month text NOT NULL, -- format 'YYYY-MM'
    mpesa_receipt text UNIQUE,
    recipient_phone text NOT NULL,
    status text DEFAULT 'Success', -- 'Success', 'Failed', 'Pending'
    remarks text, -- e.g. "Monthly Salary + Commission"
    created_at timestamp with time zone DEFAULT now(),
    created_by text -- admin user who initiated the transfer
);

-- Enable RLS
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage salary payments" ON public.salary_payments
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Workers can view their own salary payments" ON public.salary_payments
    FOR SELECT
    TO authenticated
    USING (worker_id = (SELECT id FROM public.workers WHERE email = auth.jwt() ->> 'email'));

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_salary_payments_worker ON public.salary_payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON public.salary_payments(month);

COMMENT ON TABLE public.salary_payments IS 'Logs for salary disbursements via M-Pesa B2C';
