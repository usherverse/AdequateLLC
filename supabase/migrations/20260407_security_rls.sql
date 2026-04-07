-- 20260407_security_rls.sql
-- Enable RLS and define access policies for Payments Hub tables

-- 1. Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Back-end service role full access" ON transactions
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view transactions" ON transactions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workers 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('Admin', 'Finance', 'Super Admin')
  )
);

CREATE POLICY "Admins can insert manual transactions" ON transactions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workers 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('Admin', 'Finance', 'Super Admin')
  )
);

-- 2. Registration Fees
ALTER TABLE registration_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Back-end service role full access" ON registration_fees
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Staff can view registration fees" ON registration_fees
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workers 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('Admin', 'Finance', 'Loan Officer', 'Super Admin')
  )
);

-- 3. Loan Disbursements
ALTER TABLE loan_disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Back-end service role full access" ON loan_disbursements
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view disbursements" ON loan_disbursements
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workers 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('Admin', 'Finance', 'Super Admin')
  )
);

-- 4. Payment Audit Logs
ALTER TABLE payment_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Back-end service role full access" ON payment_audit_logs
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Only Super Admins can view payment audit logs" ON payment_audit_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workers 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('Admin', 'Super Admin')
  )
);
