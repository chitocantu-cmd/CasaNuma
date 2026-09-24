import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorDatos, repoAdmin } from '../../datos';
import { invalidarCupos, useConsulta } from '../../datos/hooks';
import type { MetodoPago, Nino, SesionAdmin } from '../../datos/tipos';
import { KIDS } from '../../contenido/oferta';
import { claveMes, hoy, sumarMeses, yaPaso } from '../../lib/calendario';
import { textoLugares, sinLugar } from '../../lib/cupo';
import { Icono } from '../../componentes/base/Iconos';
import { Aviso } from '../../componentes/base/Campos';
import { ETIQUETA_METODO, EncabezadoPanel, Tarjeta, claseCampo, diaMesSemana, dinero, horaCorta } from './ui';

function Etiqueta({ htmlFor, children }: { htmlFor: string; children: string }) {
  return <label htmlFor={htmlFor} className="eyebrow mb-1.5 block text-[0.58rem] text-cafe/60">{children}</label>;
}

/**
 * Reserva registrada por el equipo: lo que llega por Instagram, WhatsApp o en
 * persona (p. ej. los talleres "Info DM", que no se cobran en línea). Así el
 * panel es la única fuente de verdad del cupo.
 */
export default function PanelNuevaReserva() {
  const navigate = useNavigate();
  const mes = claveMes(hoy());
  const { datos: talleres } = useConsulta('admin:talleres', () => repoAdmin.talleres());
  const { datos: m1 } = useConsulta(`admin:agenda:${mes}`, () => repoAdmin.agenda(mes));
  const { datos: m2 } = useConsulta(`admin:agenda:${sumarMeses(mes, 1)}`, () => repoAdmin.agenda(sumarMeses(mes, 1)));

  // Sesiones futuras de talleres y NUMA Kids. La membresía (4 clases) se
  // contrata desde la web.
  const opciones = useMemo(() => {
    const kids = [...(m1 ?? []), ...(m2 ?? [])].filter((x) => x.tipo === 'kids');
    return [...(talleres ?? []), ...kids]
      .filter((x) => !yaPaso(x.sesion.fecha, x.sesion.inicio))
      .filter((x, i, arr) => arr.findIndex((y) => y.sesion.id === x.sesion.id) === i)
      .sort((a, b) => (a.sesion.fecha + a.sesion.inicio).localeCompare(b.sesion.fecha + b.sesion.inicio));
  }, [talleres, m1, m2]);

  const [sesionId, setSesionId] = useState('');
  const [personas, setPersonas] = useState(1);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [ninos, setNinos] = useState<Nino[]>([{ nombre: '', edad: KIDS.edadMinima }]);
  const [total, setTotal] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia');
  const [pagado, setPagado] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [avisar, setAvisar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const elegida: SesionAdmin | undefined = opciones.find((x) => x.sesion.id === sesionId);
  const esKids = elegida?.tipo === 'kids';
  const sugerido = elegida?.precio != null ? elegida.precio * personas : null;

  function cambiarPersonas(n: number) {
    const v = Math.max(1, n);
    setPersonas(v);
    if (esKids) setNinos((a) => Array.from({ length: v }, (_, i) => a[i] ?? { nombre: '', edad: KIDS.edadMinima }));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!elegida) return setError('Elige la sesión.');
    const importe = total === '' ? sugerido : Number(total);
    if (importe === null || !Number.isFinite(importe) || importe < 0) return setError('Captura el importe total.');
    setEnviando(true);
    try {
      const r = await repoAdmin.crearReservaManual({
        sesionId: elegida.sesion.id,
        participantes: personas,
        contacto: { nombre, telefono, email },
        total: importe,
        metodoPago: metodo,
        pagado,
        referenciaPago: referencia,
        notasInternas: notas,
        ninos: esKids ? ninos : undefined,
        avisarCliente: avisar,
      });
      invalidarCupos();
      navigate(`/admin/reservas/${r.id}`);
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No pudimos registrar la reserva.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/reservas" className="group inline-flex items-center gap-2 text-nota text-cafe/70 hover:text-cafe">
        <Icono.flechaIzq tam={16} className="transition-transform group-hover:-translate-x-1" /> Reservas
      </Link>
      <EncabezadoPanel eyebrow="Registrar" titulo="Nueva reserva" />
      <p className="max-w-2xl text-nota text-cafe/75">
        Para lo que llega por Instagram, WhatsApp o en persona. Descuenta cupo igual que una reserva de la web y recibe su folio.
      </p>

      <form onSubmit={guardar} className="grid gap-6 lg:grid-cols-12" noValidate>
        <div className="space-y-6 lg:col-span-7">
          {error && <Aviso>{error}</Aviso>}
          <Tarjeta titulo="Experiencia">
            <Etiqueta htmlFor="n-sesion">Sesión</Etiqueta>
            <select id="n-sesion" value={sesionId} onChange={(e) => { setSesionId(e.target.value); setTotal(''); }} className={`${claseCampo} w-full`}>
              <option value="">Elige taller o NUMA Kids…</option>
              {opciones.map((x) => (
                <option key={x.sesion.id} value={x.sesion.id} disabled={sinLugar(x.sesion)}>
                  {diaMesSemana(x.sesion.fecha)} · {horaCorta(x.sesion.inicio)} · {x.titulo} · {x.precio != null ? `${dinero(x.precio)} p/p` : x.etiquetaPrecio ?? ''} · {textoLugares(x.sesion)}
                </option>
              ))}
            </select>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Etiqueta htmlFor="n-personas">{esKids ? 'Niños' : 'Personas'}</Etiqueta>
                <input id="n-personas" type="number" min={1} value={personas} onChange={(e) => cambiarPersonas(Number(e.target.value))} className={`${claseCampo} w-full`} />
              </div>
              {elegida && (
                <p className="self-end pb-2 text-[0.78rem] text-cafe/65">
                  {elegida.sesion.cupo !== null ? `${elegida.ocupados} de ${elegida.sesion.cupo} lugares ocupados` : `${elegida.ocupados} reservados · cupo por confirmar`}
                </p>
              )}
            </div>
            {esKids && (
              <div className="mt-4 space-y-3 border-t border-cafe/10 pt-4">
                <p className="eyebrow text-[0.58rem] text-cafe/60">Niños (solo nombre y edad)</p>
                {ninos.map((n, i) => (
                  <div key={i} className="grid grid-cols-[1fr_6rem] gap-2">
                    <input aria-label={`Nombre del niño ${i + 1}`} placeholder="Nombre" value={n.nombre} onChange={(e) => setNinos((a) => a.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} className={claseCampo} />
                    <input aria-label={`Edad del niño ${i + 1}`} type="number" min={KIDS.edadMinima} max={KIDS.edadMaxima} value={n.edad} onChange={(e) => setNinos((a) => a.map((x, j) => (j === i ? { ...x, edad: Number(e.target.value) } : x)))} className={claseCampo} />
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo={esKids ? 'Mamá, papá o tutor' : 'Cliente'}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Etiqueta htmlFor="n-nombre">Nombre</Etiqueta>
                <input id="n-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={`${claseCampo} w-full`} autoComplete="off" />
              </div>
              <div>
                <Etiqueta htmlFor="n-tel">Teléfono</Etiqueta>
                <input id="n-tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={`${claseCampo} w-full`} />
              </div>
              <div>
                <Etiqueta htmlFor="n-email">Correo</Etiqueta>
                <input id="n-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${claseCampo} w-full`} />
              </div>
            </div>
          </Tarjeta>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Tarjeta titulo="Pago">
            <Etiqueta htmlFor="n-total">Importe total (MXN)</Etiqueta>
            <input
              id="n-total" type="number" min={0} inputMode="decimal"
              value={total === '' && sugerido !== null ? String(sugerido) : total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder={elegida && elegida.precio == null ? 'Precio acordado por mensaje' : ''}
              className={`${claseCampo} w-full`}
            />
            {elegida && elegida.precio == null && (
              <p className="mt-1.5 text-[0.72rem] text-cafe/60">Este taller no tiene precio publicado: captura el acordado.</p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Etiqueta htmlFor="n-metodo">Método</Etiqueta>
                <select id="n-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} className={`${claseCampo} w-full`}>
                  {(Object.keys(ETIQUETA_METODO) as MetodoPago[]).map((m) => <option key={m} value={m}>{ETIQUETA_METODO[m]}</option>)}
                </select>
              </div>
              <div>
                <Etiqueta htmlFor="n-ref">Referencia</Etiqueta>
                <input id="n-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" className={`${claseCampo} w-full`} />
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2.5 text-[0.86rem]">
              <input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} className="h-4 w-4 accent-cafe" />
              Ya pagó (la reserva queda confirmada)
            </label>
            {pagado && (
              <label className="mt-2 flex items-center gap-2.5 text-[0.86rem]">
                <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="h-4 w-4 accent-cafe" />
                Enviar confirmación a la clienta
              </label>
            )}
          </Tarjeta>

          <Tarjeta titulo="Notas internas">
            <textarea aria-label="Notas internas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full resize-none rounded-[0.5rem] border border-cafe/20 bg-crema p-3 text-[0.86rem] outline-none focus:border-cafe" placeholder="Ej. Apartó por Instagram." />
          </Tarjeta>

          <button type="submit" disabled={enviando} className="min-h-12 w-full rounded-full bg-cafe px-6 text-[0.78rem] font-medium uppercase tracking-[0.14em] text-crema disabled:opacity-50">
            {enviando ? 'Registrando…' : 'Registrar reserva'}
          </button>
        </div>
      </form>
    </div>
  );
}
