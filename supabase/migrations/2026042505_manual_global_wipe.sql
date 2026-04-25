-- Manual Wipe for Persistent Ghost Records (FK-safe order)
-- This script cleans up orphaned records that might be causing ghost customers to reappear.

BEGIN;

-- 1. Clear FK-dependent child tables first (registration_fees → customers)
DELETE FROM public.registration_fees;
DELETE FROM public.stk_requests;
DELETE FROM public.mpesa_transactions;
DELETE FROM public.b2c_disbursements;

-- 2. Clear financial records (payments/loans before customers)
DELETE FROM public.payments;
DELETE FROM public.loans;
DELETE FROM public.repossessed_assets;
DELETE FROM public.interactions;

-- 3. Now safe to clear customers (all FK children removed)
DELETE FROM public.customers;

-- 4. Clear other operational data
DELETE FROM public.leads;
DELETE FROM public.salary_payments;
DELETE FROM public.worker_deductions;
DELETE FROM public.monthly_targets;

-- 5. Clear workers EXCEPT for Admins
DELETE FROM public.workers WHERE role NOT IN ('Super Admin', 'Admin', 'Director');

COMMIT;
