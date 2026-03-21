import { supabase, DEMO_MODE } from '@/config/supabaseClient';
import { SEED_PAYMENTS } from '@/data/seedData';

// ── READ ─────────────────────────────────────────────────────────────────────

export async function getPayments({ loanId = '', customerId = '', status = '', limit = 500, offset = 0 } = {}) {
  if (DEMO_MODE) {
    let rows = SEED_PAYMENTS;
    if (loanId)     rows = rows.filter(p => p.loanId === loanId);
    if (customerId) rows = rows.filter(p => p.customerId === customerId);
    if (status)     rows = rows.filter(p => p.status === status);
    return { data: rows.slice(offset, offset + limit), count: rows.length, error: null };
  }

  let query = supabase.from('payments').select('*', { count: 'exact' });
  if (loanId)     query = query.eq('loan_id', loanId);
  if (customerId) query = query.eq('customer_id', customerId);
  if (status)     query = query.eq('status', status);
  const { data, count, error } = await query
    .range(offset, offset + limit - 1)
    .order('date', { ascending: false });
  return { data: data ?? [], count: count ?? 0, error };
}

// ── WRITE ────────────────────────────────────────────────────────────────────

export async function recordPayment(payload) {
  if (DEMO_MODE) return { data: payload, error: null };
  const { data, error } = await supabase.from('payments').insert([payload]).select().single();
  return { data, error };
}

export async function allocatePayment(paymentId, { loanId, allocatedBy, note }) {
  if (DEMO_MODE) return { data: { id: paymentId, status: 'Allocated', loanId }, error: null };
  const { data, error } = await supabase
    .from('payments')
    .update({
      loan_id: loanId,
      status: 'Allocated',
      allocated_by: allocatedBy,
      allocated_at: new Date().toISOString(),
      note,
    })
    .eq('id', paymentId)
    .select()
    .single();
  return { data, error };
}
