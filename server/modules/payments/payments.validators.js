import { z } from 'zod';

const phoneRegex = /^(07|01|2547|2541)\d{8}$/;

export const stkPushSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid Safaricom phone number format'),
  amount: z.number().min(1).max(150000),
  customerId: z.string().min(1)
});

export const manualFeeSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().min(0).max(5000),
  notes: z.string().optional()
});

export const disburseSchema = z.object({
  loanId: z.string().min(1),
  otp: z.string().length(6).optional() // 2FA PIN
});

export const manualTransactionSchema = z.object({
  type: z.enum(['disbursement', 'registration_fee', 'paybill_receipt', 'manual_entry']),
  amount: z.number().min(0.01).max(150000),
  customerId: z.string().optional(),
  phone: z.string().regex(phoneRegex).optional(),
  notes: z.string().min(5),
  metadata: z.record(z.any()).optional()
});
