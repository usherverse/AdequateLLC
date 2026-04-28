-- Migration: Customer Risk Profiling Engine
-- Calculates a dynamic risk profile based on active arrears and historical repayment behavior.

CREATE OR REPLACE VIEW public.customer_risk_profiles AS
WITH loan_metrics AS (
    SELECT 
        customer_id,
        COUNT(*) as total_loans,
        COUNT(*) FILTER (WHERE status = 'Settled') as settled_loans,
        COALESCE(MAX(days_overdue), 0) as max_overdue_days,
        AVG(CASE WHEN status = 'Settled' THEN 0 ELSE days_overdue END) as avg_current_overdue,
        SUM(balance) as total_outstanding,
        SUM(amount) as total_borrowed
    FROM public.loans
    GROUP BY customer_id
),
payment_metrics AS (
    SELECT 
        customer_id,
        COUNT(*) as payment_count,
        MAX(date) as last_payment_date,
        SUM(amount) as total_repaid
    FROM public.payments
    WHERE status = 'Allocated'
    GROUP BY customer_id
)
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    COALESCE(lm.total_loans, 0) as total_loans,
    COALESCE(lm.max_overdue_days, 0) as max_overdue_days,
    COALESCE(lm.total_outstanding, 0) as total_outstanding,
    COALESCE(pm.payment_count, 0) as payment_count,
    CASE 
        WHEN lm.max_overdue_days > 30 THEN 'Critical'
        WHEN lm.max_overdue_days > 14 THEN 'High'
        WHEN lm.max_overdue_days > 0 THEN 'Medium'
        WHEN lm.total_loans > 3 AND lm.max_overdue_days = 0 THEN 'A+'
        WHEN lm.total_loans > 0 AND lm.max_overdue_days = 0 THEN 'Low'
        ELSE 'New'
    END as calculated_risk,
    CASE
        WHEN pm.payment_count > (lm.total_loans * 4) THEN 'Frequent Partial'
        WHEN pm.payment_count > 0 THEN 'Standard'
        ELSE 'No History'
    END as repayment_style
FROM public.customers c
LEFT JOIN loan_metrics lm ON c.id = lm.customer_id
LEFT JOIN payment_metrics pm ON c.id = pm.customer_id;

-- Function to update the risk field in the customers table periodically or via trigger
CREATE OR REPLACE FUNCTION public.refresh_customer_risk_profile()
RETURNS void AS $$
BEGIN
    UPDATE public.customers c
    SET risk = rp.calculated_risk
    FROM public.customer_risk_profiles rp
    WHERE c.id = rp.customer_id;
END;
$$ LANGUAGE plpgsql;
