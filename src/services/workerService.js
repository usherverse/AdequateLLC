import { supabase, DEMO_MODE } from '@/config/supabaseClient';
import { SEED_WORKERS } from '@/data/seedData';

export async function getWorkers() {
  if (DEMO_MODE) return { data: SEED_WORKERS, error: null };
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .order('name');
  return { data: data ?? [], error };
}

export async function getWorkerById(id) {
  if (DEMO_MODE) {
    const w = SEED_WORKERS.find(x => x.id === id);
    return { data: w ?? null, error: w ? null : { message: 'Not found' } };
  }
  const { data, error } = await supabase.from('workers').select('*').eq('id', id).single();
  return { data, error };
}

export async function createWorker(payload) {
  if (DEMO_MODE) return { data: payload, error: null };
  const { data, error } = await supabase.from('workers').insert([payload]).select().single();
  return { data, error };
}

export async function updateWorker(id, payload) {
  if (DEMO_MODE) return { data: { id, ...payload }, error: null };
  const { data, error } = await supabase.from('workers').update(payload).eq('id', id).select().single();
  return { data, error };
}
