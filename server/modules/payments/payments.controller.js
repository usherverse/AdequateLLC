import * as PaymentsService from './payments.service.js';
import { supabase } from '../../config/db.js';

/**
 * POST /registration-fee/stk-push
 */
export const triggerRegFeeStk = async (req, res) => {
  const { customerId, phone } = req.body;
  try {
    const result = await PaymentsService.triggerRegistrationStkPush(customerId, phone);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /registration-fee/:customerId/status
 */
export const getRegFeeStatus = async (req, res) => {
  const { customerId } = req.params;
  try {
    const { data, error } = await supabase
      .from('registration_fees')
      .select('*')
      .eq('customer_id', customerId)
      .single();
    
    if (error) return res.status(404).json({ error: 'Fee record not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /disbursements/:loanId/disburse
 */
export const disburseLoan = async (req, res) => {
  const { loanId } = req.params;
  // SECURITY: Do NOT accept a phone from the request body.
  // The recipient phone is resolved exclusively from the customer
  // record inside the service layer (VULN-01 fix).
  const adminId = req.user.id;
  
  try {
    const result = await PaymentsService.disburseLoan(loanId, adminId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /payouts/worker/:workerId
 */
export const payoutWorkerSalary = async (req, res) => {
  const { workerId } = req.params;
  // SECURITY (VULN-02): amount and phone are intentionally NOT read from
  // req.body. The service computes them from verified DB records only.
  const adminId = req.user.id;

  try {
    const result = await PaymentsService.disburseSalary(workerId, adminId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /transactions
 */
export const getTransactions = async (req, res) => {
  const { page = 1, limit = 20, type, status, customerId } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase.from('transactions').select('*', { count: 'exact' });
  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);
  if (customerId) query = query.eq('customer_id', customerId);

  const { data, count, error } = await query
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, count, page, limit });
};

/**
 * POST /transactions/manual
 */
export const createManualTransaction = async (req, res) => {
  const payload = req.body;
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        ...payload,
        initiated_by: req.user.id,
        status: 'completed'
      }])
      .select()
      .single();
    
    if (error) throw error;

    await supabase.from('audit_log').insert([{
      user_id: req.user.id,
      user_name: req.user.email || 'Admin',
      action: 'Manual Transaction Created',
      target_id: data.id,
      detail: `Type: ${payload.type}, Amount: ${payload.amount}, Cust: ${payload.customerId || 'N/A'}`
    }]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /payments/manual-log  (VULN-04 fix)
 *
 * Replaces the direct Supabase insert that previously lived in the React
 * frontend (PaymentsHub/index.jsx handleManualLog).  By routing through
 * this handler we gain:
 *   • Server-side identity — allocated_by comes from req.user, not the client
 *   • Canonical customer name — fetched from DB, cannot be spoofed
 *   • Atomic loan balance update — uses the same RPC as C2B payments
 *   • Enforced amount limits — Zod schema caps at 1,000,000 KES
 *   • Guaranteed audit trail — written by the server with real user identity
 */
export const createManualPayment = async (req, res) => {
  const { customerId, amount, paymentType, method, reference, loanId } = req.body;
  const adminEmail = req.user.email || req.user.id;

  try {
    // 1. Fetch canonical customer from DB — client cannot spoof the name
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('id', customerId)
      .single();

    if (custErr || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const isRegFee   = paymentType === 'registration_fee';
    const effectiveLoanId = isRegFee ? `REG-FEE-${customerId}` : (loanId || null);
    const note       = isRegFee
      ? `Registration Fee — ${method} (Manual Entry by ${adminEmail})`
      : `Manual Entry (${method}) by ${adminEmail}`;

    // 2. Insert payment record — allocated_by is always the server-verified user
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert([{
        customer_id:   customer.id,
        customer_name: customer.name,           // from DB, not client
        loan_id:       effectiveLoanId,
        amount,
        mpesa:         reference || null,
        date:          new Date().toISOString().split('T')[0],
        status:        'Allocated',
        allocated_by:  adminEmail,              // server identity, not client input
        allocated_at:  new Date().toISOString(),
        note,
        is_reg_fee:    isRegFee,
      }])
      .select()
      .single();

    if (payErr) throw payErr;

    // 3. If targeting a loan, decrement its balance atomically
    if (effectiveLoanId && !isRegFee) {
      await supabase.rpc('apply_c2b_payment', {
        p_customer_id:   customer.id,
        p_customer_name: customer.name,
        p_loan_id:       effectiveLoanId,
        p_amount:        amount,
        p_mpesa_txid:    reference || `MANUAL-${payment.id}`,
        p_date:          new Date().toISOString().split('T')[0],
        p_note:          note,
      });
    }

    // 4. Flip mpesa_registered flag for registration fees
    if (isRegFee) {
      await supabase
        .from('customers')
        .update({ mpesa_registered: true })
        .eq('id', customerId);
    }

    // 5. Audit log — always written server-side with real identity
    await supabase.from('audit_log').insert([{
      user_name: adminEmail,
      action:    isRegFee ? 'Registration Fee — Manual' : 'Manual Payment Log',
      target_id: customerId,
      detail:    `KES ${amount} via ${method}. Ref: ${reference || 'N/A'}. Type: ${paymentType}.`,
    }]);

    res.json(payment);
  } catch (err) {
    console.error('[ManualPayment] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /payments/allocate  (VULN-06 fix)
 * Reroutes manual payment allocation to a secure server-side RPC.
 */
export const allocatePayment = async (req, res) => {
  const { paymentId, loanId, note } = req.body;
  const adminEmail = req.user.email || req.user.id;

  try {
    const { data, error } = await supabase.rpc('allocate_manual_payment', {
      p_payment_id:   paymentId,
      p_loan_id:      loanId,
      p_allocated_by: adminEmail, // server-side identity
      p_note:         note
    });

    if (error) throw error;

    // Record audit log
    await supabase.from('audit_log').insert([{
      user_name: adminEmail,
      action:    'Manual Allocation',
      target_id: loanId,
      detail:    `Payment ${paymentId} allocated to loan ${loanId}. Note: ${note}`
    }]);

    res.json(data);
  } catch (err) {
    console.error('[AllocatePayment] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};


