import { supabase } from '../../config/db.js';
import * as MpesaClient from './mpesa.client.js';

/**
 * Customer Eligibility Gate
 */
export const isEligibleToBorrow = async (customerId) => {
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*, registration_fees(*)')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) return { eligible: false, reason: 'Customer not found' };

  // 1. Registration complete (check if some mandatory fields are present)
  if (!customer.id_no || !customer.phone) {
    return { eligible: false, reason: 'Registration incomplete: missing ID or Phone' };
  }

  // 2. Registration fee paid
  const regFee = customer.registration_fees?.find(f => f.status === 'paid');
  if (!regFee) {
    return { eligible: false, reason: 'Registration fee not paid (KES 500 required)' };
  }

  // 3. KYC status (if risk field or similar exists)
  if (customer.blacklisted) {
    return { eligible: false, reason: `Customer blacklisted: ${customer.bl_reason}` };
  }

  // 4. No active defaulted loans
  const { data: activeLoans } = await supabase
    .from('loans')
    .select('id, status')
    .eq('customer_id', customerId)
    .eq('status', 'Overdue');
  
  if (activeLoans && activeLoans.length > 0) {
    return { eligible: false, reason: 'Customer has active defaulted loans' };
  }

  return { eligible: true };
};

/**
 * Trigger STK Push for Registration Fee
 */
export const triggerRegistrationStkPush = async (customerId, phone) => {
  const result = await MpesaClient.stkPush(phone, 500, customerId, 'Registration Fee');
  
  if (result.ResponseCode === '0') {
    // Record the transaction as pending
    await supabase.from('transactions').insert([{
      customer_id: customerId,
      amount: 500,
      phone: MpesaClient.encrypt(phone),
      status: 'pending',
      type: 'registration_fee',
      mpesa_transaction_id: result.CheckoutRequestID,
      notes: 'Registration STK Push initiated'
    }]);

    await supabase.from('registration_fees').upsert([{
      customer_id: customerId,
      amount: 500,
      status: 'pending',
      payment_method: 'mpesa_stk'
    }]);
  }

  return result;
};

/**
 * Trigger Loan Disbursement (B2C)
 */
export const disburseLoan = async (loanId, adminId) => {
  const { data: loan, error } = await supabase
    .from('loans')
    .select('*, customers(phone)')
    .eq('id', loanId)
    .single();

  if (error || !loan) throw new Error('Loan not found');
  if (loan.status !== 'Approved') throw new Error(`Loan status is ${loan.status}, not Approved`);

  const amount = loan.amount;
  const phone = loan.phone || (loan.customers && loan.customers.phone);
  
  if (!phone) throw new Error('Customer phone missing');
  if (amount > 150000) throw new Error('Amount exceeds B2C daily limit of KES 150,000');

  // Initiate B2C
  const result = await MpesaClient.b2cDisbursement(phone, amount, `Loan ${loanId}`, `Disbursement for ${loanId}`);

  if (result.ResponseCode === '0') {
    // Record Transaction
    const { data: tx } = await supabase.from('transactions').insert([{
      type: 'disbursement',
      amount,
      customer_id: loan.customer_id,
      phone: MpesaClient.encrypt(phone),
      status: 'processing',
      initiated_by: adminId,
      notes: `Disbursement initiated for loan ${loanId}`
    }]).select().single();

    // Link to loan_disbursements
    await supabase.from('loan_disbursements').insert([{
      loan_id: loanId,
      transaction_id: tx.id,
      disbursed_to_phone: MpesaClient.encrypt(phone),
      mpesa_originator_conversation_id: result.OriginatorConversationID,
      mpesa_conversation_id: result.ConversationID,
      status: 'sent'
    }]);
    
    // Update loan status to 'Disbursing'? Or just wait for webhook
    await supabase.from('loans').update({ status: 'Disbursing' }).eq('id', loanId);
  }

  return result;
};
