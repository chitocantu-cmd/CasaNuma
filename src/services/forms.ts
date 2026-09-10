import { supabase } from '../lib/supabase/client';
import { llamar } from './api';
import type { MembershipLead, ContactLead, LeadStatus } from '../tipos';

export interface EnvioFormulario {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  interests?: string[];
  /** Campo trampa: invisible para personas, los robots lo llenan. */
  company?: string;
}

export function enviarFormulario(
  tipo: 'contacto' | 'membresia',
  datos: EnvioFormulario,
): Promise<{ ok: true; id: string }> {
  return llamar<{ ok: true; id: string }>('submit-form', { tipo, ...datos });
}

// --- Panel de administración ------------------------------------------------

export async function listarLeadsMembresia(): Promise<MembershipLead[]> {
  const { data, error } = await supabase
    .from('membership_leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MembershipLead[];
}

export async function listarLeadsContacto(): Promise<ContactLead[]> {
  const { data, error } = await supabase
    .from('contact_leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContactLead[];
}

export async function actualizarLead(
  tabla: 'membership_leads' | 'contact_leads',
  id: string,
  cambios: { status?: LeadStatus; admin_notes?: string },
): Promise<void> {
  const { error } = await supabase.from(tabla).update(cambios).eq('id', id);
  if (error) throw new Error(error.message);
}
