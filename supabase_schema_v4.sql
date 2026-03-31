-- ==============================================================================
-- ADEQUATE CAPITAL LMS - SUPABASE V4 SCHEMA UPGRADE
-- Comprehensive RLS, Automation, and Security Overhaul implementation
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. BASE TABLES & CONSTRAINTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.workers (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('Loan Officer', 'Collections Officer', 'Finance', 'Viewer / Auditor', 'Asset Recovery', 'admin')),
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    joined TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY DEFAULT 'CUST-' || substr(md5(random()::text), 1, 8),
    name TEXT NOT NULL,
    id_no TEXT UNIQUE NOT NULL, -- duplicate national ID protection
    phone TEXT NOT NULL,
    alt_phone TEXT,
    dob DATE,
    gender TEXT,
    address TEXT,
    business_name TEXT,
    business_type TEXT,
    business_location TEXT,
    risk TEXT DEFAULT 'Low' CHECK (risk IN ('Low', 'Medium', 'High', 'Very High')),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Inactive', 'Blacklisted')),
    onboarded_by UUID REFERENCES public.workers(id),
    assigned_officer UUID REFERENCES public.workers(id),
    lead_source TEXT,
    registration_fee_paid BOOLEAN DEFAULT FALSE,
    documents JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loans (
    id TEXT PRIMARY KEY DEFAULT 'LN-' || substr(md5(random()::text), 1, 8),
    customer_id TEXT REFERENCES public.customers(id) NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0), -- Prevent negative loan amounts
    balance NUMERIC NOT NULL CHECK (balance >= 0 AND balance <= amount), -- Prevent balance exceeding original amount
    interest_rate NUMERIC DEFAULT 0,
    penalties NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'worker-pending' CHECK (status IN ('Active', 'Overdue', 'Approved', 'Settled', 'Written off', 'Rejected', 'Application submitted', 'worker-pending')),
    repayment_type TEXT CHECK (repayment_type IN ('Daily', 'Weekly', 'Biweekly', 'Monthly', 'Lump Sum')),
    days_overdue INTEGER DEFAULT 0,
    assigned_officer UUID REFERENCES public.workers(id),
    disbursed_at TIMESTAMPTZ,
    expected_completion_date DATE,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY DEFAULT 'PAY-' || substr(md5(random()::text), 1, 8),
    customer_id TEXT REFERENCES public.customers(id),
    loan_id TEXT REFERENCES public.loans(id),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    mpesa_code TEXT UNIQUE, -- Duplicate M-Pesa transaction code protection
    phone_number TEXT,
    status TEXT DEFAULT 'Unallocated' CHECK (status IN ('Allocated', 'Unallocated')),
    allocated_by TEXT, -- Systematic or Worker Name
    date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leads (
    id TEXT PRIMARY KEY DEFAULT 'LEAD-' || substr(md5(random()::text), 1, 8),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    business TEXT,
    source TEXT,
    status TEXT DEFAULT 'New',
    assigned_officer UUID REFERENCES public.workers(id),
    converted_to TEXT REFERENCES public.customers(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id TEXT REFERENCES public.customers(id) NOT NULL,
    loan_id TEXT REFERENCES public.loans(id),
    worker_id UUID REFERENCES public.workers(id) NOT NULL,
    type TEXT CHECK (type IN ('Call', 'SMS', 'WhatsApp', 'Visit', 'Note', 'Promise')),
    notes TEXT,
    promise_date DATE,
    promise_amount NUMERIC,
    promise_status TEXT CHECK (promise_status IN ('Pending', 'Kept', 'Broken')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ts TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID,
    user_name TEXT,
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    old_data JSONB,
    new_data JSONB,
    detail TEXT
);

CREATE TABLE IF NOT EXISTS public.mpesa_disbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id TEXT,
    conversation_id TEXT,
    originator_conversation_id TEXT,
    amount NUMERIC NOT NULL,
    phone_number TEXT NOT NULL,
    customer_id TEXT REFERENCES public.customers(id),
    loan_id TEXT REFERENCES public.loans(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    initiated_by UUID REFERENCES public.workers(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mpesa_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_request_id TEXT,
    checkout_request_id TEXT,
    amount NUMERIC NOT NULL,
    phone_number TEXT NOT NULL,
    account_number TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manual_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT CHECK (type IN ('disbursement', 'collection')),
    amount NUMERIC NOT NULL,
    phone_number TEXT,
    customer_id TEXT REFERENCES public.customers(id) NOT NULL,
    loan_id TEXT REFERENCES public.loans(id),
    mpesa_code TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES public.workers(id) NOT NULL,
    verified_by UUID REFERENCES public.workers(id),
    status TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.registration_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id TEXT REFERENCES public.customers(id) NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 500,
    mpesa_code TEXT UNIQUE,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    verified_by UUID REFERENCES public.workers(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified'))
);

CREATE TABLE IF NOT EXISTS public.loan_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id TEXT REFERENCES public.loans(id) NOT NULL,
    customer_id TEXT REFERENCES public.customers(id) NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount_due NUMERIC NOT NULL,
    amount_paid NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due_today', 'overdue', 'paid', 'paid_late', 'partial')),
    paid_date TIMESTAMPTZ,
    days_overdue INTEGER DEFAULT 0,
    penalty_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. AUTHENTICATION HELPERS & VIEWS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_auth_role() RETURNS TEXT AS $$
DECLARE
    w_role TEXT;
BEGIN
    SELECT role INTO w_role FROM public.workers WHERE id = auth.uid() AND status = 'Active';
    RETURN w_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- M-Pesa secure access restriction role wrapper (to prevent internal functions bypassing security)
CREATE OR REPLACE FUNCTION public.is_mpesa_system() RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('request.jwt.claim.role', true) = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe customers view (masks ID and Phone) for Viewer Auditor
CREATE OR REPLACE VIEW public.safe_customers AS
SELECT 
    id, name, dob, gender, address, business_name, business_type, business_location, 
    risk, status, onboarded_by, assigned_officer, lead_source, registration_fee_paid, created_at,
    CASE 
        WHEN public.get_auth_role() = 'Viewer / Auditor' THEN 'MASKED-XXXX'
        ELSE id_no 
    END AS id_no,
    CASE 
        WHEN public.get_auth_role() = 'Viewer / Auditor' THEN 'MASKED-' || right(phone, 3) 
        ELSE phone 
    END AS phone
FROM public.customers;

-- Financial summary view for external reporting (No individual identifiers)
CREATE OR REPLACE VIEW public.financial_summary AS
SELECT 
    COUNT(id) AS total_loans,
    SUM(amount) AS total_disbursed,
    SUM(balance) AS total_outstanding,
    SUM(amount - balance) AS total_collected,
    SUM(penalties) AS total_penalties,
    status
FROM public.loans
GROUP BY status;

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Enable RLS on all tables globally
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_schedules ENABLE ROW LEVEL SECURITY;

-- Block inactive workers
CREATE POLICY "Block inactive workers global" ON public.workers FOR SELECT USING (status = 'Active' OR id = auth.uid());

-- WORKERS (Self role modification blocked via UPDATE CHECK)
CREATE POLICY "Admin full access workers" ON public.workers FOR ALL USING (get_auth_role() = 'admin');
CREATE POLICY "View active workers" ON public.workers FOR SELECT USING (status = 'Active');
CREATE POLICY "Prevent self role modify" ON public.workers FOR UPDATE USING (id = auth.uid() AND role = (SELECT role FROM public.workers WHERE id = auth.uid())) WITH CHECK (role = (SELECT role FROM public.workers WHERE id = auth.uid()));

-- CUSTOMERS (Officers see assigned, asset recovery sees blacklisted)
CREATE POLICY "Admin Finance Collections Asset View Customers" ON public.customers FOR SELECT USING (get_auth_role() IN ('admin', 'Finance', 'Collections Officer', 'Viewer / Auditor'));
CREATE POLICY "Asset Recovery view Blacklisted only" ON public.customers FOR SELECT USING (get_auth_role() = 'Asset Recovery' AND status = 'Blacklisted');
CREATE POLICY "Loan Officer View Own Customers" ON public.customers FOR SELECT USING (get_auth_role() = 'Loan Officer' AND assigned_officer = auth.uid());
CREATE POLICY "All active workers can insert customers" ON public.customers FOR INSERT WITH CHECK (get_auth_role() IS NOT NULL);
CREATE POLICY "Admin update customers" ON public.customers FOR UPDATE USING (get_auth_role() = 'admin');
CREATE POLICY "Loan Officer update own customers" ON public.customers FOR UPDATE USING (get_auth_role() = 'Loan Officer' AND assigned_officer = auth.uid());
-- Deletion prevention
CREATE POLICY "Block Delete Customers" ON public.customers FOR DELETE USING (FALSE);

-- LOANS (Protections on Written off and Settled)
CREATE POLICY "Admin Finance Viewer View Loans" ON public.loans FOR SELECT USING (get_auth_role() IN ('admin', 'Finance', 'Viewer / Auditor'));
CREATE POLICY "Collections View Overdue Loans" ON public.loans FOR SELECT USING (get_auth_role() = 'Collections Officer');
CREATE POLICY "Asset Recovery View Defaulted Loans" ON public.loans FOR SELECT USING (get_auth_role() = 'Asset Recovery' AND status = 'Written off');
CREATE POLICY "Loan Officer View Own Loans" ON public.loans FOR SELECT USING (get_auth_role() = 'Loan Officer' AND assigned_officer = auth.uid());
CREATE POLICY "Admin create loans" ON public.loans FOR INSERT WITH CHECK (get_auth_role() = 'admin');
CREATE POLICY "Loan Officer create own loans" ON public.loans FOR INSERT WITH CHECK (get_auth_role() = 'Loan Officer' AND assigned_officer = auth.uid());

CREATE POLICY "Update loans protection" ON public.loans FOR UPDATE USING (
    (get_auth_role() = 'admin') OR 
    (get_auth_role() = 'Loan Officer' AND assigned_officer = auth.uid() AND status NOT IN ('Written off', 'Settled')) OR
    (get_auth_role() = 'Collections Officer' AND status = 'Overdue')
);
CREATE POLICY "Block Delete Loans" ON public.loans FOR DELETE USING (FALSE);

-- LOAN SCHEDULES
CREATE POLICY "View Loan Schedules" ON public.loan_schedules FOR SELECT USING (get_auth_role() IS NOT NULL);
CREATE POLICY "Admin Update Loan Schedules" ON public.loan_schedules FOR UPDATE USING (get_auth_role() = 'admin' OR get_auth_role() = 'Finance');
CREATE POLICY "System Insert Loan Schedules" ON public.loan_schedules FOR INSERT WITH CHECK (TRUE); -- Managed by triggers/functions

-- PAYMENTS (Immutable once allocated, never deleted)
CREATE POLICY "View Payments" ON public.payments FOR SELECT USING (get_auth_role() IS NOT NULL);
CREATE POLICY "Insert Payments" ON public.payments FOR INSERT WITH CHECK (get_auth_role() IN ('admin', 'Finance', 'Collections Officer', 'Loan Officer') OR public.is_mpesa_system());
CREATE POLICY "Update unallocated payments only" ON public.payments FOR UPDATE USING (status = 'Unallocated' AND get_auth_role() IN ('admin', 'Finance'));
CREATE POLICY "Payments never deleted" ON public.payments FOR DELETE USING (FALSE);

-- INTERACTIONS
CREATE POLICY "View interactions" ON public.interactions FOR SELECT USING (
    get_auth_role() IN ('admin', 'Finance', 'Collections Officer', 'Viewer / Auditor') OR 
    (get_auth_role() = 'Loan Officer' AND worker_id = auth.uid()) OR
    (get_auth_role() = 'Asset Recovery')
);
CREATE POLICY "Insert interactions" ON public.interactions FOR INSERT WITH CHECK (get_auth_role() IN ('admin', 'Collections Officer', 'Loan Officer'));
CREATE POLICY "Never delete interactions" ON public.interactions FOR DELETE USING (FALSE);

-- MANUAL TRANSACTIONS
CREATE POLICY "Any worker insert manual trans" ON public.manual_transactions FOR INSERT WITH CHECK (get_auth_role() IS NOT NULL);
CREATE POLICY "View manual trans" ON public.manual_transactions FOR SELECT USING (get_auth_role() IS NOT NULL);
-- Only finance or admin can verify, and not self. Once verified, no mod.
CREATE POLICY "Verify manual trans" ON public.manual_transactions FOR UPDATE USING (
    get_auth_role() IN ('admin', 'Finance') AND recorded_by != auth.uid() AND status = 'pending_verification'
);
CREATE POLICY "Never delete manual trans" ON public.manual_transactions FOR DELETE USING (FALSE);

-- REGISTRATION FEES
CREATE POLICY "Insert Reg Fees" ON public.registration_fees FOR INSERT WITH CHECK (get_auth_role() IS NOT NULL OR public.is_mpesa_system());
CREATE POLICY "View Reg Fees" ON public.registration_fees FOR SELECT USING (get_auth_role() IS NOT NULL);
CREATE POLICY "Verify Reg Fees" ON public.registration_fees FOR UPDATE USING (get_auth_role() IN ('admin', 'Finance') AND status = 'pending');

-- AUDIT LOG (Strict Append Only)
CREATE POLICY "View audit log" ON public.audit_log FOR SELECT USING (get_auth_role() IN ('admin', 'Viewer / Auditor'));
CREATE POLICY "Insert audit log" ON public.audit_log FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Audit never updated" ON public.audit_log FOR UPDATE USING (FALSE);
CREATE POLICY "Audit never deleted" ON public.audit_log FOR DELETE USING (FALSE);

-- MPESA DISBURSEMENTS
CREATE POLICY "View mpesa disb" ON public.mpesa_disbursements FOR SELECT USING (get_auth_role() IN ('admin', 'Finance', 'Viewer / Auditor'));
CREATE POLICY "System insert/update mpesa disb" ON public.mpesa_disbursements FOR ALL USING (public.is_mpesa_system() OR get_auth_role() = 'admin');

-- MPESA COLLECTIONS
CREATE POLICY "View mpesa coll" ON public.mpesa_collections FOR SELECT USING (get_auth_role() IN ('admin', 'Finance', 'Viewer / Auditor'));
CREATE POLICY "System insert/update mpesa coll" ON public.mpesa_collections FOR ALL USING (public.is_mpesa_system() OR get_auth_role() = 'admin');


-- ==============================================================================
-- 4. TRIGGERS & AUTOMATION FUNCTIONS
-- ==============================================================================

-- A) Generic Audit Log Trigger
CREATE OR REPLACE FUNCTION log_audit_event() RETURNS TRIGGER AS $$
DECLARE
    u_id UUID;
    u_name TEXT;
    act TEXT;
BEGIN
    u_id := auth.uid();
    SELECT name INTO u_name FROM public.workers WHERE id = u_id;
    IF TG_OP = 'INSERT' THEN act := 'INSERT'; ELSIF TG_OP = 'UPDATE' THEN act := 'UPDATE'; ELSE act := 'DELETE'; END IF;
    
    INSERT INTO public.audit_log (user_id, user_name, action, target_table, target_id, old_data, new_data, detail)
    VALUES (u_id, COALESCE(u_name, 'System'), act, TG_TABLE_NAME, COALESCE(NEW.id::TEXT, OLD.id::TEXT), row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB, 'Automated DML capture');
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER trg_audit_loans AFTER INSERT OR UPDATE OR DELETE ON public.loans FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER trg_audit_workers AFTER INSERT OR UPDATE OR DELETE ON public.workers FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- B) Prevent Disbursement to Blacklisted Customers
CREATE OR REPLACE FUNCTION enforce_blacklist_guard() RETURNS TRIGGER AS $$
DECLARE c_status TEXT;
BEGIN
    SELECT status INTO c_status FROM public.customers WHERE id = NEW.customer_id;
    IF c_status = 'Blacklisted' THEN
        RAISE EXCEPTION 'Cannot disburse or create loan for blacklisted customer.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_guard_blacklisted_loans BEFORE INSERT OR UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION enforce_blacklist_guard();

-- C) Prevent 2nd Active Loan if one is overdue
CREATE OR REPLACE FUNCTION prevent_multiple_active_if_overdue() RETURNS TRIGGER AS $$
DECLARE overdue_count INT;
BEGIN
    IF NEW.status IN ('Active', 'Approved', 'Application submitted') THEN
        SELECT COUNT(*) INTO overdue_count FROM public.loans WHERE customer_id = NEW.customer_id AND status = 'Overdue' AND id != NEW.id;
        IF overdue_count > 0 THEN
            RAISE EXCEPTION 'Customer has an overdue loan. Cannot open a new loan application.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_guard_overdue_multiple_loans BEFORE INSERT ON public.loans FOR EACH ROW EXECUTE FUNCTION prevent_multiple_active_if_overdue();

-- D) Enforce Loan Progression Tiers (5k -> 10k -> 20k -> 30k -> 50k)
CREATE OR REPLACE FUNCTION enforce_loan_tiers() RETURNS TRIGGER AS $$
DECLARE 
    settled_count INT;
    max_allowed NUMERIC;
BEGIN
    SELECT COUNT(*) INTO settled_count FROM public.loans WHERE customer_id = NEW.customer_id AND status = 'Settled';
    IF settled_count = 0 THEN max_allowed := 5000;
    ELSIF settled_count = 1 THEN max_allowed := 10000;
    ELSIF settled_count = 2 THEN max_allowed := 20000;
    ELSIF settled_count = 3 THEN max_allowed := 30000;
    ELSE max_allowed := 50000;
    END IF;

    IF NEW.amount > max_allowed THEN
        RAISE EXCEPTION 'Requested amount % exceeds maximum allowed % for customer tier.', NEW.amount, max_allowed;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_enforce_progression BEFORE INSERT ON public.loans FOR EACH ROW EXECUTE FUNCTION enforce_loan_tiers();

-- E) Daily Function: Calculate Days Overdue, Cap Penalties at 3650, Update Status.
CREATE OR REPLACE FUNCTION process_daily_loan_updates() RETURNS VOID AS $$
BEGIN
    -- Update days overdue for Active/Overdue loans where expected completion is past
    UPDATE public.loans 
    SET days_overdue = EXTRACT(DAY FROM (NOW() - expected_completion_date))::INT
    WHERE status IN ('Active', 'Overdue') AND expected_completion_date < NOW();
    
    -- Mark loans as Overdue if days overdue > 0
    UPDATE public.loans 
    SET status = 'Overdue' 
    WHERE status = 'Active' AND days_overdue > 0;

    -- Apply penalty (cap at 3650)
    UPDATE public.loans
    SET penalties = LEAST(penalties + (balance * 0.01), 3650)
    WHERE status = 'Overdue' AND balance > 0;

    -- Update Loan Schedules Status
    UPDATE public.loan_schedules
    SET status = 'overdue', days_overdue = EXTRACT(DAY FROM (NOW() - due_date))::INT
    WHERE status IN ('upcoming', 'due_today', 'partial') AND due_date < NOW()::DATE;

    UPDATE public.loan_schedules
    SET status = 'due_today'
    WHERE status = 'upcoming' AND due_date = NOW()::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F) Generate Complete Repayment Schedule on Disbursement
CREATE OR REPLACE FUNCTION generate_loan_schedule() RETURNS TRIGGER AS $$
DECLARE
    i INT;
    total_installments INT;
    interval_str TEXT;
    inst_amount NUMERIC;
BEGIN
    IF NEW.status = 'Active' AND OLD.status != 'Active' THEN
        -- Determine installments
        IF NEW.repayment_type = 'Daily' THEN total_installments := 30; interval_str := '1 day';
        ELSIF NEW.repayment_type = 'Weekly' THEN total_installments := 4; interval_str := '7 days';
        ELSIF NEW.repayment_type = 'Biweekly' THEN total_installments := 2; interval_str := '14 days';
        ELSIF NEW.repayment_type = 'Monthly' THEN total_installments := 1; interval_str := '1 month';
        ELSIF NEW.repayment_type = 'Lump Sum' THEN total_installments := 1; interval_str := '1 month';
        ELSE total_installments := 1; interval_str := '1 month';
        END IF;

        inst_amount := ROUND((NEW.amount + (NEW.amount * NEW.interest_rate)) / total_installments, 2);

        FOR i IN 1..total_installments LOOP
            INSERT INTO public.loan_schedules (loan_id, customer_id, installment_number, due_date, amount_due, status)
            VALUES (NEW.id, NEW.customer_id, i, (NEW.disbursed_at + (interval_str::INTERVAL * i))::DATE, inst_amount, 'upcoming');
        END LOOP;
        
        -- Set expected completion date
        UPDATE public.loans SET expected_completion_date = (NEW.disbursed_at + (interval_str::INTERVAL * total_installments))::DATE WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_generate_schedule AFTER UPDATE OF status ON public.loans FOR EACH ROW EXECUTE FUNCTION generate_loan_schedule();

-- G) Registration Fees Activation Trigger
CREATE OR REPLACE FUNCTION auto_activate_customer() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'verified' AND NEW.amount >= 500 THEN
        UPDATE public.customers SET status = 'Active', registration_fee_paid = TRUE WHERE id = NEW.customer_id;
        INSERT INTO public.audit_log (action, detail) VALUES ('Account Activated', 'KES 500 Registration fee received for ' || NEW.customer_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_auto_activate_cust AFTER UPDATE OF status ON public.registration_fees FOR EACH ROW EXECUTE FUNCTION auto_activate_customer();

-- H) Manual Transaction Verify Trigger
CREATE OR REPLACE FUNCTION process_manual_transaction() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'verified' AND OLD.status = 'pending_verification' THEN
        NEW.verified_at := NOW();
        IF NEW.type = 'disbursement' THEN
            UPDATE public.loans SET status = 'Active', disbursed_at = NOW() WHERE id = NEW.loan_id;
            INSERT INTO public.audit_log (action, detail) VALUES ('Manual Disbursement', 'Verified disbursement for ' || NEW.loan_id);
        ELSIF NEW.type = 'collection' THEN
            INSERT INTO public.payments (customer_id, loan_id, amount, mpesa_code, status, allocated_by)
            VALUES (NEW.customer_id, NEW.loan_id, NEW.amount, NEW.mpesa_code, 'Allocated', 'Manual-' || NEW.verified_by);
            -- Balance deduction handled by payment trigger below
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_process_manual_trans BEFORE UPDATE ON public.manual_transactions FOR EACH ROW EXECUTE FUNCTION process_manual_transaction();

-- I) Auto-deduct Loan Balance on Payment insert and Settlement Trigger
CREATE OR REPLACE FUNCTION apply_payment_to_loan() RETURNS TRIGGER AS $$
DECLARE 
    l_balance NUMERIC;
    sched RECORD;
    remaining_payment NUMERIC;
BEGIN
    IF NEW.status = 'Allocated' AND NEW.loan_id IS NOT NULL THEN
        -- Deduct from loan balance
        UPDATE public.loans SET balance = GREATEST(balance - NEW.amount, 0) WHERE id = NEW.loan_id RETURNING balance INTO l_balance;
        -- If zero, mark settled
        IF l_balance <= 0 THEN
            UPDATE public.loans SET status = 'Settled', settled_at = NOW() WHERE id = NEW.loan_id;
        END IF;
        
        -- Waterfall update to schedules
        remaining_payment := NEW.amount;
        
        FOR sched IN SELECT * FROM public.loan_schedules WHERE loan_id = NEW.loan_id AND status IN ('upcoming', 'due_today', 'overdue', 'partial') ORDER BY due_date ASC
        LOOP
            IF remaining_payment > 0 THEN
                IF remaining_payment >= (sched.amount_due - sched.amount_paid) THEN
                    -- Fully paid this schedule
                    remaining_payment := remaining_payment - (sched.amount_due - sched.amount_paid);
                    UPDATE public.loan_schedules SET status = 'paid', amount_paid = amount_due, paid_date = NOW() WHERE id = sched.id;
                ELSE
                    -- Partially paid
                    UPDATE public.loan_schedules SET status = 'partial', amount_paid = amount_paid + remaining_payment WHERE id = sched.id;
                    remaining_payment := 0;
                END IF;
            END IF;
        END LOOP;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_apply_payment AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION apply_payment_to_loan();
