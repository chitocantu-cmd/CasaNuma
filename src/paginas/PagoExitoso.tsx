import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EstadoReservaVista from '../features/reservations/EstadoReservaVista';
import { useTitulo } from '../features/workshops/hooks';
import { useSesion } from '../features/cuenta/sesion';
import { BotonEnlace } from '../componentes/ui';
import Confirmacion from '../componentes/reservas/Confirmacion';
import { fuenteDatos } from '../config/site';
import { repo } from '../datos';
import { invalidarCupos } from '../datos/hooks';
import type { Reserva } from '../datos/tipos';
import { consultarReserva } from '../services/reservations';

const INTERVALO_MS = 2000;
const LIMITE_MS = 60000;

function leer(clave: string): string | null {
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

/**
 * Ruta /pago/exitoso
 *
 * Llegar aquí NO marca la reserva como pagada. Esta pantalla solo consulta el
 * estado real al backend, que a su vez únicamente confía en el webhook firmado
 * de Stripe. Alguien que escriba esta URL a mano no confirma nada.
 */
export default function PagoExitoso() {
  useTitulo('Confirmando tu pago');
  const [params] = useSearchParams();
  const { usuario, cargando } = useSesion();

  const code =
    params.get('code') ??
    params.get('reservation_code') ??
    leer('numa:ultima') ??
    '';
  // Lo guardó repo.apartar() en este navegador antes de ir a Stripe.
  const reservaId = code ? leer(`numa:reserva:${code}`) : null;

  if (!code) {
    return (
      <div className="contenedor flex min-h-[70vh] max-w-lg flex-col justify-center py-32 text-center">
        <p className="dato text-tinta/45">Hubo un problema</p>
        <h1 className="mt-4 font-display text-[2.2rem] leading-tight">
          No sabemos qué reservación mostrar
        </h1>
        <p className="mt-4 text-tinta/65">
          Si acabas de pagar, revisa tu correo: ahí va tu código de reservación.
        </p>
        <div className="mt-10 flex justify-center">
          <BotonEnlace to="/talleres">Ver talleres</BotonEnlace>
        </div>
      </div>
    );
  }

  // Misma confirmación que en el flujo de reserva, si la reserva es de la
  // cuenta con sesión. Si no (otro navegador, sesión cerrada), la consulta
  // por código + correo.
  if (fuenteDatos === 'supabase' && reservaId && (cargando || usuario)) {
    return <ConfirmacionEnCuenta code={code} reservaId={reservaId} />;
  }
  return <EstadoReservaVista code={code} />;
}

const CONFIRMACION: Record<Reserva['tipo'], Pick<Parameters<typeof Confirmacion>[0], 'titulo' | 'silueta' | 'volver'>> = {
  taller: { silueta: 'taza', volver: { to: '/talleres', texto: 'Volver a talleres' } },
  kids: { titulo: '¡Nos vemos el jueves!', silueta: 'tarro', volver: { to: '/numa-kids', texto: 'Volver a NUMA Kids' } },
  membresia: { titulo: '¡Tu membresía está lista!', silueta: 'guaje', volver: { to: '/talleres', texto: 'Volver a talleres' } },
};

function ConfirmacionEnCuenta({ code, reservaId }: { code: string; reservaId: string }) {
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [respaldo, setRespaldo] = useState(false);

  useEffect(() => {
    let vivo = true;
    let timer: number | undefined;
    const inicio = Date.now();
    const email = leer(`numa:${code}`);

    const ciclo = async () => {
      try {
        // reservation-status también confirma si el webhook de Stripe se atrasó.
        if (email) await consultarReserva(code, email).catch(() => null);
        const r = (await repo.misReservas()).find((x) => x.id === reservaId);
        if (!vivo) return;
        if (!r) return setRespaldo(true);
        if (r.estado === 'confirmada' || r.estado === 'completada') {
          invalidarCupos();
          return setReserva(r);
        }
        if (r.estado !== 'pendiente_pago') return setRespaldo(true);
      } catch {
        /* se vuelve a intentar */
      }
      if (!vivo) return;
      if (Date.now() - inicio > LIMITE_MS) return setRespaldo(true);
      timer = window.setTimeout(ciclo, INTERVALO_MS);
    };

    void ciclo();
    return () => {
      vivo = false;
      window.clearTimeout(timer);
    };
  }, [code, reservaId]);

  // Sin reserva en la cuenta, cancelada o tardando: la vista de siempre sabe
  // explicar cada caso.
  if (respaldo) return <EstadoReservaVista code={code} />;

  if (!reserva) {
    return (
      <div className="contenedor flex min-h-[70vh] max-w-lg flex-col justify-center py-32 text-center" aria-busy="true">
        <span className="mx-auto mb-8 block h-8 w-8 animate-spin rounded-full border-2 border-cafe/15 border-t-terracota" />
        <h1 className="font-display text-t2 font-light">Estamos confirmando tu pago</h1>
        <p className="mt-4 text-cuerpo text-cafe/70">Esto puede tardar unos segundos. No cierres esta ventana.</p>
      </div>
    );
  }

  return (
    <div className="contenedor pb-seccion pt-[calc(theme(spacing.header)+2rem)]">
      <div className="pt-6">
        <Confirmacion reserva={reserva} {...CONFIRMACION[reserva.tipo]} />
      </div>
    </div>
  );
}
