-- LMS Database Performance Optimization (2026-04-07)
-- Targeted indexing for high-frequency queries and egress-optimized views

-- 1. Index for Audit Logs (Ordered by timestamp)
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts_desc ON public.audit_logs (ts DESC);

-- 2. Composite indexes for Customer searching and listing
-- This speeds up the .or() filter on ilike fields and the default created_at ordering
CREATE INDEX IF NOT EXISTS idx_customers_name_btree ON public.customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_name_ilike ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone_ilike ON public.customers USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_id_no_ilike ON public.customers USING gin (id_no gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_created_at_desc ON public.customers (created_at DESC);

-- 3. Loan management performance
-- Indexing status and customer relationships
CREATE INDEX IF NOT EXISTS idx_loans_status_created_at ON public.loans (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_customer_id ON public.loans (customer_id);

-- 4. Payments Hub & Registration Fees
-- Speed up customer lookups and recent transaction audits
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_reg_fees_customer_id ON public.registration_fees (customer_id);
CREATE INDEX IF NOT EXISTS idx_reg_fees_status ON public.registration_fees (status);

-- 5. Workers & Auth
CREATE INDEX IF NOT EXISTS idx_workers_auth_user_id ON public.workers (auth_user_id);
