-- Atomic RPC: finalize C2B allocation with mpesa_transactions logging
-- Handles both allocated and unallocated scenarios in a single transaction.

CREATE OR REPLACE FUNCTION finalize_c2b_allocation(
  p_trans_id TEXT,
  p_trans_time TIMESTAMPTZ,
  p_amount NUMERIC,
  p_bill_ref TEXT,
  p_msisdn TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_shortcode TEXT,
  p_raw_payload JSONB,
  p_customer_id TEXT, -- NULL if unallocated
  p_method TEXT,       -- 'account_number', 'phone', 'name', NULL
  p_reason TEXT        -- for unallocated
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_internal_id UUID;
  v_payment_id TEXT;
  v_loan_id TEXT;
  v_customer_name TEXT;
  v_current_bal NUMERIC;
BEGIN
  -- 1. Idempotency (secondary check)
  IF EXISTS (SELECT 1 FROM mpesa_transactions WHERE trans_id = p_trans_id) THEN
      RETURN jsonb_build_object('success', true, 'note', 'duplicate');
  END IF;

  -- 2. Insert into mpesa_transactions
  INSERT INTO public.mpesa_transactions (
      trans_id, trans_time, trans_amount, bill_ref_number, msisdn, 
      first_name, last_name, business_short_code, 
      allocation_status, allocation_method, customer_id, 
      allocated_at, raw_payload
  )
  VALUES (
      p_trans_id, p_trans_time, p_amount, p_bill_ref, p_msisdn, 
      p_first_name, p_last_name, p_shortcode, 
      CASE WHEN p_customer_id IS NOT NULL THEN 'allocated'::text ELSE 'unallocated'::text END,
      p_method, p_customer_id,
      CASE WHEN p_customer_id IS NOT NULL THEN NOW() ELSE NULL END,
      p_raw_payload
  )
  RETURNING id INTO v_transaction_internal_id;

  -- 3. If allocated, perform ledger updates
  IF p_customer_id IS NOT NULL THEN
      -- Get customer name
      SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id;
      
      -- Find recent active loan
      SELECT id, balance INTO v_loan_id, v_current_bal 
        FROM loans 
       WHERE customer_id = p_customer_id AND status = 'Active' 
       ORDER BY created_at DESC LIMIT 1;

      -- Insert into payments
      INSERT INTO payments (
          customer_id, customer_name, loan_id, amount, mpesa, date, status, allocated_by, note, allocated_at
      )
      VALUES (
          p_customer_id, v_customer_name, v_loan_id, p_amount, p_trans_id, CURRENT_DATE, 'Allocated', 'System Engine', 'C2B Paybill Match: ' || COALESCE(p_method, 'unknown'), NOW()
      )
      RETURNING id INTO v_payment_id;

      -- Update loan balance if matched
      IF v_loan_id IS NOT NULL THEN
          UPDATE loans 
             SET balance = GREATEST(0, v_current_bal - p_amount),
                 status  = CASE WHEN (v_current_bal - p_amount) <= 0 THEN 'Settled'::text ELSE status END
           WHERE id = v_loan_id;
      END IF;
  ELSE
      -- 4. If unallocated, insert into unallocated_payments
      INSERT INTO public.unallocated_payments (
          mpesa_transaction_id, reason
      )
      VALUES (
          v_transaction_internal_id, p_reason
      );
  END IF;

  RETURN jsonb_build_object('success', true, 'internal_id', v_transaction_internal_id);
END;
$$;

GRANT EXECUTE ON FUNCTION finalize_c2b_allocation(TEXT, TIMESTAMPTZ, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT)
  TO service_role;
