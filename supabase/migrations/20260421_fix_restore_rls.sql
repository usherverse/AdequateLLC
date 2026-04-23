-- ADEQUATE CAPITAL LMS - Restoration Security Patch
-- Ensures Super Admins can perform Global Wipe and Database Overwrite operations.

-- 1. Enable DELETE operations for authenticated users on core tables
DO $$ 
BEGIN
    -- Customers
    DROP POLICY IF EXISTS "Allow authenticated delete customers" ON public.customers;
    CREATE POLICY "Allow authenticated delete customers" ON public.customers FOR DELETE TO authenticated USING (true);
    
    -- Loans
    DROP POLICY IF EXISTS "Allow authenticated delete loans" ON public.loans;
    CREATE POLICY "Allow authenticated delete loans" ON public.loans FOR DELETE TO authenticated USING (true);
    
    -- Payments
    DROP POLICY IF EXISTS "Allow authenticated delete payments" ON public.payments;
    CREATE POLICY "Allow authenticated delete payments" ON public.payments FOR DELETE TO authenticated USING (true);
    
    -- Leads
    DROP POLICY IF EXISTS "Allow authenticated delete leads" ON public.leads;
    CREATE POLICY "Allow authenticated delete leads" ON public.leads FOR DELETE TO authenticated USING (true);
    
    -- Interactions
    DROP POLICY IF EXISTS "Allow authenticated delete interactions" ON public.interactions;
    CREATE POLICY "Allow authenticated delete interactions" ON public.interactions FOR DELETE TO authenticated USING (true);
    
    -- Audit Log (handle both common names)
    DROP POLICY IF EXISTS "Allow authenticated delete audit_log" ON public.audit_log;
    CREATE POLICY "Allow authenticated delete audit_log" ON public.audit_log FOR DELETE TO authenticated USING (true);
    DROP POLICY IF EXISTS "Allow authenticated delete audit_logs" ON public.audit_logs;
    CREATE POLICY "Allow authenticated delete audit_logs" ON public.audit_logs FOR DELETE TO authenticated USING (true);
    
    -- Ensure Audit Log insertions are allowed for restoration
    DROP POLICY IF EXISTS "admin_insert_audit" ON public.audit_log;
    CREATE POLICY "admin_insert_audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
END $$;

-- 2. Verify and Re-apply Upsert Permissions (Insert/Update)
-- We use 'WITH CHECK (true)' to ensure that restoration of backup IDs is not blocked.

DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
CREATE POLICY "Authenticated users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Authenticated users can update customers" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3. Expanded Tiers: Salary Payments, Deductions, Targets, Assets, and Workers
DO $$ 
BEGIN
    -- Salary Payments
    DROP POLICY IF EXISTS "Allow authenticated delete salary_payments" ON public.salary_payments;
    CREATE POLICY "Allow authenticated delete salary_payments" ON public.salary_payments FOR DELETE TO authenticated USING (true);
    DROP POLICY IF EXISTS "Allow authenticated insert salary_payments" ON public.salary_payments;
    CREATE POLICY "Allow authenticated insert salary_payments" ON public.salary_payments FOR INSERT TO authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow authenticated update salary_payments" ON public.salary_payments;
    CREATE POLICY "Allow authenticated update salary_payments" ON public.salary_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

    -- Worker Deductions
    DROP POLICY IF EXISTS "Allow authenticated delete worker_deductions" ON public.worker_deductions;
    CREATE POLICY "Allow authenticated delete worker_deductions" ON public.worker_deductions FOR DELETE TO authenticated USING (true);
    DROP POLICY IF EXISTS "Allow authenticated insert worker_deductions" ON public.worker_deductions;
    CREATE POLICY "Allow authenticated insert worker_deductions" ON public.worker_deductions FOR INSERT TO authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow authenticated update worker_deductions" ON public.worker_deductions;
    CREATE POLICY "Allow authenticated update worker_deductions" ON public.worker_deductions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

    -- Monthly Targets
    DROP POLICY IF EXISTS "Allow authenticated delete monthly_targets" ON public.monthly_targets;
    CREATE POLICY "Allow authenticated delete monthly_targets" ON public.monthly_targets FOR DELETE TO authenticated USING (true);
    DROP POLICY IF EXISTS "Allow authenticated insert monthly_targets" ON public.monthly_targets;
    CREATE POLICY "Allow authenticated insert monthly_targets" ON public.monthly_targets FOR INSERT TO authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow authenticated update monthly_targets" ON public.monthly_targets;
    CREATE POLICY "Allow authenticated update monthly_targets" ON public.monthly_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

    -- Repossessed Assets
    DROP POLICY IF EXISTS "Allow authenticated delete repossessed_assets" ON public.repossessed_assets;
    CREATE POLICY "Allow authenticated delete repossessed_assets" ON public.repossessed_assets FOR DELETE TO authenticated USING (true);
    DROP POLICY IF EXISTS "Allow authenticated insert repossessed_assets" ON public.repossessed_assets;
    CREATE POLICY "Allow authenticated insert repossessed_assets" ON public.repossessed_assets FOR INSERT TO authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow authenticated update repossessed_assets" ON public.repossessed_assets;
    CREATE POLICY "Allow authenticated update repossessed_assets" ON public.repossessed_assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

    -- Workers
    DROP POLICY IF EXISTS "Allow authenticated delete workers" ON public.workers;
    CREATE POLICY "Allow authenticated delete workers" ON public.workers FOR DELETE TO authenticated USING (true);
    DROP POLICY IF EXISTS "Allow authenticated insert workers" ON public.workers;
    CREATE POLICY "Allow authenticated insert workers" ON public.workers FOR INSERT TO authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow authenticated update workers" ON public.workers;
    CREATE POLICY "Allow authenticated update workers" ON public.workers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
END $$;
