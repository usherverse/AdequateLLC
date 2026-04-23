import { supabase } from '../../config/supabaseClient.js';
import * as Mpesa from './mpesa.client.js';

/**
 * RECONCILIATION SERVICE
 * ----------------------
 * This script resolves "hung" transactions where Safaricom failed 
 * to send a callback or the server was down during the callback.
 */

export const reconcileHungStkRequests = async () => {
  console.log('[Reconcile] Checking for pending STK requests...');

  // 1. Fetch STK requests that have been pending for more than 5 minutes
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: pendingRequests, error } = await supabase
    .from('stk_requests')
    .select('*')
    .eq('status', 'Pending')
    .lt('created_at', fiveMinsAgo);

  if (error) {
    console.error('[Reconcile] Error fetching pending STK:', error.message);
    return;
  }

  console.log(`[Reconcile] Found ${pendingRequests?.length || 0} hung STK requests.`);

  for (const req of (pendingRequests || [])) {
    try {
      console.log(`[Reconcile] Querying Safaricom for CheckoutRequestID: ${req.checkout_request_id}`);
      
      const result = await Mpesa.stkQuery(req.checkout_request_id);
      
      // M-Pesa Query ResultCodes:
      // '0'   -> Success
      // '1032' -> Cancelled by user
      // '1'    -> Insufficient balance, etc.
      // 'v1_Timeout' -> Still processing or never reached phone
      
      const resultCode = parseInt(result.ResultCode);
      const resultDesc = result.ResultDesc;

      if (resultCode === 0) {
        // SUCCESS CASE: Proceed to allocate
        await resolveSuccessfulStk(req, resultDesc);
      } else if (resultCode === 1032 || resultCode === 1) {
        // KNOWN FAILURE: Mark as failed
        await resolveFailedStk(req, resultCode, resultDesc);
      } else {
        console.warn(`[Reconcile] Unexpected ResultCode ${resultCode} for ${req.checkout_request_id}. Manual review may be needed.`);
      }
    } catch (err) {
      console.error(`[Reconcile] Failed to reconcile ${req.checkout_request_id}:`, err.message);
    }
  }
};

/**
 * Logic to finalize a discovered successful STK push
 */
async function resolveSuccessfulStk(request, desc) {
  console.log(`[Reconcile] ✅ Finalizing successful STK for Request ${request.id}`);

  // 1. Update request status
  await supabase
    .from('stk_requests')
    .update({ status: 'Completed', result_code: 0, result_desc: desc })
    .eq('id', request.id);

  // 2. Register customer and log payment
  const { data: customer } = await supabase
    .from('customers')
    .select('name')
    .eq('id', request.reference)
    .single();

  await supabase
    .from('customers')
    .update({ mpesa_registered: true })
    .eq('id', request.reference);

  await supabase.from('payments').insert([{
    customer_id: request.reference,
    customer_name: customer?.name || null,
    amount: request.amount || 500,
    status: 'Allocated',
    is_reg_fee: true,
    note: 'Reconciled: M-Pesa STK Push Registration Fee'
  }]);

  await supabase.from('audit_log').insert([{
    user_name: 'System (Reconciliation)',
    action: 'Payment Resolved',
    target_id: request.reference,
    detail: `STK push resolved via reconciliation job. ID: ${request.checkout_request_id}`
  }]);
}

/**
 * Logic to finalize a discovered failed STK push
 */
async function resolveFailedStk(request, code, desc) {
  console.log(`[Reconcile] ❌ Marking failed STK for Request ${request.id} (Code: ${code})`);
  
  await supabase
    .from('stk_requests')
    .update({ status: 'Failed', result_code: code, result_desc: desc })
    .eq('id', request.id);

  await supabase.from('audit_log').insert([{
    user_name: 'System (Reconciliation)',
    action: 'Payment Failed (Resolved)',
    target_id: request.reference,
    detail: `STK push marked failed via reconciliation. Code: ${code}. Desc: ${desc}`
  }]);
}

// Export for use in a cron job or manual trigger
export const runFullReconciliation = async () => {
  await reconcileHungStkRequests();
  // Future: reconcileHungB2CDisbursements();
};
