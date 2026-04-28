-- Migration: Fix payment timestamp granularity
-- Converts payments.date to TIMESTAMPTZ and updates RPCs to preserve time data.

-- 1. Fix payments table column type
DO $$ 
BEGIN
    ALTER TABLE public.payments ALTER COLUMN date TYPE TIMESTAMPTZ;
EXCEPTION
    WHEN others THEN 
        RAISE NOTICE 'Could not alter column date to TIMESTAMPTZ - it might already be correct or have data conflicts.';
END $$;

-- 2. Update finalize_c2b_allocation to use full timestamp
CREATE OR REPLACE FUNCTION finalize_c2b_allocation(
  p_trans_id TEXT, p_trans_time TIMESTAMPTZ, p_amount NUMERIC, p_bill_ref TEXT,
  p_msisdn TEXT, p_first_name TEXT, p_last_name TEXT, p_shortcode TEXT,
  p_raw_payload JSONB, p_customer_id TEXT, p_method TEXT, p_reason TEXT
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
BEGIN
  IF EXISTS (SELECT 1 FROM mpesa_transactions WHERE trans_id = p_trans_id) THEN
      RETURN jsonb_build_object('success', true, 'note', 'duplicate');
  END IF;

  INSERT INTO public.mpesa_transactions (
      trans_id, trans_time, trans_amount, bill_ref_number, msisdn, first_name, last_name, 
      business_short_code, allocation_status, allocation_method, customer_id, raw_payload
  )
  VALUES (
      p_trans_id, p_trans_time, p_amount, p_bill_ref, p_msisdn, p_first_name, p_last_name, 
      p_shortcode, CASE WHEN p_customer_id IS NOT NULL THEN 'allocated'::text ELSE 'unallocated'::text END,
      p_method, p_customer_id, p_raw_payload
  )
  RETURNING id INTO v_transaction_internal_id;

  IF p_customer_id IS NOT NULL THEN
      SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id;
      
      -- Match latest Active/Overdue loan
      SELECT id INTO v_loan_id FROM loans 
       WHERE customer_id = p_customer_id AND status IN ('Active', 'Overdue') 
       ORDER BY created_at DESC LIMIT 1;

      -- Use p_trans_time instead of CURRENT_DATE to preserve the actual payment time
      INSERT INTO payments (
          customer_id, customer_name, loan_id, amount, mpesa, date, status, allocated_by, note
      )
      VALUES (
          p_customer_id, v_customer_name, v_loan_id, p_amount, p_trans_id, COALESCE(p_trans_time, NOW()), 'Allocated', 'System Engine', 'C2B Paybill Match'
      );
  ELSE
      INSERT INTO public.unallocated_payments (mpesa_transaction_id, reason)
      VALUES (v_transaction_internal_id, p_reason);
  END IF;

  RETURN jsonb_build_object('success', true, 'internal_id', v_transaction_internal_id);
END;
$$;

-- 3. Update apply_c2b_payment to accept TIMESTAMPTZ
CREATE OR REPLACE FUNCTION apply_c2b_payment(
  p_customer_id TEXT, p_customer_name TEXT, p_loan_id TEXT, p_amount NUMERIC,
  p_mpesa_txid TEXT, p_date TIMESTAMPTZ, p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id     TEXT;
  v_payment_status TEXT;
  v_is_reg_fee      BOOLEAN := false;
BEGIN
  IF EXISTS (SELECT 1 FROM payments WHERE mpesa = p_mpesa_txid LIMIT 1) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate_txid');
  END IF;

  IF p_loan_id IS NOT NULL THEN
    v_payment_status := 'Allocated';
  ELSIF p_amount = 500 OR p_note ILIKE '%Reg%' THEN
    v_payment_status := 'Allocated';
    v_is_reg_fee     := true;
  ELSE
    v_payment_status := 'Unallocated';
  END IF;

  INSERT INTO payments (
    customer_id, customer_name, loan_id, amount, mpesa, date, status, allocated_by, is_reg_fee, note
  )
  VALUES (
    p_customer_id, p_customer_name, p_loan_id, p_amount, p_mpesa_txid, COALESCE(p_date, NOW()), v_payment_status, 'System Engine', v_is_reg_fee, p_note
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;
