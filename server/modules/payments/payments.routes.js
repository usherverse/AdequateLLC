import express from 'express';
import * as Controller from './payments.controller.js';
import * as Middleware from './payments.middleware.js';
import * as Validators from './payments.validators.js';

const router = express.Router();

/**
 * Registration Fees
 */
router.post(
  '/registration-fee/stk-push',
  Middleware.authenticate,
  Middleware.authorize(['SUPER_ADMIN', 'FINANCE_ADMIN', 'LOAN_OFFICER']),
  Middleware.validate(Validators.stkPushSchema),
  Controller.triggerRegFeeStk
);

router.get(
  '/registration-fee/:customerId/status',
  Middleware.authenticate,
  Controller.getRegFeeStatus
);

/**
 * Loan Disbursements
 */
router.post(
  '/disbursements/:loanId/disburse',
  Middleware.authenticate,
  Middleware.authorize(['SUPER_ADMIN', 'FINANCE_ADMIN']),
  Middleware.checkIdempotency,
  Middleware.validate(Validators.disburseSchema),
  Controller.disburseLoan
);

/**
 * Worker Payouts
 */
router.post(
  '/payouts/worker/:workerId',
  Middleware.authenticate,
  Middleware.authorize(['SUPER_ADMIN', 'FINANCE_ADMIN']),
  Controller.payoutWorkerSalary
);

/**
 * Transactions (Unified Ledger)
 */
router.get(
  '/transactions',
  Middleware.authenticate,
  Middleware.authorize(['SUPER_ADMIN', 'FINANCE_ADMIN', 'READ_ONLY']),
  Controller.getTransactions
);

router.post(
  '/transactions/manual',
  Middleware.authenticate,
  Middleware.authorize(['SUPER_ADMIN', 'FINANCE_ADMIN']),
  Middleware.validate(Validators.manualTransactionSchema),
  Controller.createManualTransaction
);

/**
 * Manual Payment Log — VULN-04 fix
 * Replaces the direct Supabase insert from the React frontend.
 * All manual payments must now pass through this authenticated,
 * validated, server-side handler.
 */
router.post(
  '/payments/manual-log',
  Middleware.authenticate,
  Middleware.authorize(['SUPER_ADMIN', 'FINANCE_ADMIN']),
  Middleware.validate(Validators.manualPaymentSchema),
  Controller.createManualPayment
);

/**
 * Manual Payment Allocation — VULN-06 fix
 * Reroutes the logic from the React frontend to a secure
 * server-side RPC that prevents identity spoofing.
 */
router.post(
  '/payments/allocate',
  Middleware.authenticate,
  Middleware.authorize(['SUPER_ADMIN', 'FINANCE_ADMIN']),
  Middleware.validate(Validators.manualAllocationSchema),
  Controller.allocatePayment
);

export default router;
