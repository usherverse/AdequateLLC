-- ================================================================
-- MIGRATION: Granular RLS & Audit Hardening (Task 2)
-- Focus: Enforce "Need to Know" access for Loan Officers.
-- ================================================================

-- 1. CUSTOMERS: Granular Selective Access
DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
CREATE POLICY "Granular customer read"
  ON public.customers FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR 
    assigned_officer = auth.uid() OR 
    onboarded_by = auth.uid()
  );

-- 2. LOANS: Visibility inherited from Customer access
DROP POLICY IF EXISTS "Authenticated users can read loans" ON public.loans;
CREATE POLICY "Granular loan read"
  ON public.loans FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.customers 
      WHERE id = public.loans.customer_id AND 
      (assigned_officer = auth.uid() OR onboarded_by = auth.uid())
    )
  );

-- 3. PAYMENTS: Visibility inherited from customer access
DROP POLICY IF EXISTS "Authenticated users can read payments" ON public.payments;
CREATE POLICY "Granular payment read"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.customers 
      WHERE id = public.payments.customer_id AND 
      (assigned_officer = auth.uid() OR onboarded_by = auth.uid())
    )
  );

-- 4. INTERACTIONS: Granular selective access
DROP POLICY IF EXISTS "Authenticated users can read inters" ON public.interactions;
CREATE POLICY "Granular interaction read"
  ON public.interactions FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR 
    customer_id IN (
      SELECT id FROM public.customers 
      WHERE (assigned_officer = auth.uid() OR onboarded_by = auth.uid())
    )
  );

-- 5. AUDIT LOG: Restricted to Admins/Auditors (VULN: previously readable by all)
DROP POLICY IF EXISTS "View audit log" ON public.audit_log;
CREATE POLICY "Restricted audit read"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 6. UNALLOCATED PAYMENTS: Restrict to Finance/Admins
DROP POLICY IF EXISTS "Authenticated users can read unallocated_payments" ON public.unallocated_payments;
CREATE POLICY "Restricted unallocated read"
  ON public.unallocated_payments FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 7. HOUSEKEEPING
-- Ensure RLS is active on everything sensitive
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unallocated_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
