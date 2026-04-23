import { z } from 'zod';

const phoneRegex = /^(07|01|2547|2541)\d{8}$/;

export const stkPushSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid Safaricom phone number format'),
  amount: z.number().min(1).max(150000).optional(),
  customerId: z.string().min(1)
});

export const manualFeeSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().min(0).max(5000),
  notes: z.string().optional()
});

export const disburseSchema = z.object({
  // SECURITY (VULN-01): phone is intentionally NOT accepted here.
  // The recipient phone is always resolved from the verified customer
  // record server-side. Reject any caller that tries to inject one.
  otp: z.string().length(6).optional() // 2FA PIN
}).strip(); // .strip() silently drops any unrecognised fields (e.g. a rogue 'phone' key)

export const manualTransactionSchema = z.object({
  type: z.enum(['disbursement', 'registration_fee', 'paybill_receipt', 'manual_entry']),
  amount: z.number().min(0.01).max(150000),
  customerId: z.string().optional(),
  phone: z.string().regex(phoneRegex).optional(),
  notes: z.string().min(5),
  metadata: z.record(z.any()).optional()
});

// VULN-04 fix: schema for the /payments/manual-log endpoint
// This replaces the direct-to-Supabase insert from the frontend.
export const manualPaymentSchema = z.object({
  customerId:  z.string().min(1, 'Customer ID is required'),
  amount:      z.number().min(1, 'Amount must be positive').max(1000000),
  paymentType: z.enum(['loan_repayment', 'registration_fee', 'other']),
  method:      z.enum(['Cash', 'Bank Transfer', 'Cheque', 'Other']),
  reference:   z.string().optional(),
  loanId:      z.string().optional(),
}).strip();

// VULN-06 fix: schema for manual allocation of existing unallocated payments
export const manualAllocationSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID format'),
  loanId:    z.string().min(1, 'Loan ID is required'),
  note:      z.string().min(3, 'Allocation note is required'),
}).strip();


