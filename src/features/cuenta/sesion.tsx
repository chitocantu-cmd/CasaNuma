import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { repo } from '../../datos';
import { invalidarCupos } from '../../datos/hooks';
import type { Registro, Usuario } from '../../datos/tipos';

// ---------------------------------------------------------------------------
// Sesión de la clienta
// ---------------------------------------------------------------------------
// Distinta de la sesión del panel (features/admin/auth.tsx): aquí la cuenta
// sirve para reservar y ver "Mi cuenta"; allá, para administrar el estudio.
// ---------------------------------------------------------------------------

interface ContextoSesion {
  usuario: Usuario | null;
  cargando: boolean;
  entrar: (email: string, password: string) => Promise<Usuario>;
  registrar: (datos: Registro) => Promise<Usuario>;
  salir: () => Promise<void>;
  actualizar: (cambios: Pick<Usuario, 'nombre' | 'telefono'>) => Promise<Usuario>;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    repo
      .usuarioActual()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  const entrar = useCallback(async (email: string, password: string) => {
    const u = await repo.entrar(email, password);
    invalidarCupos();
    setUsuario(u);
    return u;
  }, []);

  const registrar = useCallback(async (datos: Registro) => {
    const u = await repo.registrar(datos);
    setUsuario(u);
    return u;
  }, []);

  const salir = useCallback(async () => {
    await repo.salir();
    invalidarCupos();
    setUsuario(null);
  }, []);

  const actualizar = useCallback(async (cambios: Pick<Usuario, 'nombre' | 'telefono'>) => {
    const u = await repo.actualizarPerfil(cambios);
    setUsuario(u);
    return u;
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, entrar, registrar, salir, actualizar }),
    [usuario, cargando, entrar, registrar, salir, actualizar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSesion necesita <SesionProvider>');
  return c;
}
