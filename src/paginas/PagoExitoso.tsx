import { useSearchParams } from 'react-router-dom';
import EstadoReservaVista from '../features/reservations/EstadoReservaVista';
import { useTitulo } from '../features/workshops/hooks';
import { BotonEnlace } from '../componentes/ui';

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

  const code =
    params.get('code') ??
    params.get('reservation_code') ??
    sessionStorage.getItem('numa:ultima') ??
    '';

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

  return <EstadoReservaVista code={code} />;
}
