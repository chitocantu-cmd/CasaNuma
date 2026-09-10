import { useCallback, useEffect, useState } from 'react';
import { listarTalleres, obtenerTaller } from '../../services/workshops';
import type { Workshop } from '../../tipos';

interface Estado<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
}

export function useWorkshops() {
  const [estado, setEstado] = useState<Estado<Workshop[]>>({
    datos: null, cargando: true, error: null,
  });
  const [n, setN] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, cargando: true }));
    listarTalleres()
      .then((datos) => { if (vivo) setEstado({ datos, cargando: false, error: null }); })
      .catch((e: Error) => { if (vivo) setEstado({ datos: null, cargando: false, error: e.message }); });
    return () => { vivo = false; };
  }, [n]);

  const recargar = useCallback(() => setN((v) => v + 1), []);
  return { ...estado, recargar };
}

export function useWorkshop(slug: string | undefined) {
  const [estado, setEstado] = useState<Estado<Workshop>>({
    datos: null, cargando: true, error: null,
  });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    setEstado({ datos: null, cargando: true, error: null });
    obtenerTaller(slug)
      .then((datos) => { if (vivo) setEstado({ datos, cargando: false, error: null }); })
      .catch((e: Error) => { if (vivo) setEstado({ datos: null, cargando: false, error: e.message }); });
    return () => { vivo = false; };
  }, [slug, n]);

  const recargar = useCallback(() => setN((v) => v + 1), []);
  return { ...estado, recargar };
}

/** Actualiza el title y la meta description por página. */
export function useTitulo(titulo: string, descripcion?: string) {
  useEffect(() => {
    document.title = `${titulo} | Casa Numa`;
    if (descripcion) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', descripcion);
    }
  }, [titulo, descripcion]);
}
