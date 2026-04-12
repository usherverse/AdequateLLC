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
  const { phone } = req.body;
  const adminId = req.user.id;
  
  try {
    const result = await PaymentsService.disburseLoan(loanId, adminId, phone);
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
