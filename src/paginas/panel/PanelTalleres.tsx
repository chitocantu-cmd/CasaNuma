import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErrorDatos, repoAdmin } from '../../datos';
import { invalidarCupos, useConsulta } from '../../datos/hooks';
import type { CambiosTaller, CategoriaTaller, SesionAdmin, TallerCatalogo, TallerNuevo, TipoExperiencia } from '../../datos/tipos';
import { ETIQUETA_CATEGORIA, FOTOS_TALLER } from '../../datos/catalogo';
import { FOTOS, type IdFoto } from '../../contenido/fotos';
import { fuenteDatos } from '../../config/site';
import { hoy, rango, yaPaso } from '../../lib/calendario';
import { textoLugares } from '../../lib/cupo';
import { useAtraparFoco } from '../../lib/foco';
import Foto from '../../componentes/base/Foto';
import { Aviso } from '../../componentes/base/Campos';
import { Icono } from '../../componentes/base/Iconos';
import ErrorCarga from '../../componentes/base/ErrorCarga';
import { ETIQUETA_TIPO, EncabezadoPanel, claseCampo, claseTabla, diaMesSemana, dinero, horaCorta } from './ui';
import { CargandoBloque } from '../../componentes/base/Cargando';

const PESTANAS: TipoExperiencia[] = ['taller', 'kids', 'membresia', 'pinta'];
type Mensaje = { texto: string; error: boolean } | null;

/** Cupo editable por sesión. Vacío = sin confirmar (no se cuenta cupo). */
function CeldaCupo({ s, onGuardado }: { s: SesionAdmin; onGuardado: (msg: string | null, error?: boolean) => void }) {
  const [valor, setValor] = useState(s.sesion.cupo === null ? '' : String(s.sesion.cupo));
  const [guardando, setGuardando] = useState(false);
  const cambiado = valor !== (s.sesion.cupo === null ? '' : String(s.sesion.cupo));

  async function guardar() {
    setGuardando(true);
    try {
      await repoAdmin.ajustarCupo(s.sesion.id, valor.trim() === '' ? null : Number(valor));
      invalidarCupos();
      onGuardado(`Cupo de ${s.titulo} (${diaMesSemana(s.sesion.fecha)} ${horaCorta(s.sesion.inicio)}) actualizado.`);
    } catch (e) {
      onGuardado(e instanceof ErrorDatos ? e.message : 'No pudimos guardar el cupo.', true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <input
        type="number" min={0} inputMode="numeric" value={valor} placeholder="—"
        onChange={(e) => setValor(e.target.value)}
        aria-label={`Cupo de ${s.titulo} ${s.sesion.fecha} ${s.sesion.inicio}`}
        className={`${claseCampo} h-9 w-20`}
      />
      {cambiado && (
        <button type="button" onClick={guardar} disabled={guardando} className="min-h-9 rounded-full bg-cafe px-3 text-[0.68rem] font-medium uppercase tracking-[0.1em] text-crema disabled:opacity-50">
          {guardando ? '…' : 'Guardar'}
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Formulario: nuevo taller o edición
// ---------------------------------------------------------------------------
interface Borrador {
  titulo: string;
  resumen: string;
  categoria: CategoriaTaller;
  precio: string;
  foto: IdFoto;
  fecha: string;
  horarios: { inicio: string; fin: string }[];
  cupo: string;
}

const VACIO: Borrador = {
  titulo: '', resumen: '', categoria: 'adultos', precio: '800', foto: FOTOS_TALLER[0], fecha: '',
  horarios: [{ inicio: '11:00', fin: '13:00' }], cupo: '16',
};

function FormTaller({ taller, onCerrar, onListo }: {
  /** null = nuevo. */
  taller: TallerCatalogo | null;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [d, setD] = useState<Borrador>(() => taller
    ? { ...VACIO, titulo: taller.titulo, resumen: taller.resumen, categoria: taller.categoria, precio: taller.precio === null ? '' : String(taller.precio), foto: taller.foto }
    : VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const precioFijo = taller !== null && taller.flujo !== 'taller';
  useAtraparFoco(caja, true);

  // Al abrir: foco en el primer campo y la página de atrás no se desplaza.
  useEffect(() => {
    caja.current?.querySelector<HTMLElement>('input')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar, guardando]);

  const cambiar = (k: keyof Borrador, v: string) => setD((x) => ({ ...x, [k]: v }));
  const precio = d.precio.trim() === '' ? null : Number(d.precio);

  const enCurso = useRef(false);
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enCurso.current) return;
    enCurso.current = true;
    setGuardando(true);
    setError(null);
    try {
      if (taller) {
        const cambios: CambiosTaller = { titulo: d.titulo, resumen: d.resumen, categoria: d.categoria, foto: d.foto };
        if (!precioFijo) cambios.precio = precio;
        await repoAdmin.editarTaller(taller.id, cambios);
        onListo(`Guardamos los cambios de «${d.titulo.trim()}».`);
      } else {
        const nuevo: TallerNuevo = {
          titulo: d.titulo, resumen: d.resumen, categoria: d.categoria, precio, foto: d.foto, fecha: d.fecha,
          horarios: d.horarios.map((h) => ({ inicio: h.inicio, fin: h.fin || null })),
          cupo: d.cupo.trim() === '' ? null : Number(d.cupo),
        };
        await repoAdmin.crearTaller(nuevo);
        onListo(`«${d.titulo.trim()}» ya está en la agenda del sitio.`);
      }
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No pudimos guardar. Intenta de nuevo.');
      enCurso.current = false;
      setGuardando(false);
    }
  }

  const etiqueta = 'eyebrow mb-1.5 block text-[0.58rem] text-cafe/65';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cafe/60 sm:items-center sm:p-6" onClick={() => !guardando && onCerrar()}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-taller-titulo"
        className="relative max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-t-suave bg-crema p-6 sm:rounded-suave sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onCerrar} disabled={guardando} className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-cafe/[0.06]" aria-label="Cerrar">
          <Icono.cerrar tam={22} />
        </button>
        <h2 id="form-taller-titulo" className="font-display text-[1.7rem] font-light">{taller ? 'Editar taller' : 'Nuevo taller'}</h2>
        <p className="mt-1 text-[0.8rem] text-cafe/65">
          {taller
            ? 'La fecha y los horarios no cambian: pueden tener reservas. Para otra fecha, crea un taller nuevo y desactiva este.'
            : 'Aparece en la agenda del sitio en cuanto lo guardas. Sin precio, se pide información por WhatsApp.'}
        </p>

        <form onSubmit={guardar} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
          {error && <div className="sm:col-span-2"><Aviso>{error}</Aviso></div>}
          <label className="sm:col-span-2">
            <span className={etiqueta}>Nombre</span>
            <input className={`${claseCampo} w-full`} value={d.titulo} onChange={(e) => cambiar('titulo', e.target.value)} placeholder="Tazas de otoño" />
          </label>
          <label className="sm:col-span-2">
            <span className={etiqueta}>Descripción corta</span>
            <textarea
              className={`${claseCampo} h-auto min-h-[5rem] w-full py-2`} value={d.resumen} rows={3}
              onChange={(e) => cambiar('resumen', e.target.value)} placeholder="Lo que se crea y cómo es la experiencia."
            />
          </label>
          <label>
            <span className={etiqueta}>Categoría</span>
            <select className={`${claseCampo} w-full`} value={d.categoria} onChange={(e) => cambiar('categoria', e.target.value)}>
              {(Object.keys(ETIQUETA_CATEGORIA) as CategoriaTaller[]).map((c) => <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>)}
            </select>
          </label>
          <label>
            <span className={etiqueta}>Precio por persona (MXN)</span>
            <input
              className={`${claseCampo} w-full disabled:opacity-60`} type="number" min={1} inputMode="numeric" value={d.precio}
              onChange={(e) => cambiar('precio', e.target.value)} placeholder="Vacío = pedir información" disabled={precioFijo}
            />
            {precioFijo && <span className="mt-1 block text-[0.7rem] text-cafe/60">Lo define la página de {taller?.flujo === 'kids' ? 'NUMA Kids' : 'la membresía'}.</span>}
          </label>
          <div className="sm:col-span-2">
            <label>
              <span className={etiqueta}>Foto</span>
              <select className={`${claseCampo} w-full`} value={d.foto} onChange={(e) => cambiar('foto', e.target.value)}>
                {FOTOS_TALLER.map((id) => <option key={id} value={id}>{FOTOS[id].alt}</option>)}
              </select>
            </label>
            <Foto id={d.foto} className="mt-3 aspect-[16/7] w-full rounded-[0.6rem]" sizes="40rem" />
          </div>

          {!taller && (
            <>
              <label>
                <span className={etiqueta}>Fecha</span>
                <input className={`${claseCampo} w-full`} type="date" min={hoy()} value={d.fecha} onChange={(e) => cambiar('fecha', e.target.value)} />
              </label>
              <label>
                <span className={etiqueta}>Cupo por horario</span>
                <input className={`${claseCampo} w-full`} type="number" min={1} inputMode="numeric" value={d.cupo} onChange={(e) => cambiar('cupo', e.target.value)} placeholder="Vacío = cupo limitado" />
              </label>
              <fieldset className="sm:col-span-2">
                <legend className={etiqueta}>Horarios</legend>
                <div className="space-y-2">
                  {d.horarios.map((h, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time" className={`${claseCampo} w-32`} value={h.inicio} aria-label={`Inicio del horario ${i + 1}`}
                        onChange={(e) => setD((x) => ({ ...x, horarios: x.horarios.map((y, j) => (j === i ? { ...y, inicio: e.target.value } : y)) }))}
                      />
                      <span className="text-[0.8rem] text-cafe/60">a</span>
                      <input
                        type="time" className={`${claseCampo} w-32`} value={h.fin} aria-label={`Término del horario ${i + 1}`}
                        onChange={(e) => setD((x) => ({ ...x, horarios: x.horarios.map((y, j) => (j === i ? { ...y, fin: e.target.value } : y)) }))}
                      />
                      {d.horarios.length > 1 && (
                        <button
                          type="button" className="min-h-9 rounded-full px-3 text-[0.74rem] text-cafe/70 hover:text-cafe"
                          onClick={() => setD((x) => ({ ...x, horarios: x.horarios.filter((_, j) => j !== i) }))}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {d.horarios.length < 3 && (
                  <button
                    type="button" className="subrayado-fijo mt-3 pb-0.5 text-[0.78rem]"
                    onClick={() => setD((x) => ({ ...x, horarios: [...x.horarios, { inicio: '16:00', fin: '18:00' }] }))}
                  >
                    Agregar otro horario
                  </button>
                )}
              </fieldset>
            </>
          )}

          <div className="flex flex-wrap gap-3 pt-2 sm:col-span-2">
            <button type="submit" disabled={guardando} className="min-h-11 rounded-full bg-cafe px-6 text-[0.76rem] font-medium uppercase tracking-[0.12em] text-crema disabled:opacity-50">
              {guardando ? 'Guardando…' : taller ? 'Guardar cambios' : 'Crear taller'}
            </button>
            <button type="button" onClick={onCerrar} disabled={guardando} className="min-h-11 rounded-full px-5 text-[0.76rem] uppercase tracking-[0.12em] text-cafe/75 hover:text-cafe">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------
function FilaCatalogo({ t, onEditar, onCambio }: { t: TallerCatalogo; onEditar: () => void; onCambio: (m: Mensaje) => void }) {
  const [trabajando, setTrabajando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const reservados = t.sesiones.reduce((n, s) => n + s.ocupados, 0);

  async function alternar() {
    if (t.activo && reservados > 0 && !confirmar) return setConfirmar(true);
    setTrabajando(true);
    try {
      await repoAdmin.activarTaller(t.id, !t.activo);
      invalidarCupos();
      onCambio({ texto: t.activo ? `«${t.titulo}» ya no se muestra en el sitio.` : `«${t.titulo}» vuelve a estar en la agenda.`, error: false });
    } catch (e) {
      onCambio({ texto: e instanceof ErrorDatos ? e.message : 'No pudimos cambiar el estado.', error: true });
    } finally {
      setTrabajando(false);
      setConfirmar(false);
    }
  }

  return (
    <li className={`grid grid-cols-[4.5rem_1fr] gap-4 rounded-suave border border-cafe/12 bg-crema p-3 sm:grid-cols-[5.5rem_1fr_auto] sm:items-center ${t.activo ? '' : 'opacity-70'}`}>
      <Foto id={t.foto} className="aspect-square w-full rounded-[0.5rem]" sizes="88px" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[0.72rem] text-cafe/65">
          <span>{diaMesSemana(t.fecha)}</span>
          <span>· {ETIQUETA_CATEGORIA[t.categoria]}</span>
          {t.flujo !== 'taller' && <span>· {t.flujo === 'kids' ? 'NUMA Kids' : 'Membresía'}</span>}
          <span className={`rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] ${t.activo ? 'bg-verde/25 text-cafe' : 'bg-cafe/[0.08] text-cafe/70'}`}>
            {t.activo ? 'Activo' : 'Inactivo'}
          </span>
          {(t.origen === 'panel' || t.editado) && (
            <span className="rounded-full border border-cafe/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em]">
              {t.origen === 'panel' ? 'Creado en el panel' : 'Editado en el panel'}
            </span>
          )}
        </p>
        <p className="mt-1 truncate font-display text-[1.2rem] font-light">{t.titulo}</p>
        <p className="mt-0.5 text-[0.76rem] text-cafe/70">
          {t.sesiones.map((s) => rango(s.inicio, s.fin)).join(' · ') || 'Sin horarios'}
          {' · '}{t.precio !== null ? `${dinero(t.precio)} p/p` : t.flujo === 'membresia' ? 'Membresía' : 'Info DM'}
          {' · '}{reservados} {reservados === 1 ? 'reservado' : 'reservados'}
        </p>
        {confirmar && (
          <p className="mt-2 text-[0.74rem] text-naranja">
            Tiene {reservados} {reservados === 1 ? 'lugar reservado' : 'lugares reservados'}: siguen vigentes, pero el taller deja de verse en el sitio. Toca «Desactivar» otra vez para confirmar.
          </p>
        )}
      </div>
      <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
        <button type="button" onClick={onEditar} className="min-h-9 rounded-full border border-cafe/25 px-4 text-[0.72rem] uppercase tracking-[0.1em] hover:border-cafe">
          Editar
        </button>
        <button type="button" onClick={alternar} disabled={trabajando} className="min-h-9 rounded-full px-4 text-[0.72rem] uppercase tracking-[0.1em] text-cafe/75 hover:text-cafe disabled:opacity-50">
          {trabajando ? '…' : t.activo ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </li>
  );
}

export default function PanelTalleres() {
  const sesiones = useConsulta('admin:talleres', () => repoAdmin.talleres());
  const catalogo = useConsulta('admin:catalogo', () => repoAdmin.catalogo());
  const [aviso, setAviso] = useState<Mensaje>(null);
  const [tipo, setTipo] = useState<TipoExperiencia>('taller');
  const [verTodos, setVerTodos] = useState(false);
  const [formulario, setFormulario] = useState<{ taller: TallerCatalogo | null } | null>(null);
  const lista = (sesiones.datos ?? []).filter((s) => s.tipo === tipo);
  const talleres = (catalogo.datos ?? []).filter((t) => verTodos || t.fecha >= hoy());

  const recargarTodo = () => {
    sesiones.recargar();
    catalogo.recargar();
  };

  return (
    <div className="space-y-6">
      <EncabezadoPanel
        eyebrow="Agenda y cupos"
        titulo="Talleres"
        accion={
          <button type="button" onClick={() => setFormulario({ taller: null })} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-cafe px-5 text-[0.74rem] font-medium uppercase tracking-[0.12em] text-crema">
            <Icono.mas tam={16} /> Nuevo taller
          </button>
        }
      />
      {fuenteDatos === 'demo' && (
        <p className="text-[0.78rem] text-indigo">En la demo, lo que crees o cambies aquí vive en este navegador (también se ve en el sitio).</p>
      )}
      {aviso && <Aviso tipo={aviso.error ? 'error' : 'exito'}>{aviso.texto}</Aviso>}

      {/* Catálogo -------------------------------------------------------- */}
      <section aria-labelledby="t-catalogo" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="t-catalogo" className="font-display text-[1.5rem] font-light">Catálogo</h2>
          <label className="inline-flex items-center gap-2 text-[0.78rem] text-cafe/75">
            <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} className="h-4 w-4 accent-cafe" />
            Incluir los que ya pasaron
          </label>
        </div>
        {!catalogo.datos && catalogo.error ? (
          <ErrorCarga onReintentar={catalogo.recargar} />
        ) : !catalogo.datos ? (
          <CargandoBloque className="h-40" />
        ) : talleres.length === 0 ? (
          <div className="rounded-suave border border-dashed border-cafe/20 p-8 text-center">
            <p className="text-nota text-cafe/70">No hay talleres próximos en el catálogo.</p>
            <button type="button" onClick={() => setFormulario({ taller: null })} className="subrayado-fijo mt-3 pb-0.5 text-nota">Crear el primero</button>
          </div>
        ) : (
          <ul className="space-y-2">
            {talleres.map((t) => (
              <FilaCatalogo
                key={t.id}
                t={t}
                onEditar={() => setFormulario({ taller: t })}
                onCambio={(m) => { setAviso(m); recargarTodo(); }}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Cupos por sesión -------------------------------------------------- */}
      <section aria-labelledby="t-cupos" className="space-y-3 pt-4">
        <h2 id="t-cupos" className="font-display text-[1.5rem] font-light">Cupos por sesión</h2>
        <p className="max-w-3xl text-[0.82rem] text-cafe/75">
          Cupo de cada sesión (16 por omisión). El sitio cuenta lugares, muestra «Solo quedan N» y cambia el botón a
          «Agotado» al llenarse. Vacío = «Cupo limitado», sin número.
        </p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de sesión">
          {PESTANAS.map((k) => (
            <button
              key={k} type="button" role="tab" aria-selected={tipo === k} onClick={() => setTipo(k)}
              className={`min-h-10 rounded-full border px-4 text-[0.8rem] transition-colors ${tipo === k ? 'border-cafe bg-cafe text-crema' : 'border-cafe/25 hover:border-cafe'}`}
            >
              {k === 'taller' ? 'Talleres' : ETIQUETA_TIPO[k]}
            </button>
          ))}
        </div>

        {!sesiones.datos && sesiones.error ? (
          <ErrorCarga onReintentar={sesiones.recargar} />
        ) : !sesiones.datos ? (
          <CargandoBloque className="h-60" />
        ) : lista.length === 0 ? (
          <p className="rounded-suave border border-dashed border-cafe/20 p-8 text-center text-nota text-cafe/70">No hay sesiones de este tipo en la agenda.</p>
        ) : (
          <div className="overflow-x-auto rounded-suave border border-cafe/12 bg-crema">
            <table className={claseTabla.tabla}>
              <thead>
                <tr>
                  {['Fecha', 'Hora', 'Experiencia', 'Precio', 'Reserva', 'Reservados', 'Cupo', 'Disponibles'].map((h) => (
                    <th key={h} className={claseTabla.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={s.sesion.id} className={yaPaso(s.sesion.fecha, s.sesion.inicio) ? 'opacity-60' : ''}>
                    <td className={`${claseTabla.td} whitespace-nowrap`}>{diaMesSemana(s.sesion.fecha)}</td>
                    <td className={`${claseTabla.td} whitespace-nowrap`}>{horaCorta(s.sesion.inicio)}</td>
                    <td className={claseTabla.td}>{s.titulo}</td>
                    <td className={`${claseTabla.td} whitespace-nowrap`}>{s.precio !== null ? `${dinero(s.precio)} p/p` : s.etiquetaPrecio ?? '—'}</td>
                    <td className={claseTabla.td}>{s.reservaEnLinea ? 'En línea' : 'Por mensaje'}</td>
                    <td className={claseTabla.td}>{s.ocupados}</td>
                    <td className={claseTabla.td}>
                      <CeldaCupo key={`${s.sesion.id}-${s.sesion.cupo}`} s={s} onGuardado={(t, error = false) => { setAviso(t ? { texto: t, error } : null); recargarTodo(); }} />
                    </td>
                    <td className={`${claseTabla.td} whitespace-nowrap`}>{textoLugares(s.sesion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formulario && (
        <FormTaller
          taller={formulario.taller}
          onCerrar={() => setFormulario(null)}
          onListo={(texto) => {
            setFormulario(null);
            setAviso({ texto, error: false });
            invalidarCupos();
            recargarTodo();
          }}
        />
      )}
    </div>
  );
}
