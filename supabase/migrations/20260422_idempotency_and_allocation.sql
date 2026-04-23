-- ================================================================
-- MIGRATION: Idempotency & Manual Allocation (VULN-08, VULN-06 fix)
-- Focus: Move idempotency to DB and secure manual allocation.
-- ================================================================

-- ── 1. DB Idempotency Table (VULN-08 fix) ───────────────────────
CREATE TABLE IF NOT EXISTS public.processed_requests (
  idempotency_key TEXT PRIMARY KEY,
  response_body   JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- ────── Indexing & RLS (VULN-08) ──────
-- Enable RLS to satisfy safety checks
ALTER TABLE public.processed_requests ENABLE ROW LEVEL SECURITY;

-- Block public/authenticated from seeing keys
-- (Implicitly blocked once RLS is on, but explicit is better)
REVOKE ALL ON public.processed_requests FROM authenticated;
REVOKE ALL ON public.processed_requests FROM anon;

-- Only service_role (backend) can manage this table
DROP POLICY IF EXISTS "Service role can manage idempotency" ON public.processed_requests;
CREATE POLICY "Service role can manage idempotency"
  ON public.processed_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for expiration (Cleanup script can delete older than 24h)
CREATE INDEX IF NOT EXISTS idx_processed_requests_created_at ON public.processed_requests(created_at);


-- ── 2. Manual Allocation RPC (VULN-06 fix) ──────────────────────
-- Safely moves an 'Unallocated' payment into a loan.
-- SECURITY DEFINER ensures it can update the ledger atomically.
CREATE OR REPLACE FUNCTION public.allocate_manual_payment(
  p_payment_id   UUID,
  p_loan_id      TEXT,
  p_allocated_by TEXT,
  p_note         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amount       NUMERIC;
  v_cust_id      TEXT;
  v_cust_name    TEXT;
  v_status       TEXT;
  v_new_bal      NUMERIC;
  v_old_bal      NUMERIC;
  v_old_status   TEXT;
BEGIN
  -- 1. Fetch and Lock the payment
  SELECT amount, status, customer_id, customer_name
    INTO v_amount, v_status, v_cust_id, v_cust_name
    FROM payments
   WHERE id = p_payment_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id;
  END IF;

  IF v_status = 'Allocated' THEN
    RAISE EXCEPTION 'Payment % is already allocated', p_payment_id;
  END IF;

  -- 2. Fetch and Lock the loan
  SELECT balance, status, customer_id, customer_name
    INTO v_old_bal, v_old_status, v_cust_id, v_cust_name
    FROM loans
   WHERE id = p_loan_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan % not found', p_loan_id;
  END IF;

  -- 3. Calculate new balance
  v_new_bal := GREATEST(0, v_old_bal - v_amount);

  -- 4. Update the payment
  UPDATE payments
     SET status       = 'Allocated',
         loan_id      = p_loan_id,
         customer_id  = v_cust_id,
         customer_name = v_cust_name,
         allocated_by = p_allocated_by,
         allocated_at = NOW(),
         note         = p_note
   WHERE id = p_payment_id;

  -- 5. Update the loan
  UPDATE loans
     SET balance = v_new_bal,
         status  = CASE WHEN v_new_bal <= 0 THEN 'Settled' ELSE v_old_status END
   WHERE id = p_loan_id;

  -- 6. Clean up unallocated_payments if it exists there
  DELETE FROM unallocated_payments WHERE transaction_id = (SELECT mpesa FROM payments WHERE id = p_payment_id);

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'loan_id', p_loan_id,
    'old_balance', v_old_bal,
    'new_balance', v_new_bal
  );
END;
$$;

-- Revoke public access to ensure only the server can call it via service_role
REVOKE EXECUTE ON FUNCTION public.allocate_manual_payment FROM public;
REVOKE EXECUTE ON FUNCTION public.allocate_manual_payment FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.allocate_manual_payment FROM anon;
GRANT EXECUTE ON FUNCTION public.allocate_manual_payment TO service_role;

COMMENT ON TABLE processed_requests IS 'VULN-08: Persistent idempotency store.';
COMMENT ON FUNCTION allocate_manual_payment IS 'VULN-06: Atomic, server-side payment allocation.';
