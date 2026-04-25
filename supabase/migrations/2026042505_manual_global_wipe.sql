-- Manual Wipe for Persistent Ghost Records
-- This script cleans up orphaned records that might be causing the "Enock" ghost customer to reappear.

BEGIN;

-- 1. Clear M-Pesa logs which are the primary source of "resurrection"
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

-- 5. Clear workers EXCEPT for Admins
DELETE FROM public.workers WHERE role NOT IN ('Super Admin', 'Admin', 'Director');

COMMIT;
