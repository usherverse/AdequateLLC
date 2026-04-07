import { supabase, DEMO_MODE } from '@/config/supabaseClient';
import { SEED_CUSTOMERS } from '@/data/seedData';

// ── READ ─────────────────────────────────────────────────────────────────────

export async function getCustomers({ search = '', limit = 50, offset = 0 } = {}) {
  if (DEMO_MODE) {
    let rows = SEED_CUSTOMERS;
    if (search) {
      const lq = search.toLowerCase();
      rows = rows.filter(c =>
        c.name?.toLowerCase().includes(lq) ||
        c.phone?.includes(lq) ||
        c.idNo?.includes(lq) ||
        c.business?.toLowerCase().includes(lq) ||
        c.location?.toLowerCase().includes(lq)
      );
    }
    return { data: rows.slice(offset, offset + limit), count: rows.length, error: null };
  }

  let query = supabase.from('customers').select('id, name, phone, email, id_no, business, location, status, created_at, residence, officer', { count: 'exact' });
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%,id_no.ilike.%${search}%,business.ilike.%${search}%,location.ilike.%${search}%`
    );
  }
  const { data, count, error } = await query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
  return { data: data ?? [], count: count ?? 0, error };
}

export async function getCustomerById(id) {
  if (DEMO_MODE) {
    const c = SEED_CUSTOMERS.find(x => x.id === id);
    return { data: c ?? null, error: c ? null : { message: 'Not found' } };
  }
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
  return { data, error };
}

// ── WRITE ────────────────────────────────────────────────────────────────────

export async function createCustomer(payload) {
  if (DEMO_MODE) {
    // In demo mode just return the payload with a generated id
    return { data: { ...payload }, error: null };
  }
  const { data, error } = await supabase.from('customers').insert([payload]).select().single();
  return { data, error };
}

export async function updateCustomer(id, payload) {
  if (DEMO_MODE) return { data: { id, ...payload }, error: null };
  const { data, error } = await supabase.from('customers').update(payload).eq('id', id).select().single();
  return { data, error };
}

export async function blacklistCustomer(id, reason = 'Admin action') {
  return updateCustomer(id, { blacklisted: true, bl_reason: reason });
}
