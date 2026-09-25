import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ErrorDatos } from '../../datos';
import { useMisReservas } from '../../datos/hooks';
import type { Reserva, SesionReservada } from '../../datos/tipos';
import { useSesion } from '../../features/cuenta/sesion';
import { etiquetaMes, fechaCompacta, fechaCompleta, hora, rango, yaPaso } from '../../lib/calendario';
import { pesosCortos } from '../../lib/formato';
import { useSeo } from '../../lib/seo';
import { Boton, BotonEnlace } from '../../componentes/base/Boton';
import { Aviso, Campo } from '../../componentes/base/Campos';
import { Icono } from '../../componentes/base/Iconos';
import { MarcaDemo } from '../../componentes/base/Pendiente';
import EnlaceAncla from '../../componentes/base/EnlaceAncla';
import CeramicShape from '../../componentes/marca/CeramicShape';

const TIPO: Record<Reserva['tipo'], string> = { taller: 'Taller', membresia: 'Membresía', kids: 'NUMA Kids' };
const ESTADO: Record<Reserva['estado'], string> = {
  confirmada: 'Confirmada', pendiente_pago: 'Pendiente de pago', cancelada: 'Cancelada', completada: 'Completada', no_asistio: 'No asististe', expirada: 'Expirada',
};
const PAGO: Record<Reserva['pago'], string> = { pagado: 'Pagado', pendiente: 'Pendiente', reembolsado: 'Reembolsado', fallido: 'Rechazado' };

interface Fila {
  reserva: Reserva;
  sesion: SesionReservada;
  numero?: string;
}

export default function Cuenta() {
  useSeo({ titulo: 'Mi cuenta | Casa Numa', descripcion: 'Tus reservas, tu membresía y tu perfil en Casa Numa.', indexar: false });
  const { usuario, cargando, salir } = useSesion();
  const { datos: reservas } = useMisReservas(usuario?.id ?? null);
  const navigate = useNavigate();

  if (cargando) return <div className="min-h-[80vh]" aria-busy="true" />;
  if (!usuario) return <Navigate to="/cuenta/entrar" replace state={{ desde: '/cuenta' }} />;

  const activas = (reservas ?? []).filter((r) => ['confirmada', 'pendiente_pago', 'completada'].includes(r.estado));
  const filas: Fila[] = activas.flatMap((r) =>
    r.sesiones.map((s, i) => ({ reserva: r, sesion: s, numero: r.sesiones.length > 1 ? `${i + 1}/${r.sesiones.length}` : undefined })),
  );
  const proximas = filas.filter((f) => !yaPaso(f.sesion.fecha, f.sesion.inicio)).sort(orden);
  const pasadas = filas.filter((f) => yaPaso(f.sesion.fecha, f.sesion.inicio)).sort(orden).reverse();
  const membresias = activas
    .filter((r) => r.tipo === 'membresia' && r.sesiones.some((s) => !yaPaso(s.fecha, s.inicio)))
    .sort((a, b) => a.sesiones[0].fecha.localeCompare(b.sesiones[0].fecha));

  return (
    <div className="contenedor pb-seccion pt-[calc(theme(spacing.header)+3rem)]">
      <header className="flex flex-col gap-6 border-b border-cafe/12 pb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-cafe/65">Mi cuenta</p>
          <h1 className="mt-4 font-display text-t1 font-light">Hola, {usuario.nombre.split(' ')[0]}.</h1>
        </div>
        <button
          type="button"
          onClick={async () => { await salir(); navigate('/'); }}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-cafe/20 px-5 text-nota text-cafe/80 hover:border-cafe sm:self-auto"
        >
          <Icono.salir tam={17} /> Cerrar sesión
        </button>
      </header>

      <nav aria-label="Secciones de mi cuenta" className="carril -mx-canal mt-6 flex gap-2 overflow-x-auto px-canal">
        {[['proximas', 'Próximas'], ['membresia', 'Mi membresía'], ['historial', 'Historial'], ['perfil', 'Perfil']].map(([h, t]) => (
          <EnlaceAncla key={h} destino={h} className="min-h-10 shrink-0 rounded-full bg-cafe/[0.05] px-4 py-2.5 text-[0.78rem] text-cafe/80 hover:bg-cafe/10">{t}</EnlaceAncla>
        ))}
      </nav>

      <div className="mt-14 grid gap-16 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-20 lg:col-span-7">
          {/* Próximas experiencias */}
          <section id="proximas" aria-labelledby="c-proximas" className="scroll-mt-28">
            <p className="eyebrow text-cafe/55">Mis reservas</p>
            <h2 id="c-proximas" className="mt-2 font-display text-t3 font-light">Próximas</h2>
            {reservas === null ? (
              <div className="mt-6 h-32" aria-busy="true" />
            ) : proximas.length === 0 ? (
              <div className="mt-6 rounded-suave border border-dashed border-cafe/20 p-8">
                <p className="text-cuerpo text-cafe/80">Todavía no tienes experiencias próximas.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <BotonEnlace to="/talleres" tamano="chico" flecha>Ver talleres</BotonEnlace>
                  <BotonEnlace to="/membresia" tamano="chico" variante="secundario">Membresía</BotonEnlace>
                </div>
              </div>
            ) : (
              <ul className="mt-6 space-y-3">
                {proximas.map((f) => <FilaReserva key={`${f.reserva.id}-${f.sesion.id}`} fila={f} />)}
              </ul>
            )}
          </section>

          {/* Historial */}
          <section id="historial" aria-labelledby="c-historial" className="scroll-mt-28">
            <h2 id="c-historial" className="font-display text-t3 font-light">Historial</h2>
            {pasadas.length === 0 ? (
              <p className="mt-6 text-cuerpo text-cafe/70">Aquí aparecerán tus experiencias pasadas.</p>
            ) : (
              <ul className="mt-6 divide-y divide-cafe/12 border-y border-cafe/12">
                {pasadas.map((f) => (
                  <li key={`${f.reserva.id}-${f.sesion.id}`} className="flex flex-wrap items-baseline justify-between gap-3 py-4 text-nota">
                    <span>
                      <span className="text-cafe">{f.reserva.titulo}</span>
                      {f.numero && <span className="text-cafe/55"> · clase {f.numero}</span>}
                    </span>
                    <span className="text-cafe/65 first-letter:uppercase">{fechaCompleta(f.sesion.fecha)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-16 lg:col-span-4 lg:col-start-9">
          {/* Mi membresía */}
          <section id="membresia" aria-labelledby="c-membresia" className="scroll-mt-28">
            <h2 id="c-membresia" className="sr-only">Mi membresía</h2>
            {membresias.length === 0 ? (
              <div className="rounded-suave bg-terracota/[0.14] p-7">
                <CeramicShape nombre="guaje" className="h-12 w-auto" />
                <p className="mt-5 font-display text-t4 font-light">Haz de la cerámica parte de tu rutina.</p>
                <p className="mt-2 text-nota text-cafe/75">Cuatro clases al mes, a tu ritmo.</p>
                <BotonEnlace to="/membresia" tamano="chico" className="mt-6" flecha>Conocer la membresía</BotonEnlace>
              </div>
            ) : (
              membresias.map((r) => <TarjetaMembresia key={r.id} reserva={r} />)
            )}
          </section>

          {/* Perfil */}
          <section id="perfil" aria-labelledby="c-perfil" className="scroll-mt-28">
            <h2 id="c-perfil" className="font-display text-t3 font-light">Perfil</h2>
            <Perfil />
          </section>
        </div>
      </div>
    </div>
  );
}

function orden(a: Fila, b: Fila) {
  return (a.sesion.fecha + a.sesion.inicio).localeCompare(b.sesion.fecha + b.sesion.inicio);
}

function FilaReserva({ fila: { reserva: r, sesion: s, numero } }: { fila: Fila }) {
  const pendiente = r.estado === 'pendiente_pago';
  return (
    <li className="grid grid-cols-[4.5rem_1fr] gap-4 rounded-suave border border-cafe/12 p-4 sm:grid-cols-[5.5rem_1fr_auto] sm:items-center sm:p-5">
      <div className="flex flex-col items-center justify-center rounded-[0.6rem] bg-terracota/[0.14] py-3 text-center">
        <span className="cifra text-[2rem] leading-none">{Number(s.fecha.slice(8))}</span>
        <span className="eyebrow mt-1 text-[0.55rem]">{fechaCompacta(s.fecha).split(' ')[2]}</span>
      </div>
      <div className="min-w-0">
        <p className="eyebrow text-[0.58rem] text-cafe/60">
          {TIPO[r.tipo]}{numero ? ` · clase ${numero}` : ''}
          <span className="ml-2 text-cafe">{r.folio ?? 'Pago en proceso'}</span>
        </p>
        <p className="mt-1 font-display text-t4 font-light">{r.titulo}</p>
        <p className="mt-1 text-nota text-cafe/70 first-letter:uppercase">
          {fechaCompleta(s.fecha)} · {rango(s.inicio, s.fin)}
        </p>
        <p className="mt-1 text-[0.74rem] text-cafe/60">
          {r.ninos?.length ? r.ninos.map((n) => n.nombre).join(', ') : `${r.participantes} ${r.participantes === 1 ? 'persona' : 'personas'}`}
        </p>
      </div>
      <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:flex-col sm:items-end">
        <span className={`eyebrow rounded-full px-2.5 py-1 text-[0.55rem] ${pendiente ? 'bg-naranja/20' : 'bg-verde/25'}`}>{ESTADO[r.estado]}</span>
        <span className="eyebrow rounded-full border border-cafe/15 px-2.5 py-1 text-[0.55rem] text-cafe/70">Pago · {PAGO[r.pago]}</span>
        {r.demo && <MarcaDemo />}
      </div>
    </li>
  );
}

function TarjetaMembresia({ reserva: r }: { reserva: Reserva }) {
  const hechas = r.sesiones.filter((s) => yaPaso(s.fecha, s.inicio)).length;
  const total = r.sesiones.length;
  const siguientes = r.sesiones.filter((s) => !yaPaso(s.fecha, s.inicio));
  const mes = etiquetaMes(r.referencia).split(' ')[0];

  return (
    <div data-fondo="oscuro" className="overflow-hidden rounded-suave bg-cafe p-7 text-crema">
      <p className="cifra text-[1.6rem] leading-none tracking-[0.04em]">Membresía {mes}</p>
      <p className="mt-6 flex items-baseline gap-2">
        <span className="cifra text-[3.4rem] leading-none">{hechas}</span>
        <span className="cifra text-[1.6rem] text-crema/50">/ {total}</span>
        <span className="ml-2 text-nota text-crema/75">clases realizadas</span>
      </p>
      <div
        className="mt-5 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={hechas}
        aria-label={`${hechas} de ${total} clases realizadas`}
      >
        {r.sesiones.map((s, i) => (
          <span key={s.id} className={`h-2.5 rounded-full ${i < hechas ? 'bg-amarillo' : 'bg-crema/20'}`} />
        ))}
      </div>
      <p className="mt-4 text-nota text-crema/75">
        {total - hechas === 0 ? 'Completaste tus clases de este mes.' : `Te ${total - hechas === 1 ? 'queda 1 clase' : `quedan ${total - hechas} clases`}.`}
      </p>

      {siguientes.length > 0 && (
        <>
          <p className="eyebrow mt-8 text-[0.6rem] text-crema/60">Próximas clases</p>
          <ul className="mt-3 space-y-2">
            {siguientes.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-4 border-b border-crema/15 pb-2 text-nota">
                <span className="capitalize">{fechaCompacta(s.fecha)}</span>
                <span className="text-crema/70">{hora(s.inicio)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-6 text-[0.72rem] text-crema/55">{pesosCortos(r.precioUnitario)} · {r.folio ?? 'Pago en proceso'}</p>
      <Link to="/membresia/reservar" className="subrayado-fijo mt-5 inline-block pb-0.5 text-[0.78rem]">Reservar el siguiente mes</Link>
    </div>
  );
}

function Perfil() {
  const { usuario, actualizar } = useSesion();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '');
  const [estado, setEstado] = useState<'inicial' | 'guardando' | 'listo'>('inicial');
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setEstado('guardando');
    setError(null);
    try {
      await actualizar({ nombre, telefono });
      setEstado('listo');
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No pudimos guardar. Intenta de nuevo.');
      setEstado('inicial');
    }
  }

  return (
    <form onSubmit={guardar} className="mt-6 space-y-6" noValidate>
      {error && <Aviso>{error}</Aviso>}
      {estado === 'listo' && <Aviso tipo="exito">Guardamos tus cambios.</Aviso>}
      <Campo id="p-nombre" label="Nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); setEstado('inicial'); }} autoComplete="name" />
      <Campo id="p-email" label="Correo" value={usuario?.email ?? ''} readOnly ayuda="Para cambiar tu correo, escríbenos." className="text-cafe/60" />
      <Campo id="p-telefono" label="Teléfono" type="tel" value={telefono} onChange={(e) => { setTelefono(e.target.value); setEstado('inicial'); }} autoComplete="tel" />
      <Boton type="submit" variante="secundario" tamano="chico" disabled={estado === 'guardando'}>
        {estado === 'guardando' ? 'Guardando…' : 'Guardar cambios'}
      </Boton>
    </form>
  );
}
