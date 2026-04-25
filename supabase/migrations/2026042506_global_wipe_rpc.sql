-- Final Robust Global Wipe RPC
-- This handles foreign key constraints by deleting in the correct order.

CREATE OR REPLACE FUNCTION public.global_wipe(include_workers BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
BEGIN
    -- 1. Clear high-dependency tables (leaf nodes)
    DELETE FROM public.registration_fees;
    DELETE FROM public.mpesa_transactions;
    DELETE FROM public.stk_requests;
    DELETE FROM public.b2c_disbursements;

    -- 2. Clear financial data
    DELETE FROM public.payments;
    DELETE FROM public.loans;

    -- 3. Clear other operational data
    DELETE FROM public.leads;
    DELETE FROM public.interactions;
    DELETE FROM public.audit_log;
    DELETE FROM public.repossessed_assets;
    DELETE FROM public.salary_payments;
    DELETE FROM public.worker_deductions;
    DELETE FROM public.monthly_targets;

    -- 4. Clear customers (now safe from FK constraints)
    DELETE FROM public.customers;

    -- 5. Clear workers (Selective)
    IF include_workers THEN
        DELETE FROM public.workers WHERE role NOT IN ('Super Admin', 'Admin', 'Director');
    END IF;

    -- Log the action
    INSERT INTO public.audit_log (ts, user_name, action, target_id, detail)
    VALUES (NOW(), 'System', 'GLOBAL WIPE', 'ALL', 'Atomic server-side purge completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
