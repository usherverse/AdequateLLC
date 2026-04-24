-- ================================================================
-- MIGRATION: Unified Financial Ledger & Penalty Waterfall (Task 4)
-- Focus: Centralizing financial math and removing redundant RPC updates.
-- ================================================================

-- 1. THE MASTER TRIGGER FUNCTION
-- This is the SINGLE SOURCE OF TRUTH for how payments affect loans.
CREATE OR REPLACE FUNCTION public.apply_payment_to_loan() 
RETURNS TRIGGER AS $$
DECLARE
    p_amount     DECIMAL := NEW.amount;
    l_penalties  DECIMAL;
    l_balance    DECIMAL;
    l_disbursed  DATE;
    l_od_days    INT;
    calc_penalty DECIMAL;
BEGIN
    -- Only process if payment is Allocated to a valid loan
    IF NEW.loan_id IS NULL OR NEW.status != 'Allocated' THEN
        RETURN NEW;
    END IF;

    -- A) Get current state (Lock row to prevent concurrent race conditions)
    SELECT penalties, balance, disbursed, days_overdue 
      INTO l_penalties, l_balance, l_disbursed, l_od_days
      FROM public.loans 
     WHERE id = NEW.loan_id FOR UPDATE;

    IF NOT FOUND THEN RETURN NEW; END IF;

    -- B) RECALCULATE PENALTY (Dynamic Catch-up)
    -- This ensures that if the cron job hasn't run yet today, we still 
    -- capture the correct penalty amount at the exact moment of payment.
    -- Calculation: 1.2% daily on (Principal + 30% Interest) 
    -- capped at 60 days (FREEZE_AFTER).
    IF l_disbursed IS NOT NULL AND l_balance > 0 THEN
       DECLARE
           due_date DATE := (l_disbursed + INTERVAL '30 days')::DATE;
           actual_od INT := GREATEST(0, (CURRENT_DATE - due_date));
           capped_od INT := LEAST(actual_od, 60); -- FREEZE_AFTER = 60
       BEGIN
           -- Expected penalty based on current date
           calc_penalty := (l_balance * 0.012) * capped_od;
           -- Ensure DB state is at least what it should be today
           l_penalties := GREATEST(l_penalties, ROUND(calc_penalty));
       END;
    END IF;

    -- C) WATERFALL: PAY OFF PENALTIES FIRST
    IF l_penalties > 0 THEN
        IF p_amount >= l_penalties THEN
            p_amount := p_amount - l_penalties;
            l_penalties := 0;
        ELSE
            l_penalties := l_penalties - p_amount;
            p_amount := 0;
        END IF;
    END IF;

    -- D) WATERFALL: PAY OFF PRINCIPAL BALANCE SECOND
    IF p_amount > 0 THEN
        l_balance := GREATEST(l_balance - p_amount, 0);
    END IF;

    -- E) APPLY UPDATES TO LOAN
    UPDATE public.loans 
       SET balance   = l_balance,
           penalties = l_penalties,
           status    = CASE WHEN (l_balance <= 0 AND l_penalties <= 0) THEN 'Settled'::text ELSE status END,
           settled_at = CASE WHEN (l_balance <= 0 AND l_penalties <= 0) THEN NOW() ELSE settled_at END
     WHERE id = NEW.loan_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS trg_apply_payment ON public.payments;
CREATE TRIGGER trg_apply_payment
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.apply_payment_to_loan();


-- 2. REFACTOR RPC: finalize_c2b_allocation
-- Removing manual 'UPDATE loans' to prevent conflicts with the Master Trigger.
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

      -- The insertion below will fire trg_apply_payment, which handles all math.
      INSERT INTO payments (
          customer_id, customer_name, loan_id, amount, mpesa, date, status, allocated_by, note
      )
      VALUES (
          p_customer_id, v_customer_name, v_loan_id, p_amount, p_trans_id, CURRENT_DATE, 'Allocated', 'System Engine', 'C2B Paybill Match'
      );
  ELSE
      INSERT INTO public.unallocated_payments (mpesa_transaction_id, reason)
      VALUES (v_transaction_internal_id, p_reason);
  END IF;

  RETURN jsonb_build_object('success', true, 'internal_id', v_transaction_internal_id);
END;
$$;


-- 3. REFACTOR RPC: apply_c2b_payment
-- Removing manual 'UPDATE loans' to prevent conflicts with the Master Trigger.
CREATE OR REPLACE FUNCTION apply_c2b_payment(
  p_customer_id TEXT, p_customer_name TEXT, p_loan_id TEXT, p_amount NUMERIC,
  p_mpesa_txid TEXT, p_date DATE, p_note TEXT
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

  -- The insertion below will fire trg_apply_payment, which handles all math.
  INSERT INTO payments (
    customer_id, customer_name, loan_id, amount, mpesa, date, status, allocated_by, is_reg_fee, note
  )
  VALUES (
    p_customer_id, p_customer_name, p_loan_id, p_amount, p_mpesa_txid, p_date, v_payment_status, 'System Engine', v_is_reg_fee, p_note
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;
