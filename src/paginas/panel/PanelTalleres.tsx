import { useState } from 'react';
import { ErrorDatos, repoAdmin } from '../../datos';
import { invalidarCupos, useConsulta } from '../../datos/hooks';
import type { SesionAdmin, TipoExperiencia } from '../../datos/tipos';
import { fuenteDatos } from '../../config/site';
import { yaPaso } from '../../lib/calendario';
import { textoLugares } from '../../lib/cupo';
import { Aviso } from '../../componentes/base/Campos';
import { ETIQUETA_TIPO, EncabezadoPanel, claseCampo, claseTabla, diaMesSemana, dinero, horaCorta } from './ui';

const PESTANAS: TipoExperiencia[] = ['taller', 'kids', 'membresia'];

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
          Guardar
        </button>
      )}
    </span>
  );
}

export default function PanelTalleres() {
  const { datos, recargar } = useConsulta('admin:talleres', () => repoAdmin.talleres());
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const [tipo, setTipo] = useState<TipoExperiencia>('taller');
  const lista = (datos ?? []).filter((s) => s.tipo === tipo);

  return (
    <div className="space-y-6">
      <EncabezadoPanel eyebrow="Agenda y cupos" titulo="Talleres" />
      <p className="max-w-3xl text-[0.82rem] text-cafe/75">
        Cupo de cada sesión (16 por omisión). El sitio cuenta lugares, muestra «Solo quedan N» y cambia el botón a
        «Agotado» al llenarse. Vacío = «Cupo limitado», sin número.
        {fuenteDatos === 'demo' && ' En la demo, el cupo que captures aquí solo vive en este navegador.'}
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
      {aviso && <Aviso tipo={aviso.error ? 'error' : 'exito'}>{aviso.texto}</Aviso>}

      {!datos ? (
        <div className="h-60" aria-busy="true" />
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
                    <CeldaCupo key={`${s.sesion.id}-${s.sesion.cupo}`} s={s} onGuardado={(t, error = false) => { setAviso(t ? { texto: t, error } : null); recargar(); }} />
                  </td>
                  <td className={`${claseTabla.td} whitespace-nowrap`}>{textoLugares(s.sesion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[0.74rem] text-cafe/60">
        Crear talleres, cambiar fechas, precios y fotos desde aquí: siguiente etapa. Hoy la agenda vive en src/datos/agenda.ts, con la forma de la tabla del backend.
      </p>
    </div>
  );
}
