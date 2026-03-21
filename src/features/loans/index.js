// features/loans/index.js
// Barrel export for loan feature — services, hooks, and helpers.
export * from '@/services/loanService';
export { calcInstalment, calcPenalty, calcDaysOverdue } from '@/utils/helpers';
