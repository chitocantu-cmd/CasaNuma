import { createClient } from '@supabase/supabase-js';

// Estas variables son PÚBLICAS por diseño: Vite las incrusta en el bundle y
// cualquiera puede leerlas. Eso es correcto y esperado — lo que protege los
// datos es el Row Level Security de la base, no el secreto de estas llaves.
//
// La que NUNCA puede aparecer aquí es SUPABASE_SERVICE_ROLE_KEY: ignora RLS
// por completo y vive solo en las Edge Functions.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Si faltan las variables, el sitio NO revienta con pantalla en blanco.
 *
 * Antes esto hacía `throw` al cargar el módulo, y el resultado en un despliegue
 * sin configurar era una página completamente vacía con un error escondido en
 * la consola: imposible de diagnosticar para quien no es programador.
 *
 * Ahora la app detecta el caso y muestra una pantalla que dice exactamente qué
 * falta y dónde ponerlo.
 */
export const configurado = Boolean(url && anonKey);

// Valores de relleno para que createClient no truene. Nunca se usan: cuando
// `configurado` es false, la app muestra la pantalla de configuración y no
// llega a hacer ninguna consulta.
export const supabase = createClient(
  url || 'https://sin-configurar.supabase.co',
  anonKey || 'sin-configurar',
  { auth: { persistSession: true, autoRefreshToken: true } },
);

export const FUNCIONES = `${url ?? ''}/functions/v1`;
export const ANON_KEY = anonKey ?? '';
