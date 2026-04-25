-- Final Robust Global Wipe RPC (FK-safe, audit_log immutable-aware)
-- Deletes in correct dependency order. audit_log is immutable so we skip it.

CREATE OR REPLACE FUNCTION public.global_wipe(include_workers BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
BEGIN
    -- 1. Clear FK-dependent child tables first
    DELETE FROM public.registration_fees; -- FK → customers
    DELETE FROM public.stk_requests;
    DELETE FROM public.mpesa_transactions;
    DELETE FROM public.b2c_disbursements;

    -- 2. Clear financial data (FK → customers, loans)
    DELETE FROM public.payments;
    DELETE FROM public.repossessed_assets;
    DELETE FROM public.interactions;
    DELETE FROM public.loans;

    -- 3. Clear other operational data
    DELETE FROM public.leads;
    DELETE FROM public.salary_payments;
    DELETE FROM public.worker_deductions;
    DELETE FROM public.monthly_targets;

    -- 4. Clear customers (now safe — all FK children removed)
    DELETE FROM public.customers;

    -- 5. Clear workers (Selective — keep Admins/Directors)
    IF include_workers THEN
        DELETE FROM public.workers WHERE role NOT IN ('Super Admin', 'Admin', 'Director');
    END IF;

    -- NOTE: audit_log is IMMUTABLE (insert-only trigger) — we do NOT delete from it.
    -- Log the wipe action instead.
    INSERT INTO public.audit_log (ts, user_name, action, target_id, detail)
    VALUES (NOW(), 'System', 'GLOBAL WIPE', 'ALL', 'Atomic server-side purge completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
