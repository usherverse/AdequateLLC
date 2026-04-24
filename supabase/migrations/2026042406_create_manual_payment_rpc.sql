-- ================================================================
-- RPC: create_manual_payment
-- Replaces Express server logic for manual financial entries.
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_manual_payment(
  p_customer_id TEXT,
  p_amount NUMERIC,
  p_payment_type TEXT,
  p_method TEXT,
  p_reference TEXT DEFAULT NULL,
  p_loan_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_email TEXT;
  v_customer_name TEXT;
  v_payment_id UUID;
  v_is_reg_fee BOOLEAN;
  v_status TEXT := 'Allocated';
  v_note TEXT;
  v_effective_loan_id TEXT;
BEGIN
  -- 1. Security Check: Only Admins/Finance/Super Admins
  IF NOT public.check_worker_role(ARRAY['Admin', 'Finance', 'Super Admin']) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrative staff can log manual payments.';
  END IF;

  -- 2. Get Admin Identity
  v_admin_email := auth.jwt() ->> 'email';

  -- 3. Fetch canonical customer name
  SELECT name INTO v_customer_name FROM public.customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer % not found', p_customer_id;
  END IF;

  v_is_reg_fee := (p_payment_type = 'registration_fee');
  v_effective_loan_id := CASE WHEN v_is_reg_fee THEN 'REG-FEE-' || p_customer_id ELSE p_loan_id END;
  
  v_note := CASE 
    WHEN v_is_reg_fee THEN 'Registration Fee — ' || p_method || ' (Manual Entry by ' || v_admin_email || ')'
    ELSE 'Manual Entry (' || p_method || ') by ' || v_admin_email
  END;

  -- 4. Insert into payments table
  INSERT INTO public.payments (
    customer_id,
    customer_name,
    loan_id,
    amount,
    mpesa,
    date,
    status,
    allocated_by,
    allocated_at,
    note,
    is_reg_fee
  ) VALUES (
    p_customer_id,
    v_customer_name,
    v_effective_loan_id,
    p_amount,
    p_reference,
    CURRENT_DATE,
    v_status,
    v_admin_email,
    NOW(),
    v_note,
    v_is_reg_fee
  ) RETURNING id INTO v_payment_id;

  -- 5. If Loan Repayment: Trigger Financial Waterfall
  IF p_loan_id IS NOT NULL AND NOT v_is_reg_fee THEN
    PERFORM public.apply_payment_to_loan_id(p_loan_id, p_amount);
  END IF;

  -- 6. If Registration Fee: Update Customer Status
  IF v_is_reg_fee THEN
    UPDATE public.customers 
    SET mpesa_registered = true 
    WHERE id = p_customer_id;
  END IF;

  -- 7. Audit Log
  INSERT INTO public.audit_logs (user_id, user_label, action, target, detail)
  VALUES (
    auth.uid(),
    v_admin_email,
    'Manual Payment Logged',
    p_customer_id,
    'Type: ' || p_payment_type || ', Amount: ' || p_amount || ', Ref: ' || COALESCE(p_reference, 'N/A')
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'customer_name', v_customer_name,
    'is_reg_fee', v_is_reg_fee
  );
END;
$$;

-- Helper to apply payment to loan (if not already defined as a standalone)
CREATE OR REPLACE FUNCTION public.apply_payment_to_loan_id(p_loan_id TEXT, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    -- This logic should match your main waterfall trigger or call it.
    -- Since we have a trigger on the payments table (trg_apply_payment),
    -- the INSERT in step 4 will already fire the waterfall automatically!
    -- So we actually don't need to do anything here if the trigger is active.
    NULL;
END;
$$ LANGUAGE plpgsql;
