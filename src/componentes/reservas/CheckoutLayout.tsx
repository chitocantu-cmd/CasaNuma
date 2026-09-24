import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { repo, ErrorDatos } from '../../datos';
import type { Reserva, SolicitudReserva } from '../../datos/tipos';
import { sinLugar } from '../../lib/cupo';
import { Icono } from '../base/Iconos';
import { MarcaDemo } from '../base/Pendiente';
import CheckoutSteps from './CheckoutSteps';

/**
 * Marco de toda reserva: regreso, título, pasos, contenido y resumen.
 * En móvil deja espacio abajo para la barra fija del resumen.
 */
export default function CheckoutLayout({
  volver, eyebrow, titulo, demo = false, pasos, paso, resumen, children,
}: {
  volver: { to: string; texto: string };
  eyebrow: string;
  titulo: string;
  demo?: boolean;
  pasos: string[];
  /** Índice del paso; igual o mayor que pasos.length = confirmación. */
  paso: number;
  resumen?: ReactNode;
  children: ReactNode;
}) {
  const confirmado = paso >= pasos.length;
  const ancla = useRef<HTMLDivElement>(null);

  // Al cambiar de paso, volver al inicio del contenido (sobre todo en móvil).
  useEffect(() => {
    const el = ancla.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 110;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' });
  }, [paso]);

  return (
    <div className={`contenedor pt-[calc(theme(spacing.header)+2rem)] ${confirmado ? 'pb-seccion' : 'pb-40 lg:pb-seccion'}`}>
      {!confirmado && (
        <>
          <Link to={volver.to} className="group inline-flex items-center gap-2 text-nota text-cafe/70 hover:text-cafe">
            <Icono.flechaIzq tam={16} className="transition-transform group-hover:-translate-x-1" />
            {volver.texto}
          </Link>
          <div className="mt-6 flex flex-col gap-8 border-b border-cafe/12 pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow flex items-center gap-3 text-cafe/65">
                {eyebrow}
                {demo && <MarcaDemo />}
              </p>
              <h1 className="mt-3 font-display text-t2 font-light">{titulo}</h1>
            </div>
            <CheckoutSteps pasos={pasos} actual={paso} />
          </div>
        </>
      )}

      <div ref={ancla} className={confirmado ? 'pt-6' : 'mt-10 grid gap-12 lg:grid-cols-12 lg:gap-8'}>
        {confirmado ? (
          children
        ) : (
          <>
            <div className="min-w-0 lg:col-span-7">{children}</div>
            <div className="lg:col-span-4 lg:col-start-9">{resumen}</div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Vuelve a preguntar el cupo al backend antes de seguir: lo que se cargó al
 * abrir la página puede haber cambiado. Devuelve el mensaje para la persona,
 * o null si hay lugar. (El backend lo comprueba de nuevo al apartar.)
 */
export async function comprobarCupo(sesionIds: string[], personas: number): Promise<string | null> {
  const actuales = await repo.disponibilidad(sesionIds);
  const falta = actuales.find((s) => sinLugar(s) || (s.disponibles !== null && s.disponibles < personas));
  if (!falta) return null;
  if (sinLugar(falta) || !falta.disponibles) return 'Este horario ya está agotado. Elige otro.';
  return `Solo ${falta.disponibles === 1 ? 'queda 1 lugar disponible' : `quedan ${falta.disponibles} lugares disponibles`}.`;
}

/**
 * Apartado de lugares: crea el hold y, si la persona se va sin pagar,
 * lo libera para no bloquear el cupo 15 minutos a nadie.
 */
export function useApartado() {
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apartando, setApartando] = useState(false);
  const pendiente = useRef<Reserva | null>(null);
  pendiente.current = reserva?.estado === 'pendiente_pago' ? reserva : null;

  useEffect(() => () => {
    if (pendiente.current) void repo.liberar(pendiente.current.id);
  }, []);

  const apartar = useCallback(async (s: SolicitudReserva): Promise<Reserva | null> => {
    setApartando(true);
    setError(null);
    try {
      const r = await repo.apartar(s);
      setReserva(r);
      return r;
    } catch (e) {
      setError(e instanceof ErrorDatos ? e.message : 'No pudimos apartar tus lugares. Intenta de nuevo.');
      return null;
    } finally {
      setApartando(false);
    }
  }, []);

  return { reserva, setReserva, error, setError, apartando, apartar };
}
