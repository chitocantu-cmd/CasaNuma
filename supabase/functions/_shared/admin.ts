// ---------------------------------------------------------------------------
// Verificación de administrador para Edge Functions
// ---------------------------------------------------------------------------
// El navegador manda el JWT de la sesión de Supabase Auth en Authorization.
// Aquí se valida ese token y se comprueba que el usuario esté en
// admin_profiles.
//
// Se comprueba en el SERVIDOR, no en React: ocultar un botón no es seguridad.
// Cualquiera puede llamar al endpoint directamente.
// ---------------------------------------------------------------------------

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { db, env } from './clients.ts';

// Llave pública. Igual que la secreta, acepta el nombre nuevo o el viejo:
//   · nueva -> Publishable key (sb_publishable_...)
//   · vieja -> anon key        (eyJhbGci...)
const LLAVE_PUBLICA =
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
  env('SUPABASE_ANON_KEY');

export interface Admin {
  userId: string;
  email: string;
}

/**
 * Devuelve el admin autenticado, o null si el token falta, es inválido, o el
 * usuario no está en admin_profiles.
 */
export async function adminDe(req: Request): Promise<Admin | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  const token = auth.slice(7);

  // Cliente con la anon key + el token del usuario: así getUser() valida la
  // firma del JWT contra el proyecto.
  const comoUsuario = createClient(
    env('SUPABASE_URL'),
    LLAVE_PUBLICA,
    { global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: { user }, error } = await comoUsuario.auth.getUser();
  if (error || !user) return null;

  // La pertenencia se consulta con service_role para no depender de las
  // políticas de RLS de admin_profiles.
  const { data: perfil } = await db
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!perfil) return null;

  return { userId: user.id, email: user.email ?? '' };
}
