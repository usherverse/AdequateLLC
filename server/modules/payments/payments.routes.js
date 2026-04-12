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

export default router;
