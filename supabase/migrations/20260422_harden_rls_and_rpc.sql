-- ================================================================
-- MIGRATION: Harden RLS and Function Access (VULN-05, VULN-07 fix)
-- Focus: Prevent authenticated users from directly modifying financial data.
-- ================================================================

-- ── 1. Revoke public/authenticated access to sensitive RPCs ──────
-- VULN-07 fix: Ensure apply_c2b_payment can ONLY be called by service_role (the backend)
REVOKE EXECUTE ON FUNCTION public.apply_c2b_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.apply_c2b_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_c2b_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_c2b_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT) TO service_role;

-- ── 2. Harden Table RLS (VULN-05 fix) ──────────────────────────
-- We drop the permissive policies from 20260407 migration and
-- replace them with strictly role-based or service_role-only policies.

-- ────── loans ──────
DROP POLICY IF EXISTS "Authenticated users can read loans" ON loans;
DROP POLICY IF EXISTS "Authenticated users can insert loans" ON loans;
DROP POLICY IF EXISTS "Authenticated users can update loans" ON loans;
DROP POLICY IF EXISTS "Allow authenticated delete loans" ON loans;
DROP POLICY IF EXISTS "Admins can manage loans" ON loans;

CREATE POLICY "Authenticated users can read loans" ON loans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage loans"
  ON loans FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────── customers ──────
DROP POLICY IF EXISTS "Authenticated users can read customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated delete customers" ON customers;
DROP POLICY IF EXISTS "Admins can manage customers" ON customers;

CREATE POLICY "Authenticated users can read customers" ON customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage customers"
  ON customers FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────── payments ──────
DROP POLICY IF EXISTS "Authenticated users can read payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated delete payments" ON payments;
DROP POLICY IF EXISTS "Admins can manage payments" ON payments;

CREATE POLICY "Authenticated users can read payments" ON payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage payments"
  ON payments FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────── leads / interactions ──────
DROP POLICY IF EXISTS "Authenticated users can read leads/inters" ON leads;
DROP POLICY IF EXISTS "Authenticated users can read inters" ON interactions;
DROP POLICY IF EXISTS "Allow authenticated delete leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated delete interactions" ON interactions;
DROP POLICY IF EXISTS "Admins can manage leads" ON leads;
DROP POLICY IF EXISTS "Admins can manage inters" ON interactions;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read leads/inters" ON leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read inters" ON interactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage leads" ON leads FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can manage inters" ON interactions FOR ALL TO authenticated USING (public.is_admin());

-- ────── payslips / salary_payments / deductions ──────
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payslips" ON public.payslips;
DROP POLICY IF EXISTS "Authenticated users can read financial logs" ON public.payslips;
DROP POLICY IF EXISTS "Admins can manage payslips" ON public.payslips;
DROP POLICY IF EXISTS "Allow authenticated delete salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Allow authenticated delete worker_deductions" ON public.worker_deductions;
DROP POLICY IF EXISTS "Admins can manage deductions" ON public.worker_deductions;
DROP POLICY IF EXISTS "Admins can manage salary_payouts" ON public.salary_payments;

CREATE POLICY "Authenticated users can read financial logs" ON public.payslips FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage payslips" ON public.payslips FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can manage deductions" ON public.worker_deductions FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can manage salary_payouts" ON public.salary_payments FOR ALL TO authenticated USING (public.is_admin());

-- ────── workers ──────
DROP POLICY IF EXISTS "Authenticated users can insert workers" ON workers;
DROP POLICY IF EXISTS "Authenticated users can update workers" ON workers;
DROP POLICY IF EXISTS "Admins can manage workers" ON workers;

CREATE POLICY "Admins can manage workers"
  ON workers FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────── unallocated_payments ──────
ALTER TABLE unallocated_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read unallocated_payments" ON unallocated_payments;
DROP POLICY IF EXISTS "Admins can manage unallocated" ON unallocated_payments;

CREATE POLICY "Authenticated users can read unallocated_payments" ON unallocated_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage unallocated"
  ON unallocated_payments FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 3. Housekeeping ──
ALTER TABLE loans FORCE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE payments IS 'Harden RLS: Write/Delete access restricted to Admins (VULN-05).';


