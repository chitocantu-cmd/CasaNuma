import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { obtenerTallerAdmin, guardarTaller } from '../../services/workshops';
import { sincronizarCalendario } from '../../services/reservations';
import { subirImagen, optimizar } from '../../services/cloudinary';
import type { WorkshopAdmin, Categoria, WorkshopStatus } from '../../tipos';
import { useTitulo } from '../../features/workshops/hooks';
import { Boton, Campo, AreaTexto, Aviso, Cargando, ImagenPendiente } from '../../componentes/ui';

const CATEGORIAS: { id: Categoria; label: string }[] = [
  { id: 'ceramica', label: 'Cerámica' },
  { id: 'pintura', label: 'Pintura' },
  { id: 'libre', label: 'Taller libre' },
  { id: 'especiales', label: 'Especiales' },
];

type Borrador = Partial<WorkshopAdmin> & { slug: string };

const VACIO: Borrador = {
  slug: '', title: '', category: 'ceramica', short_description: '',
  description: [], date: '', start_time: '11:00', end_time: '13:30',
  timezone: 'America/Monterrey', price: 0, currency: 'MXN', capacity: 10,
  location: 'Casa Numa', instructor: '', level: '', image_url: null,
  cloudinary_public_id: null, gallery: [], includes: [], crearas: [],
  faqs: [], tono: 'terracota', booking_mode: 'paid', status: 'draft',
};

function aSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function AdminTallerForm() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const duplicarDe = params.get('duplicar');
  const navigate = useNavigate();

  const esNuevo = !id || id === 'nuevo';
  useTitulo(esNuevo ? 'Nuevo taller · Panel' : 'Editar taller · Panel');

  const [t, setT] = useState<Borrador>(VACIO);
  const [cargando, setCargando] = useState(!esNuevo || Boolean(duplicarDe));
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [slugTocado, setSlugTocado] = useState(false);

  useEffect(() => {
    const origen = duplicarDe ?? (esNuevo ? null : id);
    if (!origen) return;

    let vivo = true;
    obtenerTallerAdmin(origen)
      .then((data) => {
        if (!vivo || !data) return;
        if (duplicarDe) {
          // Duplicar copia el contenido pero NUNCA el evento de calendario ni
          // la fecha: se pide fecha y hora nuevas a propósito, y el taller
          // nace como borrador.
          const { id: _i, google_calendar_event_id: _g, created_at: _c,
                  updated_at: _u, ...resto } = data;
          void _i; void _g; void _c; void _u;
          setT({ ...resto, slug: '', date: '', status: 'draft',
                 google_calendar_event_id: null });
          setSlugTocado(false);
        } else {
          setT(data);
          setSlugTocado(true);
        }
      })
      .catch((e: Error) => { if (vivo) setError(e.message); })
      .finally(() => { if (vivo) setCargando(false); });

    return () => { vivo = false; };
  }, [id, esNuevo, duplicarDe]);

  function set<K extends keyof Borrador>(k: K, v: Borrador[K]) {
    setT((prev) => ({ ...prev, [k]: v }));
  }

  function setTitulo(valor: string) {
    setT((prev) => ({
      ...prev,
      title: valor,
      slug: slugTocado ? prev.slug : aSlug(valor),
    }));
  }

  async function alSubir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const img = await subirImagen(archivo);
      setT((prev) => ({ ...prev, image_url: img.url, cloudinary_public_id: img.publicId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos subir la imagen.');
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(estado: WorkshopStatus) {
    setError(null);
    setOk(null);

    if (!t.title?.trim()) return setError('Falta el nombre del taller.');
    if (!t.slug?.trim()) return setError('Falta el slug.');
    if (!t.date) return setError('Falta la fecha.');
    if (!t.capacity || t.capacity < 1) return setError('El cupo debe ser al menos 1.');
    if (estado === 'published' && t.booking_mode === 'paid' && Number(t.price) <= 0) {
      return setError('Un taller de pago necesita un precio mayor a cero.');
    }
    if (t.booking_mode === 'quote' && Number(t.price) !== 0) {
      return setError('Un taller "sobre cotización" debe tener precio 0.');
    }
    if ((t.end_time ?? '') <= (t.start_time ?? '')) {
      return setError('La hora de fin debe ser posterior a la de inicio.');
    }

    setGuardando(true);
    try {
      const guardado = await guardarTaller({ ...t, status: estado } as Borrador);

      // Al publicar se encola la creación/actualización del evento de Google
      // Calendar. Se encola, no se llama directo: si Google tarda, el panel no
      // se queda colgado y el reintento ya está resuelto por el worker.
      if (estado === 'published') {
        await sincronizarCalendario(guardado.id).catch(() => {
          setOk('Taller publicado. La sincronización con Calendar se reintentará sola.');
        });
      }

      setOk(estado === 'published' ? 'Taller publicado.' : 'Borrador guardado.');
      if (esNuevo || duplicarDe) navigate(`/admin/talleres/${guardado.id}`, { replace: true });
      else setT(guardado);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar el taller.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <Cargando texto="Cargando taller…" />;

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-[1.8rem] leading-none">
        {esNuevo ? (duplicarDe ? 'Duplicar taller' : 'Nuevo taller') : 'Editar taller'}
      </h1>

      {duplicarDe && (
        <p className="mt-3 text-[0.92rem] text-tinta/60">
          Se copió el contenido. Pon fecha, hora y slug nuevos: las reservaciones
          y el evento de calendario no se copian.
        </p>
      )}

      {error && <div className="mt-5"><Aviso>{error}</Aviso></div>}
      {ok && <div className="mt-5"><Aviso tipo="info">{ok}</Aviso></div>}

      <div className="mt-8 flex flex-col gap-6">
        <Campo id="w-title" label="Nombre" requerido value={t.title ?? ''}
          onChange={(e) => setTitulo(e.target.value)} />

        <Campo id="w-slug" label="Slug" requerido ayuda="URL del taller"
          value={t.slug} onChange={(e) => { setSlugTocado(true); set('slug', aSlug(e.target.value)); }} />

        <div className="flex flex-col">
          <span className="dato mb-1 text-tinta/55">Categoría</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((c) => (
              <button key={c.id} type="button" onClick={() => set('category', c.id)}
                aria-pressed={t.category === c.id}
                className={`dato border px-3 py-1.5 transition-colors ${
                  t.category === c.id ? 'border-tinta bg-tinta text-crema'
                    : 'border-tinta/20 text-tinta/60 hover:border-tinta/50'
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <Campo id="w-short" label="Descripción corta" value={t.short_description ?? ''}
          onChange={(e) => set('short_description', e.target.value)} />

        <AreaTexto id="w-desc" label="Descripción" ayuda="Un párrafo por línea"
          rows={6} value={(t.description ?? []).join('\n\n')}
          onChange={(e) => set('description', e.target.value.split(/\n{2,}/).filter(Boolean))} />

        <div className="grid gap-6 sm:grid-cols-3">
          <Campo id="w-date" label="Fecha" requerido type="date" value={t.date ?? ''}
            onChange={(e) => set('date', e.target.value)} />
          <Campo id="w-start" label="Inicio" requerido type="time" value={(t.start_time ?? '').slice(0, 5)}
            onChange={(e) => set('start_time', e.target.value)} />
          <Campo id="w-end" label="Fin" requerido type="time" value={(t.end_time ?? '').slice(0, 5)}
            onChange={(e) => set('end_time', e.target.value)} />
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Campo id="w-price" label="Precio (MXN)" type="number" min={0} step="0.01"
            value={String(t.price ?? 0)}
            onChange={(e) => set('price', Number(e.target.value))} />
          <Campo id="w-capacity" label="Cupo" requerido type="number" min={1}
            value={String(t.capacity ?? 1)}
            onChange={(e) => set('capacity', Number(e.target.value))} />
          <div className="flex flex-col">
            <span className="dato mb-1 text-tinta/55">Modo</span>
            <select
              value={t.booking_mode ?? 'paid'}
              onChange={(e) => set('booking_mode', e.target.value as 'paid' | 'quote')}
              className="w-full border-b border-tinta/25 bg-transparent pb-2 text-[1rem] outline-none focus:border-terracota"
            >
              <option value="paid">Pago en línea</option>
              <option value="quote">Sobre cotización</option>
            </select>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Campo id="w-location" label="Ubicación" value={t.location ?? ''}
            onChange={(e) => set('location', e.target.value)} />
          <Campo id="w-instructor" label="Instructor" value={t.instructor ?? ''}
            onChange={(e) => set('instructor', e.target.value)} />
          <Campo id="w-level" label="Nivel" value={t.level ?? ''}
            onChange={(e) => set('level', e.target.value)} />
        </div>

        <AreaTexto id="w-includes" label="Incluye" ayuda="Uno por línea" rows={4}
          value={(t.includes ?? []).join('\n')}
          onChange={(e) => set('includes', e.target.value.split('\n').filter(Boolean))} />

        <AreaTexto id="w-crearas" label="Crearás" ayuda="Uno por línea" rows={3}
          value={(t.crearas ?? []).join('\n')}
          onChange={(e) => set('crearas', e.target.value.split('\n').filter(Boolean))} />

        {/* Imagen ------------------------------------------------------- */}
        <div>
          <span className="dato mb-2 block text-tinta/55">Imagen</span>
          <div className="flex flex-wrap items-start gap-5">
            {t.image_url ? (
              <img src={optimizar(t.image_url, 320) ?? ''} alt=""
                className="h-32 w-44 object-cover" />
            ) : (
              <ImagenPendiente encuadre="imagen del taller" tono={t.tono}
                className="h-32 w-44" />
            )}
            <div className="flex flex-col gap-2">
              <label className="dato cursor-pointer border border-tinta/25 px-4 py-2 transition-colors hover:border-tinta">
                {subiendo ? 'Subiendo…' : 'Subir imagen'}
                <input type="file" accept="image/*" onChange={alSubir}
                  disabled={subiendo} className="sr-only" />
              </label>
              {t.image_url && (
                <button type="button"
                  onClick={() => setT((p) => ({ ...p, image_url: null, cloudinary_public_id: null }))}
                  className="dato text-left text-tinta/50 hover:text-terracota">
                  Quitar
                </button>
              )}
              <p className="max-w-[24ch] text-[0.75rem] leading-snug text-tinta/40">
                Se sube firmada a Cloudinary. El archivo no pasa por la base de datos.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones ------------------------------------------------------- */}
      <div className="mt-10 flex flex-wrap gap-3 border-t border-tinta/12 pt-8">
        <Boton variante="secundario" disabled={guardando}
          onClick={() => guardar('draft')}>
          {guardando ? 'Guardando…' : 'Guardar borrador'}
        </Boton>
        <Boton disabled={guardando} onClick={() => guardar('published')}>
          {guardando ? 'Guardando…' : 'Publicar'}
        </Boton>
        {!esNuevo && t.status !== 'cancelled' && (
          <Boton variante="secundario" disabled={guardando}
            onClick={() => {
              if (confirm('¿Cancelar este taller? El evento de Google Calendar se marcará como CANCELADO. Las reservaciones NO se cancelan ni se reembolsan automáticamente.')) {
                guardar('cancelled');
              }
            }}
            className="ml-auto text-terracota">
            Cancelar taller
          </Boton>
        )}
      </div>
    </div>
  );
}
