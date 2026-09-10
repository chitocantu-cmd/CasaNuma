import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';

// ---------------------------------------------------------------------------
// Sesión de administración
// ---------------------------------------------------------------------------
// Los CLIENTES nunca crean cuenta: reservan sin registrarse. Supabase Auth se
// usa exclusivamente para el equipo de Casa Numa.
//
// Tener sesión NO basta: hay que estar en admin_profiles. Esa comprobación se
// hace aquí para la interfaz, y otra vez en el servidor para cada acción
// sensible — ocultar un botón no es seguridad.
// ---------------------------------------------------------------------------

interface Ctx {
  session: Session | null;
  esAdmin: boolean;
  cargando: boolean;
  entrar: (email: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [cargando, setCargando] = useState(true);

  const verificarAdmin = useCallback(async (s: Session | null) => {
    if (!s) { setEsAdmin(false); return; }
    const { data } = await supabase
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', s.user.id)
      .maybeSingle();
    setEsAdmin(Boolean(data));
  }, []);

  useEffect(() => {
    let vivo = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      setSession(data.session);
      await verificarAdmin(data.session);
      if (vivo) setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!vivo) return;
      setSession(s);
      await verificarAdmin(s);
    });

    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, [verificarAdmin]);

  const entrar = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Mensaje genérico a propósito: distinguir "correo no existe" de
      // "contraseña incorrecta" le dice a un atacante qué correos son válidos.
      throw new Error('Correo o contraseña incorrectos.');
    }
  }, []);

  const salir = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const valor = useMemo(
    () => ({ session, esAdmin, cargando, entrar, salir }),
    [session, esAdmin, cargando, entrar, salir],
  );

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/** Envuelve las rutas de /admin. Sin sesión de admin, manda al login. */
export function RequiereAdmin({ children }: { children: ReactNode }) {
  const { session, esAdmin, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div className="contenedor py-32 text-center">
        <p className="dato text-tinta/45">Verificando sesión…</p>
      </div>
    );
  }

  if (!session || !esAdmin) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
