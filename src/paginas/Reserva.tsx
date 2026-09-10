import { useParams } from 'react-router-dom';
import EstadoReservaVista from '../features/reservations/EstadoReservaVista';
import { useTitulo } from '../features/workshops/hooks';

/** Ruta /reserva/:code — consulta de una reservación por su código. */
export default function Reserva() {
  const { code = '' } = useParams<{ code: string }>();
  useTitulo(`Reservación ${code}`);
  return <EstadoReservaVista code={code} />;
}
