-- ================================================================
-- MIGRATION: Financial Integrity Fix (Task 4)
-- Focus: Payment Waterfall (Penalties -> Principal)
-- ================================================================

-- Update the Payment Application Trigger to handle penalties correctly.
-- Payments now clear 'penalties' first before reducing the 'balance' (principal + interest).
CREATE OR REPLACE FUNCTION public.apply_payment_to_loan() 
RETURNS TRIGGER AS $$
DECLARE
    p_amount DECIMAL := NEW.amount;
    l_penalties DECIMAL;
    l_balance DECIMAL;
BEGIN
    -- 1. Get current liability (Lock row to prevent race conditions during trigger)
    SELECT penalties, balance INTO l_penalties, l_balance 
    FROM public.loans WHERE id = NEW.loan_id FOR UPDATE;

    -- 2. A) Pay off penalties first
    IF l_penalties > 0 THEN
        IF p_amount >= l_penalties THEN
            -- Payment covers all penalties
            UPDATE public.loans 
            SET penalties = 0 
            WHERE id = NEW.loan_id;
            p_amount := p_amount - l_penalties;
        ELSE
            -- Payment covers partial penalties
            UPDATE public.loans 
            SET penalties = penalties - p_amount 
            WHERE id = NEW.loan_id;
            p_amount := 0;
        END IF;
    END IF;

    -- 3. B) Pay off balance with remainder
    IF p_amount > 0 THEN
        UPDATE public.loans 
        SET balance = GREATEST(balance - p_amount, 0) 
        WHERE id = NEW.loan_id 
        RETURNING balance INTO l_balance;
    ELSE
        -- No remainder left for principal
        l_balance := l_balance;
    END IF;

    -- 4. C) Final status update
    -- Loan is only Settled if BOTH principal and penalties are cleared
    -- Re-check penalties to be sure
    IF l_balance <= 0 AND (SELECT penalties FROM public.loans WHERE id = NEW.loan_id) <= 0 THEN
        UPDATE public.loans 
        SET status = 'Settled' 
        WHERE id = NEW.loan_id;
    ELSE
        -- If it was settled but now has a balance (e.g. adjustment), revert to Active
        IF l_balance > 0 THEN
            UPDATE public.loans SET status = 'Active' WHERE id = NEW.loan_id AND status = 'Settled';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger is attached (it should be from v4, but we recreate to be sure)
DROP TRIGGER IF EXISTS trg_apply_payment ON public.payments;
CREATE TRIGGER trg_apply_payment
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.apply_payment_to_loan();
