import express from 'express';
import { supabase } from '../../config/db.js';
import { encrypt } from './mpesa.client.js';

const router = express.Router();

/**
 * Safaricom IP Range Validation Middleware
 */
const validateSafaricomIP = (req, res, next) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(/, /)[0] : req.socket.remoteAddress;

  // Safaricom Whitelist Ranges (Provided by user)
  const whitelist = [
    '196.201.214',
    '196.201.213',
    '196.201.212',
    '196.201.215',
    '196.201.136',
    '196.201.150'
  ];

  const ipMatch = whitelist.some(range => ip.startsWith(range));
  
  // In development/sandbox, we might want to skip this or allow more IPs
  if (process.env.MPESA_ENVIRONMENT === 'production' && !ipMatch) {
    console.warn(`[Webhook] Blocked unauthorized IP: ${ip}`);
    return res.status(403).json({ error: 'Unauthorized IP' });
  }

  next();
};

router.use(validateSafaricomIP);

/**
 * helper: upsertTransaction
 */
const upsertTransaction = async (data) => {
  const { mpesa_receipt_no } = data;
  
  // Check for duplicate receipt
  if (mpesa_receipt_no) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('mpesa_receipt_no', mpesa_receipt_no)
      .single();
    
    if (existing) {
      console.info(`[Webhook] Duplicate receipt ignored: ${mpesa_receipt_no}`);
      return { duplicate: true };
    }
  }

  const { error } = await supabase
    .from('transactions')
    .upsert([data]);

  if (error) throw error;
  return { success: true };
};

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
    const phone = meta.PhoneNumber;

    const status = ResultCode === 0 ? 'completed' : 'failed';

    const { data: tx } = await supabase
      .from('transactions')
      .update({
        mpesa_receipt_no,
        amount: amount || 0,
        phone: phone ? encrypt(phone.toString()) : null,
        status,
        notes: ResultDesc,
        metadata: { ...stkCallback, mpesa_raw: req.body }
      })
      .eq('mpesa_transaction_id', CheckoutRequestID)
      .select()
      .single();

    if (tx && status === 'completed') {
      // 1. Update registration_fees sub-table
      await supabase
        .from('registration_fees')
        .update({ status: 'paid', paid_at: new Date().toISOString(), transaction_id: tx.id })
        .eq('customer_id', tx.customer_id);

      // 2. Insert into legacy 'payments' table to satisfy Dashboard/Loans Tab
      await supabase
        .from('payments')
        .insert([{
          customer_id: tx.customer_id,
          amount: tx.amount,
          mpesa: tx.mpesa_receipt_no,
          date: new Date().toISOString().split('T')[0],
          status: 'Allocated',
          is_reg_fee: true,
          note: 'M-Pesa Registration Fee'
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
    const { ResultCode, ResultDesc, TransactionID, ResultParameters, OriginatorConversationID } = Result;

    console.log(`[Webhook] B2C Result: ${ResultDesc} (${ResultCode})`);

    const status = ResultCode === 0 ? 'completed' : 'failed';

    const { data: tx } = await supabase
      .from('transactions')
      .update({
        mpesa_receipt_no: TransactionID,
        status,
        notes: ResultDesc,
        metadata: { ...Result, mpesa_raw: req.body }
      })
      .eq('mpesa_transaction_id', TransactionID) // Note: B2C TransID is the unique key here
      .select()
      .single();

    // Update loan_disbursements record
    const { data: disb } = await supabase
      .from('loan_disbursements')
      .update({
        status: ResultCode === 0 ? 'confirmed' : 'failed',
        result_code: ResultCode,
        result_description: ResultDesc,
        disbursed_at: new Date().toISOString()
      })
      .eq('mpesa_originator_conversation_id', OriginatorConversationID)
      .select('loan_id')
      .single();

    if (disb && status === 'completed') {
      // Update legacy 'loans' table status to 'Active'
      await supabase
        .from('loans')
        .update({ 
          status: 'Active', 
          disbursed: new Date().toISOString().split('T')[0] 
        })
        .eq('id', disb.loan_id);
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
    const { TransID, TransAmount, MSISDN, FirstName, MiddleName, LastName } = data;

    await upsertTransaction({
      mpesa_receipt_no: TransID,
      amount: TransAmount,
      phone: encrypt(MSISDN),
      status: 'completed',
      type: 'paybill_receipt',
      notes: `C2B Paybill from ${FirstName} ${LastName}`,
      metadata: { ...data, mpesa_raw: req.body }
    });

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
