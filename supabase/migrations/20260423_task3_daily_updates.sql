-- ================================================================
-- MIGRATION: Fix Daily Loan Updates Persistence (Task 3)
-- Focus: Ensure penalties and status updates happen exactly once per day.
-- ================================================================

-- 1. Add tracking column for penalty updates
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS last_penalty_update TIMESTAMPTZ;

-- 2. Update the daily process function to be idempotent
CREATE OR REPLACE FUNCTION public.process_daily_loan_updates() 
RETURNS JSON AS $$
DECLARE
    affected_count INT;
BEGIN
    -- A) Update days overdue for Active/Overdue loans where expected completion is past
    UPDATE public.loans 
    SET days_overdue = EXTRACT(DAY FROM (NOW() - expected_completion_date))::INT
    WHERE status IN ('Active', 'Overdue') AND expected_completion_date < NOW();
    
    -- B) Mark loans as Overdue if days overdue > 0
    UPDATE public.loans 
    SET status = 'Overdue' 
    WHERE status = 'Active' AND days_overdue > 0;

    -- C) Apply penalty (1% of balance) ONLY IF not already done today (Idempotency Guard)
    -- This prevents double-charging if the script runs multiple times in one day.
    WITH updated AS (
        UPDATE public.loans
        SET 
            penalties = LEAST(penalties + (balance * 0.01), 3650),
            last_penalty_update = NOW()
        WHERE 
            status = 'Overdue' 
            AND balance > 0
            AND (last_penalty_update IS NULL OR last_penalty_update < CURRENT_DATE)
        RETURNING id
    )
    SELECT COUNT(*) INTO affected_count FROM updated;

    -- D) Update Loan Schedules Status
    UPDATE public.loan_schedules
    SET status = 'overdue', days_overdue = EXTRACT(DAY FROM (NOW() - due_date))::INT
    WHERE status IN ('upcoming', 'due_today', 'partial') AND due_date < NOW()::DATE;

    UPDATE public.loan_schedules
    SET status = 'due_today'
    WHERE status = 'upcoming' AND due_date = NOW()::DATE;

    RETURN json_build_object(
        'success', true,
        'timestamp', NOW(),
        'penalties_applied_to', affected_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure only service_role (backend) can trigger this
REVOKE EXECUTE ON FUNCTION public.process_daily_loan_updates() FROM public;
REVOKE EXECUTE ON FUNCTION public.process_daily_loan_updates() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_daily_loan_updates() TO service_role;