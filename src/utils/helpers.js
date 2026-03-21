// ── Formatting ───────────────────────────────────────────────────────────────

/** Format a number as KES currency */
export const fmt = (n) => {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  return 'KES ' + num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

/** Compact format: 1.2M, 340K, etc. */
export const fmtM = (n) => {
  if (!n && n !== 0) return '—';
  if (n >= 1e6) return `KES ${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `KES ${(n / 1e3).toFixed(1)}K`;
  return fmt(n);
};

/** Today's date as YYYY-MM-DD */
export const today = () => new Date().toISOString().split('T')[0];

/** Format a timestamp for display */
export const fmtTs = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── ID generators ────────────────────────────────────────────────────────────

/** Generate a random ID with a prefix (client-side fallback only) */
export const uid = (prefix = 'ID') => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
};

// ── Loan finance ─────────────────────────────────────────────────────────────

const GRACE = { Daily: 3, Weekly: 10, Biweekly: 18, Monthly: 35, 'Lump Sum': 35 };

/** Days overdue, accounting for repayment-type grace period */
export const calcDaysOverdue = (loan) => {
  if (!loan.disbursed || !['Active', 'Overdue'].includes(loan.status)) return 0;
  const diffDays = Math.floor((Date.now() - new Date(loan.disbursed)) / 86_400_000);
  const grace    = GRACE[loan.repaymentType] ?? 30;
  return Math.max(0, diffDays - grace);
};

/** Penalty = 2% per day, capped at 30 days */
export const calcPenalty = (balance, daysOverdue) => {
  if (!balance || !daysOverdue) return 0;
  return Math.round(balance * 0.02 * Math.min(daysOverdue, 30));
};

/** Instalment amount given repayment type and total (principal + 30% interest) */
export const calcInstalment = (amount, type) => {
  const total = amount + Math.round(amount * 0.3);
  if (type === 'Daily')    return Math.ceil(total / 30);
  if (type === 'Weekly')   return Math.ceil(total / 4);
  if (type === 'Biweekly') return Math.ceil(total / 2);
  return total; // Monthly / Lump Sum
};

// ── Misc ─────────────────────────────────────────────────────────────────────

/** Clamp a number between min and max */
export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/** Deep-clone a plain object / array (JSON safe) */
export const clone = (obj) => JSON.parse(JSON.stringify(obj));

/** Truncate a string to maxLen with ellipsis */
export const trunc = (str, maxLen = 40) =>
  !str ? '' : str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
