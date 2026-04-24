-- Migration to support commission-based pay and deductions for workers
-- Target: Loan Officer performance tracking

-- 1. Add salary and target config to workers table
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS base_salary numeric(15,2) DEFAULT 20000;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS onboarding_target int DEFAULT 60;

-- 2. Create worker_deductions table
CREATE TABLE IF NOT EXISTS public.worker_deductions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id text NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    amount numeric(15,2) NOT NULL,
    reason text NOT NULL,
    month text NOT NULL, -- format 'YYYY-MM'
    created_at timestamp with time zone DEFAULT now(),
    created_by text -- email of admin who added it
);

-- Enable RLS
ALTER TABLE public.worker_deductions ENABLE ROW LEVEL SECURITY;

-- Policies for worker_deductions
CREATE POLICY "Admins can manage deductions" ON public.worker_deductions
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Workers can view their own deductions" ON public.worker_deductions
    FOR SELECT
    TO authenticated
    USING (worker_id = (SELECT id FROM public.workers WHERE email = auth.jwt() ->> 'email'));

-- 3. Create payslips table for persistence and printing history
CREATE TABLE IF NOT EXISTS public.payslips (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id text NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    month text NOT NULL, -- format 'YYYY-MM'
    base_amount numeric(15,2) NOT NULL,
    commission_earned numeric(15,2) NOT NULL,
    total_deductions numeric(15,2) NOT NULL,
    net_salary numeric(15,2) NOT NULL,
    target_clients int NOT NULL,
    actual_clients int NOT NULL,
    status text DEFAULT 'Pending', -- 'Pending', 'Paid'
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- Policies for payslips
CREATE POLICY "Admins can manage payslips" ON public.payslips
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Workers can view their own payslips" ON public.payslips
    FOR SELECT
    TO authenticated
    USING (worker_id = (SELECT id FROM public.workers WHERE email = auth.jwt() ->> 'email'));
