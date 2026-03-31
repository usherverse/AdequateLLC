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
export async function initiateStkPush({ amount, phone_number, customer_id }) {
  if (DEMO_MODE) {
    console.warn('[M-Pesa] STK Push simulated in Demo Mode');
    return { success: true, message: 'Demo Mode: Push simulated' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
      body: { amount, phone_number, customer_id }
    });

    if (error) throw error;
    return data; // { success: true, message: "..." }
  } catch (err) {
    console.error('[M-Pesa] STK Push failed:', err.message);
    throw err;
  }
}

/**
 * initiateB2cDisbursement
 * Triggers an M-Pesa B2C Disbursement (sending money to customer).
 * @param {string} loan_id — The ID of the approved loan to disburse.
 */
export async function initiateB2cDisbursement(loan_id) {
  if (DEMO_MODE) {
    console.warn('[M-Pesa] B2C Disbursement simulated in Demo Mode');
    return { success: true, message: 'Demo Mode: Disbursement simulated' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('mpesa-b2c-disburse', {
      body: { loan_id }
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[M-Pesa] B2C Disbursement failed:', err.message);
    throw err;
  }
}
