import { supabase, DEMO_MODE } from '@/config/supabaseClient';

/**
 * mpesa.js — Frontend Gateway for Daraja Edge Functions
 * ───────────────────────────────────────────────────
 */

/**
 * initiateStkPush
 * Triggers an M-Pesa STK Push prompt to the customer's phone.
 * @param {object} params — { amount, phone_number, customer_id }
 */
/**
 * initiateStkPush
 * Triggers an M-Pesa STK Push prompt to the customer's phone via the Express API.
 * @param {object} params — { amount, phone_number, customer_id }
 */
export async function initiateStkPush({ amount, phone_number, customer_id }) {
  if (DEMO_MODE) {
    console.warn('[M-Pesa] STK Push simulated in Demo Mode');
    return { success: true, message: 'Demo Mode: Push simulated' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/payments/registration-fee/stk-push`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ customerId: customer_id, phone: phone_number })
    });
    
    const res = await response.json();
    if (!response.ok) throw new Error(res.error || 'STK Push failed');
    return { success: true, ...res };
  } catch (err) {
    console.error('[M-Pesa] STK Push failed:', err.message);
    throw err;
  }
}

/**
 * initiateB2cDisbursement
 * Triggers an M-Pesa B2C Disbursement (sending money to customer) via the Express API.
 * @param {string} loan_id — The ID of the approved loan to disburse.
 */
export async function initiateB2cDisbursement(loan_id) {
  if (DEMO_MODE) {
    console.warn('[M-Pesa] B2C Disbursement simulated in Demo Mode');
    return { success: true, message: 'Demo Mode: Disbursement simulated' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/payments/disbursements/${loan_id}/disburse`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const res = await response.json();
    if (!response.ok) throw new Error(res.error || 'Disbursement failed');
    return { success: true, ...res };
  } catch (err) {
    console.error('[M-Pesa] B2C Disbursement failed:', err.message);
    throw err;
  }
}
