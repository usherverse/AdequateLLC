-- Function to perform a complete global wipe securely on the server
-- This prevents race conditions and orphaned records from triggering backfills.

CREATE OR REPLACE FUNCTION public.global_wipe(include_workers BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
BEGIN
    -- 1. Clear M-Pesa logs (The "Resurrection" Source)
    DELETE FROM public.stk_requests;
    DELETE FROM public.mpesa_transactions;
    DELETE FROM public.b2c_disbursements;

    -- 2. Clear financial records
    DELETE FROM public.payments;
    DELETE FROM public.loans;

    -- 3. Clear customer records
    DELETE FROM public.customers;

    -- 4. Clear other operational data
    DELETE FROM public.leads;
    DELETE FROM public.interactions;
    DELETE FROM public.audit_log;
    DELETE FROM public.repossessed_assets;
    DELETE FROM public.salary_payments;
    DELETE FROM public.worker_deductions;
    DELETE FROM public.monthly_targets;

    -- 5. Clear workers (Selective)
    IF include_workers THEN
        DELETE FROM public.workers WHERE role NOT IN ('Super Admin', 'Admin', 'Director');
    END IF;

    -- Log the action
    INSERT INTO public.audit_log (ts, user_name, action, target_id, detail)
    VALUES (NOW(), 'System', 'GLOBAL WIPE', 'ALL', 'Complete server-side wipe performed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
