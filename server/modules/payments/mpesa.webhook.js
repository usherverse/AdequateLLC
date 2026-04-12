import express from 'express';
import { supabase } from '../../config/db.js';
import * as MpesaService from './payments.service.js';

const router = express.Router();

// Connectivity Monitor
router.use((req, res, next) => {
  console.log(`[M-Pesa Webhook] INCOMING: ${req.method} ${req.originalUrl}`);
  next();
});

/**
 * Safaricom IP Range Validation Middleware
 */
const validateSafaricomIP = (req, res, next) => {
  // Now that 'trust proxy' is enabled, Express securely extracts the real client IP for us
  const ip = req.ip;

  // Safaricom Whitelist Ranges (Provided by user)
  const whitelist = [
    '196.201.214',
    '196.201.213',
    '196.201.212',
    '196.201.215',
    '196.201.136',
    '196.201.150'
  ];

  const ipMatch = whitelist.some(range => ip && ip.startsWith(range));
  
  // In development/sandbox, we might want to skip this or allow more IPs
  if (process.env.MPESA_ENVIRONMENT === 'production' && !ipMatch) {
    console.warn(`[Webhook] Blocked unauthorized IP: ${ip}`);
    return res.status(403).json({ error: 'Unauthorized IP' });
  }

  next();
};

router.use(validateSafaricomIP);

/**
 * POST /webhooks/mpesa/stk-callback
 */
router.post('/stk-callback', async (req, res) => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;
    const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = stkCallback;

    console.log(`[Webhook] STK Callback: ${ResultDesc} (${ResultCode})`);

    let meta = {};
    if (CallbackMetadata && CallbackMetadata.Item) {
      CallbackMetadata.Item.forEach(item => {
        meta[item.Name] = item.Value;
      });
    }

    const mpesa_receipt_no = meta.MpesaReceiptNumber;
    const amount = meta.Amount;
    
    const status = ResultCode === 0 ? 'Completed' : 'Failed';

    const { data: request } = await supabase
      .from('stk_requests')
      .update({
        mpesa_receipt: mpesa_receipt_no,
        status,
        result_code: ResultCode,
        result_desc: ResultDesc
      })
      .eq('checkout_request_id', CheckoutRequestID)
      .select()
      .single();

    if (request && status === 'Completed') {
      // 1. Mark Customer as Registered = True
      await supabase
        .from('customers')
        .update({ mpesa_registered: true })
        .eq('id', request.reference);

      // 2. Insert into payments table
      await supabase
        .from('payments')
        .insert([{
          customer_id: request.reference,
          amount: amount || 500,
          mpesa: mpesa_receipt_no,
          date: new Date().toISOString().split('T')[0],
          status: 'Allocated',
          is_reg_fee: true,
          note: 'M-Pesa STK Push Registration Fee'
        }]);

      await supabase.from('audit_log').insert([{
        user_name: 'System',
        action: 'Reg Fee Confirmed',
        target_id: request.reference,
        detail: `M-Pesa STK push completed OK. Receipt: ${mpesa_receipt_no}`
      }]);
    } else if (request && status === 'Failed') {
      await supabase.from('audit_log').insert([{
        user_name: 'System',
        action: 'Reg Fee Push Failed',
        target_id: request.reference,
        detail: `STK push failed. Code: ${ResultCode}, Desc: ${ResultDesc}`
      }]);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (err) {
    console.error('[Webhook] STK Error:', err.message);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal Error' });
  }
});

/**
 * POST /webhooks/mpesa/b2c-result
 */
router.post('/b2c-result', async (req, res) => {
  try {
    const { Result } = req.body;
    if (!Result) {
      console.error('[Webhook] B2C Result missing in body:', JSON.stringify(req.body));
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Result missing' });
    }

    const { ResultCode, ResultDesc, TransactionID, OriginatorConversationID, ConversationID } = Result;
    console.log(`[Webhook] B2C Callback Hit: ${ResultDesc} (Code: ${ResultCode}) | OrigConvID: ${OriginatorConversationID}`);

    const status = ResultCode === 0 ? 'Completed' : 'Failed';

    // 1. Update the B2C Disbursement record
    // We use originator_conversation_id as the primary lookup
    let { data: disb, error: updateError } = await supabase
      .from('b2c_disbursements')
      .update({
        mpesa_receipt: TransactionID || null,
        status,
        result_code: ResultCode,
        result_desc: ResultDesc,
        updated_at: new Date().toISOString()
      })
      .eq('originator_conversation_id', OriginatorConversationID)
      .select()
      .maybeSingle();

    if (!disb && !updateError) {
      console.warn(`[Webhook] B2C RECORD NOT FOUND for OriginatorConversationID: ${OriginatorConversationID}. Trying fallback to ConversationID...`);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('b2c_disbursements')
        .update({
          mpesa_receipt: TransactionID || null,
          status,
          result_code: ResultCode,
          result_desc: ResultDesc,
          updated_at: new Date().toISOString()
        })
        .eq('conversation_id', ConversationID)
        .select()
        .maybeSingle();
      
      disb = fallbackData;
      updateError = fallbackError;
    }

    if (updateError) {
      console.error('[Webhook] B2C Database Error:', updateError.message);
      return res.status(500).json({ ResultCode: 1, ResultDesc: 'Database Error' });
    }

    if (!disb) {
      console.warn(`[Webhook] B2C RECORD NOT FOUND even with fallback. OrigConvID: ${OriginatorConversationID}, ConvID: ${ConversationID}`);
      // Log the mystery arrival to audit log for debugging
      await supabase.from('audit_log').insert([{
        user_name: 'System',
        action: 'Webhook Mismatch',
        detail: `B2C Callback arrived but no record matched. OrigID: ${OriginatorConversationID}. Body: ${JSON.stringify(Result).substring(0, 150)}`
      }]);
      return res.json({ ResultCode: 0, ResultDesc: 'Record not found but acknowledged' });
    }

    const loanId = disb.loan_id || disb.loanId; // Support both cases
    if (!loanId) {
      console.error('[Webhook] B2C Disbursement record found but is MISSING loan_id. Cannot update loan status.');
      return res.json({ ResultCode: 0, ResultDesc: 'Loan ID missing in record' });
    }

    if (status === 'Completed') {
      // Update loan status to 'Active'
      const { error: loanError } = await supabase
        .from('loans')
        .update({ 
          status: 'Active', 
          disbursed: new Date().toISOString().split('T')[0] 
        })
        .eq('id', loanId)
        .eq('status', 'Disbursing');
      
      if (loanError) console.error(`[Webhook] Failed to update loan ${loanId} to Active:`, loanError.message);
      else console.log(`[Webhook] Loan ${loanId} successfully promoted to Active.`);

    } else if (status === 'Failed') {
      // Revert the loan to Approved so it can be re-attempted
      const { error: loanError } = await supabase
        .from('loans')
        .update({ status: 'Approved', disbursed: null })
        .eq('id', loanId)
        .eq('status', 'Disbursing');
      
      if (loanError) console.error(`[Webhook] Failed to revert loan ${loanId} to Approved:`, loanError.message);
      else console.warn(`[Webhook] B2C Failed. Loan ${loanId} reverted to Approved.`);
    }

    if (disb) {
      await supabase.from('audit_log').insert([{
        user_name: 'System',
        action: status === 'Completed' ? 'Daraja Disbursed' : 'Daraja Disburse Failed',
        target_id: loanId,
        detail: `B2C Callback: ${status}. Receipt: ${TransactionID || 'N/A'}. Desc: ${ResultDesc}. OrigConvID: ${OriginatorConversationID}`
      }]);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (err) {
    console.error('[Webhook] B2C Error:', err.message);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal Error' });
  }
});

/**
 * POST /webhooks/mpesa/c2b-confirmation
 */
router.post('/c2b-confirmation', async (req, res) => {
  try {
    const data = req.body;
    
    // Send to allocation engine
    await MpesaService.allocatePaymentEngine(data);

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (err) {
    console.error('[Webhook] C2B Error:', err.message);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal Error' });
  }
});

router.post('/b2c-timeout', (req, res) => {
  console.warn('[Webhook] B2C Timeout:', req.body);
  res.json({ ResultCode: 0, ResultDesc: 'Logged' });
});

router.post('/c2b-validation', (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

export default router;
