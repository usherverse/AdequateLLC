-- ================================================================
-- MIGRATION: Partial Payment Reminders Logic
-- Focus: Identifying who needs an SMS reminder at 7am/7pm.
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_reminder_queue(p_hour INT)
RETURNS TABLE (
    loan_id TEXT,
    customer_name TEXT,
    phone TEXT,
    balance DECIMAL,
    due_date DATE,
    repayment_type TEXT,
    message_type TEXT -- 'morning_reminder', 'evening_alert', 'pre_due_reminder'
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH loan_data AS (
        SELECT 
            l.id,
            l.customer_name,
            c.phone,
            l.balance,
            -- Calculate due date (assuming 30 days from disbursement for now, adjust if needed)
            (l.disbursed + INTERVAL '30 days')::DATE as final_due_date,
            l.repayment_type,
            l.disbursed::DATE as start_date,
            CURRENT_DATE as today,
            (CURRENT_DATE + INTERVAL '1 day')::DATE as tomorrow,
            EXISTS (
                SELECT 1 FROM payments p 
                WHERE p.loan_id = l.id 
                  AND p.status = 'Allocated' 
                  AND p.date = CURRENT_DATE
            ) as paid_today
        FROM loans l
        JOIN customers c ON l.customer_id = c.id
        WHERE l.status IN ('Active', 'Overdue')
          AND l.balance > 0
    )
    SELECT 
        ld.id, ld.customer_name, ld.phone, ld.balance, ld.final_due_date, ld.repayment_type,
        CASE
            -- 7 AM LOGIC
            WHEN p_hour = 7 THEN
                CASE
                    -- Daily: Every morning if not paid today
                    WHEN ld.repayment_type = 'Daily' AND NOT ld.paid_today THEN 'morning_reminder'
                    -- Weekly/Biweekly/Monthly: On the exact due day
                    WHEN ld.repayment_type != 'Daily' AND (
                        (ld.repayment_type = 'Weekly' AND (ld.today - ld.start_date) % 7 = 0) OR
                        (ld.repayment_type = 'Biweekly' AND (ld.today - ld.start_date) % 14 = 0) OR
                        (ld.repayment_type = 'Monthly' AND EXTRACT(DAY FROM ld.today) = EXTRACT(DAY FROM ld.start_date))
                    ) THEN 'morning_reminder'
                    ELSE NULL
                END
            
            -- 7 PM LOGIC
            WHEN p_hour = 19 THEN
                CASE
                    -- Daily: Alert if still not paid
                    WHEN ld.repayment_type = 'Daily' AND NOT ld.paid_today THEN 'evening_alert'
                    -- Weekly/etc: Day Before Reminder
                    WHEN ld.repayment_type != 'Daily' AND (
                        (ld.repayment_type = 'Weekly' AND (ld.tomorrow - ld.start_date) % 7 = 0) OR
                        (ld.repayment_type = 'Biweekly' AND (ld.tomorrow - ld.start_date) % 14 = 0) OR
                        (ld.repayment_type = 'Monthly' AND EXTRACT(DAY FROM ld.tomorrow) = EXTRACT(DAY FROM ld.start_date))
                    ) THEN 'pre_due_reminder'
                    -- Weekly/etc: Alert if today was due day and still not paid
                    WHEN ld.repayment_type != 'Daily' AND NOT ld.paid_today AND (
                        (ld.repayment_type = 'Weekly' AND (ld.today - ld.start_date) % 7 = 0) OR
                        (ld.repayment_type = 'Biweekly'AND (ld.today - ld.start_date) % 14 = 0) OR
                        (ld.repayment_type = 'Monthly' AND EXTRACT(DAY FROM ld.today) = EXTRACT(DAY FROM ld.start_date))
                    ) THEN 'evening_alert'
                    ELSE NULL
                END
            ELSE NULL
        END as m_type
    FROM loan_data ld
    WHERE (
        -- Filter out the NULL cases from the big CASE statement above
        CASE
            WHEN p_hour = 7 THEN (
                (ld.repayment_type = 'Daily' AND NOT ld.paid_today) OR
                (ld.repayment_type != 'Daily' AND (
                    (ld.repayment_type = 'Weekly' AND (ld.today - ld.start_date) % 7 = 0) OR
                    (ld.repayment_type = 'Biweekly' AND (ld.today - ld.start_date) % 14 = 0) OR
                    (ld.repayment_type = 'Monthly' AND EXTRACT(DAY FROM ld.today) = EXTRACT(DAY FROM ld.start_date))
                ))
            )
            WHEN p_hour = 19 THEN (
                (ld.repayment_type = 'Daily' AND NOT ld.paid_today) OR
                (ld.repayment_type != 'Daily' AND (
                    (ld.repayment_type = 'Weekly' AND (ld.tomorrow - ld.start_date) % 7 = 0) OR
                    (ld.repayment_type = 'Biweekly' AND (ld.tomorrow - ld.start_date) % 14 = 0) OR
                    (ld.repayment_type = 'Monthly' AND EXTRACT(DAY FROM ld.tomorrow) = EXTRACT(DAY FROM ld.start_date)) OR
                    -- Also alert if today was due day and unpaid
                    (NOT ld.paid_today AND (
                        (ld.repayment_type = 'Weekly' AND (ld.today - ld.start_date) % 7 = 0) OR
                        (ld.repayment_type = 'Biweekly' AND (ld.today - ld.start_date) % 14 = 0) OR
                        (ld.repayment_type = 'Monthly' AND EXTRACT(DAY FROM ld.today) = EXTRACT(DAY FROM ld.start_date))
                    ))
                ))
            )
            ELSE FALSE
        END
    );
END;
$$;
