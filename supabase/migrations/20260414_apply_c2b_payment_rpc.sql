-- 20260414_apply_c2b_payment_rpc.sql
-- Atomic RPC: insert payment + update loan balance in a single transaction.
-- If any step fails, the entire operation rolls back — no partial state possible.

CREATE OR REPLACE FUNCTION apply_c2b_payment(
  p_customer_id    TEXT,
  p_customer_name  TEXT,
  p_loan_id        TEXT,       -- NULL if no active loan matched
  p_amount         NUMERIC,
  p_mpesa_txid     TEXT,
  p_date           DATE,
  p_note           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id     TEXT;
  v_new_balance    NUMERIC;
  v_new_status     TEXT;
  v_current_balance NUMERIC;
  v_current_status  TEXT;
  v_payment_status  TEXT;
  v_allocated_by    TEXT;
  v_allocated_at    TIMESTAMPTZ;
  v_is_reg_fee      BOOLEAN := false;
BEGIN
  -- ── 1. Idempotency guard ──────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM payments WHERE mpesa = p_mpesa_txid LIMIT 1) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_txid');
  END IF;

  -- ── 2. If a loan is targeted, lock the row and read current balance ───────
  IF p_loan_id IS NOT NULL THEN
    SELECT balance, status
      INTO v_current_balance, v_current_status
      FROM loans
     WHERE id = p_loan_id
       FOR UPDATE;           -- Row-level lock prevents race conditions

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Loan % not found', p_loan_id;
    END IF;

    -- Compute new balance (floor at 0)
    v_new_balance := GREATEST(0, v_current_balance - p_amount);
    v_new_status  := CASE WHEN v_new_balance <= 0 THEN 'Settled' ELSE v_current_status END;
    v_payment_status := 'Allocated';
    v_allocated_by   := 'System Engine';
    v_allocated_at   := NOW();
  ELSE
    IF p_amount = 500 OR p_note ILIKE '%Reg%' THEN
      p_loan_id        := 'REG-FEE-' || p_customer_id;
      v_payment_status := 'Allocated';
      v_allocated_by   := 'System Engine (Reg Fee)';
      v_allocated_at   := NOW();
      v_is_reg_fee     := true;
    ELSE
      v_payment_status := 'Unallocated';
      v_allocated_by   := NULL;
      v_allocated_at   := NULL;
    END IF;
  END IF;

  -- ── 3. Insert payment record ──────────────────────────────────────────────
  INSERT INTO payments (
    customer_id,
    customer_name,
    loan_id,
    amount,
    mpesa,
    date,
    status,
    allocated_by,
    allocated_at,
    is_reg_fee,
    note
  )
  VALUES (
    p_customer_id,
    p_customer_name,
    p_loan_id,
    p_amount,
    p_mpesa_txid,
    p_date,
    v_payment_status,
    v_allocated_by,
    v_allocated_at,
    v_is_reg_fee,
    p_note
  )
  RETURNING id INTO v_payment_id;

  -- ── 4. Update loan balance (only if a loan was targeted) ─────────────────
  IF p_loan_id IS NOT NULL THEN
    UPDATE loans
       SET balance = v_new_balance,
           status  = v_new_status
     WHERE id = p_loan_id;
  END IF;

  -- ── 5. Return result ──────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',      true,
    'payment_id',   v_payment_id,
    'loan_id',      p_loan_id,
    'new_balance',  v_new_balance,
    'new_status',   v_new_status,
    'allocated',    (p_loan_id IS NOT NULL)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Any error rolls back the entire transaction automatically
    RAISE WARNING '[apply_c2b_payment] Error for TxID %: % %', p_mpesa_txid, SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'reason',  SQLERRM
    );
END;
$$;

-- Grant execute permission to the anon/service role used by the server
GRANT EXECUTE ON FUNCTION apply_c2b_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT)
  TO service_role;

COMMENT ON FUNCTION apply_c2b_payment IS
  'Atomically records a C2B payment and deducts from the matched loan balance. '
  'Uses FOR UPDATE row locking to prevent double-spend race conditions. '
  'Returns JSONB result; rolls back entirely on any error.';
