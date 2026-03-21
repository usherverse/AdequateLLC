import { supabase, DEMO_MODE } from '@/config/supabaseClient';
import { SEED_LEADS } from '@/data/seedData';

export async function getLeads({ search = '' } = {}) {
  if (DEMO_MODE) {
    let rows = SEED_LEADS;
    if (search) {
      const lq = search.toLowerCase();
      rows = rows.filter(l =>
        l.name?.toLowerCase().includes(lq) ||
        l.phone?.includes(lq) ||
        l.location?.toLowerCase().includes(lq)
      );
    }
    return { data: rows, error: null };
  }
  let query = supabase.from('leads').select('*');
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  const { data, error } = await query.order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function createLead(payload) {
  if (DEMO_MODE) return { data: payload, error: null };
  const { data, error } = await supabase.from('leads').insert([payload]).select().single();
  return { data, error };
}

export async function updateLead(id, payload) {
  if (DEMO_MODE) return { data: { id, ...payload }, error: null };
  const { data, error } = await supabase.from('leads').update(payload).eq('id', id).select().single();
  return { data, error };
}
