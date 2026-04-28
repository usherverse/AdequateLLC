-- Migration: Universal Reversal Engine
-- Implements reversal logic for payments and disbursements.

CREATE OR REPLACE FUNCTION public.reverse_transaction(
    p_type TEXT, -- 'payment' or 'disbursement'
    p_id TEXT,   -- ID of the record
    p_reason TEXT,
    p_reversed_by TEXT DEFAULT 'System Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loan_id TEXT;
    v_amount  DECIMAL;
    v_status  TEXT;
BEGIN
    IF p_type = 'payment' THEN
        -- 1. Get Payment Details
        SELECT loan_id, amount, status INTO v_loan_id, v_amount, v_status
        FROM public.payments WHERE id = p_id;

        IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Payment not found'); END IF;
        IF v_status = 'Reversed' THEN RETURN jsonb_build_object('success', false, 'message', 'Payment already reversed'); END IF;

        -- 2. Undo the balance reduction in Loans
        IF v_loan_id IS NOT NULL THEN
            UPDATE public.loans 
            SET balance = balance + v_amount,
                status = CASE WHEN status = 'Settled' THEN 'Active' ELSE status END
            WHERE id = v_loan_id;
        END IF;

        -- 3. Update Payment Status
        UPDATE public.payments 
        SET status = 'Reversed', 
            note = COALESCE(note, '') || ' | REVERSED: ' || p_reason 
        WHERE id = p_id;

    ELSIF p_type = 'disbursement' THEN
        -- 1. Get Disbursement Details
        SELECT loan_id, amount, status INTO v_loan_id, v_amount, v_status
        FROM public.b2c_disbursements WHERE id = p_id;

        IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Disbursement not found'); END IF;
        IF v_status = 'Reversed' THEN RETURN jsonb_build_object('success', false, 'message', 'Disbursement already reversed'); END IF;

        -- 2. Undo the balance increase (Disbursements usually increase balance or start it)
        -- In this system, disbursements often mark a loan as 'Active'
        IF v_loan_id IS NOT NULL THEN
            UPDATE public.loans 
            SET balance = GREATEST(balance - v_amount, 0),
                status = CASE WHEN balance - v_amount <= 0 THEN 'Approved' ELSE status END
            WHERE id = v_loan_id;
        END IF;

        -- 3. Update Disbursement Status
        UPDATE public.b2c_disbursements 
        SET status = 'Reversed'
        WHERE id = p_id;

    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid transaction type');
    END IF;

    -- 4. Log to Audit
    INSERT INTO public.audit_log (ts, worker_name, action, target_id, summary)
    VALUES (NOW(), p_reversed_by, 'Transaction Reversed', p_id, 'Type: ' || p_type || '. Reason: ' || p_reason);

    RETURN jsonb_build_object('success', true);
END;
$$;
