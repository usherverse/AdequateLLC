-- 20260407_create_payments_hub.sql
-- Create custom types for the payments module
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('disbursement', 'registration_fee', 'paybill_receipt', 'manual_entry');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'reversed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('mpesa_stk', 'paybill', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE registration_fee_status AS ENUM ('pending', 'paid', 'waived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE disbursement_status AS ENUM ('queued', 'sent', 'confirmed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Transactions Table (Unified Ledger)
-- Using TEXT for customer_id to match existing lms-prod schema
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type transaction_type NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    customer_id TEXT REFERENCES customers(id), 
    mpesa_receipt_no VARCHAR(50) UNIQUE,
    mpesa_transaction_id VARCHAR(100),
    phone VARCHAR(15),
    status transaction_status DEFAULT 'pending',
    initiated_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    notes TEXT,
    metadata JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Registration Fees Table
CREATE TABLE IF NOT EXISTS registration_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id) NOT NULL,
    transaction_id UUID REFERENCES transactions(id),
    payment_method payment_method DEFAULT 'mpesa_stk',
    amount DECIMAL(8,2) DEFAULT 500.00,
    paid_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),
    status registration_fee_status DEFAULT 'pending'
);

-- 3. Loan Disbursements Table
CREATE TABLE IF NOT EXISTS loan_disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id TEXT REFERENCES loans(id) NOT NULL,
    transaction_id UUID REFERENCES transactions(id),
    disbursed_to_phone VARCHAR(15),
    mpesa_conversation_id VARCHAR(100),
    mpesa_originator_conversation_id VARCHAR(100),
    result_code INT,
    result_description TEXT,
    disbursed_at TIMESTAMPTZ,
    status disbursement_status DEFAULT 'queued'
);

-- 4. Payment Audit Log (Append-only)
-- Renamed to payment_audit_logs to avoid conflict with existing audit_log table
CREATE TABLE IF NOT EXISTS payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    ip_address INET,
    user_agent TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_registration_fees_customer_id ON registration_fees(customer_id);
CREATE INDEX IF NOT EXISTS idx_loan_disbursements_loan_id ON loan_disbursements(loan_id);

-- Updated_at trigger for transactions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
