import { Boton } from './Boton';

/**
 * Cuando una consulta falla (sin red, servidor caído): nunca un «cargando»
 * eterno ni un «no encontrado» engañoso. Dice qué pasó y deja reintentar.
 * `pagina` = ocupa la pantalla (detalle de taller, pieza…).
 */
export default function ErrorCarga({
  onReintentar,
  pagina = false,
  className = '',
}: {
  onReintentar: () => void;
  pagina?: boolean;
  className?: string;
}) {
  const cuerpo = (
    <div role="alert" className={`max-w-xl rounded-suave border border-cafe/15 p-7 sm:p-8 ${className}`}>
      <p className="font-display text-t3 font-light">No pudimos conectarnos.</p>
      <p className="mt-3 text-cuerpo text-cafe/75">Revisa tu conexión e inténtalo nuevamente.</p>
      <Boton variante="secundario" tamano="chico" className="mt-6" onClick={onReintentar}>
        Reintentar
      </Boton>
    </div>
  );
  if (!pagina) return cuerpo;
  return <div className="contenedor flex min-h-[70vh] items-center pt-header">{cuerpo}</div>;
}
