-- ═══════════════════════════════════════════════════════════════
--  ADEQUATE CAPITAL LMS — Enhanced Supabase Database Schema V2
--  Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUM TYPES ────────────────────────────────────────────────
CREATE TYPE loan_status     AS ENUM ('Application submitted','worker-pending','Approved','Active','Overdue','Settled','Rejected','Written off');
CREATE TYPE repayment_type  AS ENUM ('Daily','Weekly','Biweekly','Monthly','Lump Sum');
CREATE TYPE risk_level      AS ENUM ('Low','Medium','High','Very High');
CREATE TYPE payment_status  AS ENUM ('Allocated','Unallocated');
CREATE TYPE worker_role     AS ENUM ('Loan Officer','Collections Officer','Finance','Viewer / Auditor','Admin', 'Asset Recovery');
CREATE TYPE worker_status   AS ENUM ('Active','Inactive');
CREATE TYPE lead_status     AS ENUM ('New','Contacted','Interested','Onboarded','Not Interested');

-- ── CUSTOMERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY DEFAULT ('CUS-' || LPAD(COALESCE((nextval('customers_seq')), 1)::TEXT, 4, '0')),
  name          TEXT    NOT NULL,
  phone         TEXT    NOT NULL,
  alt_phone     TEXT,
  id_no         TEXT    UNIQUE NOT NULL,
  business      TEXT,
  location      TEXT,
  residence     TEXT,
  officer       TEXT,
  loans         INT     DEFAULT 0,
  risk          risk_level DEFAULT 'Medium',
  gender        TEXT,
  dob           DATE,
  blacklisted   BOOLEAN DEFAULT FALSE,
  bl_reason     TEXT,
  from_lead     TEXT,
  n1_name       TEXT, n1_phone TEXT, n1_relation TEXT,
  n2_name       TEXT, n2_phone TEXT, n2_relation TEXT,
  n3_name       TEXT, n3_phone TEXT, n3_relation TEXT,
  status        TEXT    DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
  last_active_loan_id TEXT,
  joined        DATE    DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOANS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id              TEXT PRIMARY KEY DEFAULT ('LN-' || LPAD(COALESCE((nextval('loans_seq')), 2501)::TEXT, 4, '0')),
  customer_id     TEXT    NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  customer_name   TEXT    NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance <= amount),
  status          loan_status   DEFAULT 'Application submitted',
  repayment_type  repayment_type NOT NULL,
  officer         TEXT,
  risk            risk_level,
  disbursed       DATE,
  mpesa           TEXT,
  phone           TEXT,
  days_overdue    INT DEFAULT 0,
  overdue_freeze_date DATE,
  frozen_total_owed   NUMERIC(15, 2),
  is_frozen       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOAN SCHEDULES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_schedules (
  schedule_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id            TEXT REFERENCES loans(id) ON DELETE CASCADE,
  customer_id        TEXT REFERENCES customers(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  due_date           DATE NOT NULL,
  amount_due         NUMERIC(12,2) NOT NULL,
  amount_paid        NUMERIC(12,2) DEFAULT 0,
  status             TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','due_today','overdue','paid','paid_late')),
  paid_date          DATE,
  days_overdue       INT DEFAULT 0,
  penalty_amount     NUMERIC(12,2) DEFAULT 0,
  is_frozen          BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAYMENTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY DEFAULT ('PAY-' || LPAD(COALESCE((nextval('payments_seq')), 1)::TEXT, 4, '0')),
  loan_id       TEXT    REFERENCES loans(id) ON DELETE SET NULL,
  customer_id   TEXT    REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  mpesa         TEXT,
  date          DATE    DEFAULT CURRENT_DATE,
  status        payment_status DEFAULT 'Unallocated',
  allocated_by  TEXT,
  allocated_at  TIMESTAMPTZ,
  note          TEXT,
  is_reg_fee    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── MPESA DISBURSEMENTS (B2C) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS mpesa_disbursements (
  transaction_id             TEXT PRIMARY KEY,
  conversation_id            TEXT NOT NULL,
  originator_conversation_id TEXT NOT NULL,
  amount                     NUMERIC(12,2) NOT NULL,
  phone_number               TEXT NOT NULL,
  customer_id                TEXT REFERENCES customers(id),
  loan_id                    TEXT REFERENCES loans(id),
  status                     TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  initiated_by               TEXT,
  timestamp                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── MPESA COLLECTIONS (C2B) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS mpesa_collections (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mpesa_code          TEXT UNIQUE NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  phone_number        TEXT NOT NULL,
  account_number      TEXT,
  safaricom_message   TEXT,
  parsed_sender_name  TEXT,
  parsed_timestamp    TIMESTAMPTZ,
  processing_status   TEXT DEFAULT 'auto_allocated' CHECK (processing_status IN ('auto_allocated', 'unallocated', 'duplicate_rejected')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── MANUAL TRANSACTIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_transactions (
  transaction_id TEXT PRIMARY KEY DEFAULT ('MTX-' || LPAD(COALESCE((nextval('payments_seq')), 1)::TEXT, 4, '0')),
  type           TEXT CHECK (type IN ('disbursement', 'collection')),
  amount         NUMERIC(12,2) NOT NULL,
  phone_number   TEXT NOT NULL,
  customer_id    TEXT REFERENCES customers(id),
  loan_id        TEXT REFERENCES loans(id),
  mpesa_code     TEXT,
  notes          TEXT,
  recorded_by    TEXT,
  verified_by    TEXT,
  status         TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification','verified','rejected')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  verified_at    TIMESTAMPTZ
);

-- ── REGISTRATION FEES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registration_fees (
  fee_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   TEXT REFERENCES customers(id) UNIQUE,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 500,
  mpesa_code    TEXT,
  paid_at       TIMESTAMPTZ,
  verified_by   TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified'))
);

-- ── WORKERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workers (
  id            TEXT PRIMARY KEY DEFAULT ('W' || LPAD(COALESCE((nextval('workers_seq')), 1)::TEXT, 3, '0')),
  name          TEXT    NOT NULL,
  email         TEXT    UNIQUE NOT NULL,
  role          worker_role NOT NULL,
  status        worker_status DEFAULT 'Active',
  phone         TEXT,
  joined        DATE    DEFAULT CURRENT_DATE,
  avatar        TEXT,
  auth_user_id  UUID    UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ts          TIMESTAMPTZ DEFAULT NOW(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_label  TEXT,
  action      TEXT NOT NULL,
  target      TEXT,
  detail      TEXT
);

-- ═══════════════════════════════════════════════════════════════
--  VIEWS & FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- ACTIVE CUSTOMER SUMMARY VIEW (#4)
CREATE OR REPLACE VIEW active_customer_summary AS
SELECT
  COUNT(DISTINCT c.id) AS active_customer_count,
  COALESCE(SUM(l.amount), 0) AS total_active_loan_value,
  COALESCE(SUM(l.balance), 0) AS total_outstanding_balance
FROM customers c
INNER JOIN loans l ON l.customer_id = c.id
WHERE l.status IN ('Active', 'Overdue')
AND c.status = 'active';

-- VIEWER MASKED CUSTOMERS (#46)
CREATE OR REPLACE VIEW safe_customers AS
SELECT 
  id, name, officer, loans, risk, gender, dob, blacklisted, bl_reason, from_lead, status, joined,
  'XXXX-' || RIGHT(id_no, 4) AS masked_id_no,
  'XXXX-XXX-' || RIGHT(phone, 3) AS masked_phone
FROM customers;

-- FINANCIAL AGGREGATE SUMMARY VIEW (#47)
CREATE OR REPLACE VIEW financial_summary AS
SELECT 
  COUNT(id) as total_payments,
  SUM(amount) as total_collections
FROM payments WHERE status = 'Allocated';

-- SYNC CUSTOMER ACTIVE STATUS TRIGGER (#4)
CREATE OR REPLACE FUNCTION sync_customer_active_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('Active', 'Overdue') THEN
    UPDATE customers
    SET status = 'active',
        last_active_loan_id = NEW.id
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_customer_status ON loans;
CREATE TRIGGER trigger_sync_customer_status
AFTER UPDATE OF status ON loans
FOR EACH ROW
EXECUTE FUNCTION sync_customer_active_status();

-- 30 DAY FREEZE & OVERDUE UPDATER LOGIC (#6)
CREATE OR REPLACE FUNCTION daily_overdue_and_freeze_update()
RETURNS void AS $$
DECLARE
  l RECORD;
  accrued_interest NUMERIC;
  penalty_amount NUMERIC;
BEGIN
  FOR l IN SELECT * FROM loans WHERE status IN ('Active', 'Overdue') AND is_frozen = FALSE LOOP
    -- Phase 3: Total Freeze after 60 days overdue (30d interest + 30d penalty)
    IF l.days_overdue >= 60 THEN
      UPDATE loans
      SET is_frozen = TRUE,
          overdue_freeze_date = CURRENT_DATE,
          -- Lock total at: current balance + 30 days interest (1.2%) + 30 days penalty (1.2%)
          -- This aligns with calculateLoanStatus() in lms-common.jsx
          frozen_total_owed = balance + (balance * 0.012 * 30) + (balance * 0.012 * 30)
      WHERE id = l.id;
    ELSE
      -- Phase 1 & 2: Daily increment of overdue counter
      UPDATE loans SET days_overdue = days_overdue + 1 WHERE id = l.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- AUDIT MAKER FUNCTION (#19)
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (action, target, detail)
    VALUES (TG_TABLE_NAME || '-' || TG_OP, OLD.id, 'Row deleted');
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (action, target, detail)
    VALUES (TG_TABLE_NAME || '-' || TG_OP, NEW.id, 'Row updated');
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (action, target, detail)
    VALUES (TG_TABLE_NAME || '-' || TG_OP, NEW.id, 'Row inserted');
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_collections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_worker_role() RETURNS TEXT AS $$
  SELECT role::TEXT FROM workers WHERE auth_user_id = auth.uid() AND status = 'Active' LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Only Active workers can login (#18)
CREATE POLICY "inactive_block" ON workers FOR SELECT USING (status = 'Active');

-- Admin reads all workers
CREATE POLICY "admin_all_workers" ON workers FOR ALL USING (current_worker_role() = 'Admin');

-- Employees cannot modify their own roles (#17 handled via frontend or strict function wrappers, 
-- but we restrict update payload in reality. RLS blocks generic role updates natively except admin)

-- No Delete for most records
CREATE POLICY "prevent_delete_payments" ON payments FOR DELETE USING (FALSE);
CREATE POLICY "prevent_delete_loans" ON loans FOR DELETE USING (FALSE);
CREATE POLICY "prevent_delete_customers" ON customers FOR DELETE USING (current_worker_role() = 'Admin');

-- Audit Logs Append-Only (#7)
CREATE POLICY "audit_append_only" ON audit_logs FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "audit_no_update" ON audit_logs FOR UPDATE USING (FALSE);
CREATE POLICY "audit_no_delete" ON audit_logs FOR DELETE USING (FALSE);
CREATE POLICY "audit_read" ON audit_logs FOR SELECT USING (current_worker_role() IN ('Admin', 'Finance', 'Viewer / Auditor'));

-- Settled / Written Off loans cannot be modified (#9, #10)
CREATE POLICY "prevent_closed_loan_mod" ON loans FOR UPDATE 
USING (status NOT IN ('Settled', 'Written off') OR current_worker_role() = 'Admin');

-- Finance / Admin Allocation only for M-Pesa Collections (#14)
CREATE POLICY "payments_readonly_allocated" ON payments FOR UPDATE
USING (status = 'Unallocated' AND current_worker_role() IN ('Finance', 'Admin'));
