import { supabase } from '../lib/supabase/client';
import type { Workshop, WorkshopAdmin, WorkshopAvailability } from '../tipos';

/** Catálogo público. La vista ya descuenta los holds activos. */
export async function listarTalleres(): Promise<Workshop[]> {
  const { data, error } = await supabase
    .from('public_workshops')
    .select('*')
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Workshop[];
}

export async function obtenerTaller(slug: string): Promise<Workshop | null> {
  const { data, error } = await supabase
    .from('public_workshops')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Workshop) ?? null;
}

// --- Panel de administración ------------------------------------------------

export async function listarTalleresAdmin(): Promise<WorkshopAdmin[]> {
  const { data, error } = await supabase
    .from('workshops')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkshopAdmin[];
}

export async function obtenerTallerAdmin(id: string): Promise<WorkshopAdmin | null> {
  const { data, error } = await supabase
    .from('workshops').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WorkshopAdmin) ?? null;
}

export async function disponibilidad(id: string): Promise<WorkshopAvailability> {
  const { data, error } = await supabase.rpc('disponibilidad', { p_workshop_id: id });
  if (error) throw new Error(error.message);
  return data as WorkshopAvailability;
}

export async function guardarTaller(
  taller: Partial<WorkshopAdmin> & { slug: string },
): Promise<WorkshopAdmin> {
  const { id, created_at, updated_at, ...campos } = taller as Record<string, unknown> & { id?: string };
  void created_at; void updated_at;

  const query = id
    ? supabase.from('workshops').update(campos).eq('id', id)
    : supabase.from('workshops').insert(campos);

  const { data, error } = await query.select().single();
  if (error) throw new Error(error.message);
  return data as WorkshopAdmin;
}
