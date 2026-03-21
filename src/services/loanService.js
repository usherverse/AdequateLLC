import { supabase, DEMO_MODE } from '@/config/supabaseClient';
import { SEED_LOANS } from '@/data/seedData';
import { calcDaysOverdue } from '@/utils/helpers';

// ── READ ─────────────────────────────────────────────────────────────────────

export async function getLoans({ status = '', search = '', limit = 500, offset = 0 } = {}) {
  if (DEMO_MODE) {
    let rows = SEED_LOANS;
    if (status && status !== 'All') rows = rows.filter(l => l.status === status);
    if (search) {
      const lq = search.toLowerCase();
      rows = rows.filter(l =>
        l.id?.toLowerCase().includes(lq) ||
        l.customer?.toLowerCase().includes(lq) ||
        l.officer?.toLowerCase().includes(lq) ||
        l.mpesa?.toLowerCase().includes(lq) ||
        String(l.amount).includes(lq) ||
        String(l.balance).includes(lq)
      );
    }
    return { data: rows.slice(offset, offset + limit), count: rows.length, error: null };
  }

  let query = supabase.from('loans').select('*', { count: 'exact' });
  if (status && status !== 'All') query = query.eq('status', status);
  if (search) {
    query = query.or(
      `id.ilike.%${search}%,customer_name.ilike.%${search}%,officer.ilike.%${search}%,mpesa.ilike.%${search}%`
    );
  }
  const { data, count, error } = await query
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });
  return { data: data ?? [], count: count ?? 0, error };
}

export async function getLoanById(id) {
  if (DEMO_MODE) {
    const l = SEED_LOANS.find(x => x.id === id);
    return { data: l ?? null, error: l ? null : { message: 'Not found' } };
  }
  const { data, error } = await supabase.from('loans').select('*').eq('id', id).single();
  return { data, error };
}

// ── WRITE ────────────────────────────────────────────────────────────────────

export async function createLoan(payload) {
  if (DEMO_MODE) return { data: payload, error: null };
  const { data, error } = await supabase.from('loans').insert([payload]).select().single();
  return { data, error };
}

export async function updateLoan(id, payload) {
  if (DEMO_MODE) return { data: { id, ...payload }, error: null };
  const { data, error } = await supabase.from('loans').update(payload).eq('id', id).select().single();
  return { data, error };
}

export async function approveLoan(id) {
  return updateLoan(id, { status: 'Approved' });
}

export async function rejectLoan(id) {
  return updateLoan(id, { status: 'Rejected' });
}

export async function disburseLoan(id, { mpesa, phone, date }) {
  return updateLoan(id, { status: 'Active', disbursed: date, mpesa, phone, days_overdue: 0 });
}

export async function writeOffLoan(id) {
  return updateLoan(id, { status: 'Written off' });
}

/** Run the overdue-status sweep (called daily by app on mount) */
export async function sweepOverdueStatus() {
  if (DEMO_MODE) return; // handled in-memory by AdminPanel
  // Fetch all active loans
  const { data: active } = await supabase.from('loans').select('id,disbursed,repayment_type,balance,status').in('status', ['Active', 'Overdue']);
  if (!active?.length) return;

  const GRACE = { Daily: 3, Weekly: 10, Biweekly: 18, Monthly: 35, 'Lump Sum': 35 };

  for (const loan of active) {
    const diffDays = Math.floor((Date.now() - new Date(loan.disbursed)) / 86_400_000);
    const grace    = GRACE[loan.repayment_type] ?? 30;
    const od       = Math.max(0, diffDays - grace);

    if (od > 0 && loan.balance > 0 && loan.status === 'Active') {
      await supabase.from('loans').update({ status: 'Overdue', days_overdue: od }).eq('id', loan.id);
    } else if (loan.status === 'Overdue' && od !== loan.days_overdue) {
      await supabase.from('loans').update({ days_overdue: od }).eq('id', loan.id);
    }
  }
}
