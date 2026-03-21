-- ═══════════════════════════════════════════════════════════════
--  ADEQUATE CAPITAL LMS — Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUM TYPES ────────────────────────────────────────────────
CREATE TYPE loan_status     AS ENUM ('Application submitted','worker-pending','Approved','Active','Overdue','Settled','Rejected','Written off');
CREATE TYPE repayment_type  AS ENUM ('Daily','Weekly','Biweekly','Monthly','Lump Sum');
CREATE TYPE risk_level      AS ENUM ('Low','Medium','High','Very High');
CREATE TYPE payment_status  AS ENUM ('Allocated','Unallocated');
CREATE TYPE worker_role     AS ENUM ('Loan Officer','Collections Officer','Finance','Viewer / Auditor','Admin');
CREATE TYPE worker_status   AS ENUM ('Active','Inactive');
CREATE TYPE lead_status     AS ENUM ('New','Contacted','Interested','Onboarded','Not Interested');

-- ── CUSTOMERS ─────────────────────────────────────────────────
CREATE TABLE customers (
  id            TEXT PRIMARY KEY DEFAULT ('CUS-' || LPAD(nextval('customers_seq')::TEXT, 4, '0')),
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
  joined        DATE    DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE SEQUENCE customers_seq START 1;
CREATE INDEX idx_customers_phone      ON customers(phone);
CREATE INDEX idx_customers_officer    ON customers(officer);
CREATE INDEX idx_customers_location   ON customers(location);
CREATE INDEX idx_customers_risk       ON customers(risk);
CREATE INDEX idx_customers_blacklisted ON customers(blacklisted);

-- ── LOANS ─────────────────────────────────────────────────────
CREATE TABLE loans (
  id              TEXT PRIMARY KEY DEFAULT ('LN-' || LPAD(nextval('loans_seq')::TEXT, 4, '0')),
  customer_id     TEXT    NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  customer_name   TEXT    NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance         NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          loan_status   DEFAULT 'Application submitted',
  repayment_type  repayment_type NOT NULL,
  officer         TEXT,
  risk            risk_level,
  disbursed       DATE,
  mpesa           TEXT,
  phone           TEXT,
  days_overdue    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE SEQUENCE loans_seq START 2501;
CREATE INDEX idx_loans_customer_id    ON loans(customer_id);
CREATE INDEX idx_loans_status         ON loans(status);
CREATE INDEX idx_loans_officer        ON loans(officer);
CREATE INDEX idx_loans_disbursed      ON loans(disbursed);

-- ── PAYMENTS ──────────────────────────────────────────────────
CREATE TABLE payments (
  id            TEXT PRIMARY KEY DEFAULT ('PAY-' || LPAD(nextval('payments_seq')::TEXT, 4, '0')),
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
CREATE SEQUENCE payments_seq START 1;
CREATE INDEX idx_payments_loan_id     ON payments(loan_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_status      ON payments(status);
CREATE INDEX idx_payments_date        ON payments(date);

-- ── WORKERS ───────────────────────────────────────────────────
CREATE TABLE workers (
  id            TEXT PRIMARY KEY DEFAULT ('W' || LPAD(nextval('workers_seq')::TEXT, 3, '0')),
  name          TEXT    NOT NULL,
  email         TEXT    UNIQUE NOT NULL,
  role          worker_role NOT NULL,
  status        worker_status DEFAULT 'Active',
  phone         TEXT,
  joined        DATE    DEFAULT CURRENT_DATE,
  avatar        TEXT,
  auth_user_id  UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE SEQUENCE workers_seq START 1;
CREATE INDEX idx_workers_auth_user_id ON workers(auth_user_id);
CREATE INDEX idx_workers_role         ON workers(role);
CREATE INDEX idx_workers_status       ON workers(status);

-- ── LEADS ─────────────────────────────────────────────────────
CREATE TABLE leads (
  id            TEXT PRIMARY KEY DEFAULT ('LD-' || LPAD(nextval('leads_seq')::TEXT, 4, '0')),
  name          TEXT    NOT NULL,
  phone         TEXT    NOT NULL,
  business      TEXT,
  location      TEXT,
  source        TEXT    DEFAULT 'Referral',
  officer       TEXT,
  status        lead_status DEFAULT 'New',
  notes         TEXT,
  date          DATE    DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE SEQUENCE leads_seq START 1;
CREATE INDEX idx_leads_status  ON leads(status);
CREATE INDEX idx_leads_officer ON leads(officer);

-- ── INTERACTIONS ──────────────────────────────────────────────
CREATE TABLE interactions (
  id              TEXT PRIMARY KEY DEFAULT ('INT-' || LPAD(nextval('interactions_seq')::TEXT, 4, '0')),
  customer_id     TEXT REFERENCES customers(id) ON DELETE CASCADE,
  loan_id         TEXT REFERENCES loans(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,
  date            DATE DEFAULT CURRENT_DATE,
  officer         TEXT,
  notes           TEXT NOT NULL,
  promise_amount  NUMERIC(12,2),
  promise_date    DATE,
  promise_status  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE SEQUENCE interactions_seq START 1;
CREATE INDEX idx_interactions_customer_id ON interactions(customer_id);
CREATE INDEX idx_interactions_loan_id     ON interactions(loan_id);

-- ── AUDIT LOGS ────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ts          TIMESTAMPTZ DEFAULT NOW(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_label  TEXT,
  action      TEXT NOT NULL,
  target      TEXT,
  detail      TEXT
);
CREATE INDEX idx_audit_logs_ts      ON audit_logs(ts DESC);
CREATE INDEX idx_audit_logs_action  ON audit_logs(action);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated_at   BEFORE UPDATE ON customers   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_loans_updated_at       BEFORE UPDATE ON loans       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_workers_updated_at     BEFORE UPDATE ON workers     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leads_updated_at       BEFORE UPDATE ON leads       FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs  ENABLE ROW LEVEL SECURITY;

-- Helper: get current worker's role from workers table
CREATE OR REPLACE FUNCTION current_worker_role()
RETURNS TEXT AS $$
  SELECT role::TEXT FROM workers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Workers: can read own row; admins read all ────────────────
CREATE POLICY "workers_select" ON workers FOR SELECT
  USING (auth_user_id = auth.uid() OR current_worker_role() = 'Admin');

CREATE POLICY "workers_update_own" ON workers FOR UPDATE
  USING (auth_user_id = auth.uid());

CREATE POLICY "workers_admin_all" ON workers FOR ALL
  USING (current_worker_role() = 'Admin');

-- ── Customers: authenticated users can read; officers and admins can write ──
CREATE POLICY "customers_select" ON customers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "customers_insert" ON customers FOR INSERT
  WITH CHECK (current_worker_role() IN ('Admin','Loan Officer','Collections Officer'));

CREATE POLICY "customers_update" ON customers FOR UPDATE
  USING (current_worker_role() IN ('Admin','Loan Officer','Collections Officer'));

CREATE POLICY "customers_delete" ON customers FOR DELETE
  USING (current_worker_role() = 'Admin');

-- ── Loans: same as customers ──────────────────────────────────
CREATE POLICY "loans_select" ON loans FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "loans_insert" ON loans FOR INSERT
  WITH CHECK (current_worker_role() IN ('Admin','Loan Officer'));

CREATE POLICY "loans_update" ON loans FOR UPDATE
  USING (current_worker_role() IN ('Admin','Loan Officer','Finance'));

CREATE POLICY "loans_delete" ON loans FOR DELETE
  USING (current_worker_role() = 'Admin');

-- ── Payments: finance and admin can write ─────────────────────
CREATE POLICY "payments_select" ON payments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "payments_insert" ON payments FOR INSERT
  WITH CHECK (current_worker_role() IN ('Admin','Finance','Loan Officer'));

CREATE POLICY "payments_update" ON payments FOR UPDATE
  USING (current_worker_role() IN ('Admin','Finance'));

-- ── Leads: loan officers and above ───────────────────────────
CREATE POLICY "leads_select" ON leads FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "leads_write" ON leads FOR ALL
  USING (current_worker_role() IN ('Admin','Loan Officer'));

-- ── Interactions: all authenticated can read; officers write ──
CREATE POLICY "interactions_select" ON interactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "interactions_write" ON interactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ── Audit logs: admins and finance only ──────────────────────
CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  USING (current_worker_role() IN ('Admin','Finance','Viewer / Auditor'));

CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
