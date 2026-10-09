import { useState } from 'react';
import { ErrorDatos, repoAdmin } from '../../datos';
import { invalidarCupos, useConsulta } from '../../datos/hooks';
import { estadoPieza } from '../../datos/pinta';
import type { PiezaPinta } from '../../datos/tipos';
import { PORCENTAJE_ANTICIPO, calcularPagoReserva } from '../../lib/anticipo';
import Foto from '../../componentes/base/Foto';
import { Aviso } from '../../componentes/base/Campos';
import ErrorCarga from '../../componentes/base/ErrorCarga';
import { CargandoBloque } from '../../componentes/base/Cargando';
import { EncabezadoPanel, claseCampo, dinero } from './ui';

// ---------------------------------------------------------------------------
// Inventario de Pinta tu pieza
// ---------------------------------------------------------------------------
// Precio vacío = «Precio pendiente»: la pieza se ve pero no se puede pagar.
// Existencias vacías = sin conteo (no se limita); 0 = agotada. Las existencias
// bajan solas cuando se confirma un anticipo y suben si se cancela.
// ---------------------------------------------------------------------------

const ESTADO: Record<ReturnType<typeof estadoPieza>, string> = {
  disponible: 'Se puede reservar',
  agotada: 'Agotada',
  precio_pendiente: 'Precio pendiente',
  no_disponible: 'Apagada',
};

const aTexto = (n: number | null) => (n === null ? '' : String(n));

function FilaPieza({ pieza: p, onGuardado }: { pieza: PiezaPinta; onGuardado: (texto: string, error?: boolean) => void }) {
  // Con precio de ejemplo, el campo arranca vacío: el ejemplo no es el precio de Casa Numa.
  const precioInicial = p.demo ? '' : aTexto(p.precio);
  const [precio, setPrecio] = useState(precioInicial);
  const [stock, setStock] = useState(aTexto(p.stock));
  const [guardando, setGuardando] = useState(false);
  const cambioPrecio = precio !== precioInicial;
  const cambioStock = stock !== aTexto(p.stock);
  const cambiado = cambioPrecio || cambioStock;
  const estado = estadoPieza(p);

  async function guardar(cambios: Parameters<typeof repoAdmin.editarPieza>[1], texto: string) {
    setGuardando(true);
    try {
      await repoAdmin.editarPieza(p.id, cambios);
      invalidarCupos();
      onGuardado(texto);
    } catch (e) {
      onGuardado(e instanceof ErrorDatos ? e.message : 'No pudimos guardar la pieza.', true);
    } finally {
      setGuardando(false);
    }
  }

  const precioNum = precio.trim() === '' ? null : Number(precio);
  const vista = precioNum !== null && precioNum > 0 ? calcularPagoReserva(precioNum) : null;

  return (
    <li className="grid grid-cols-[4.5rem_1fr] gap-4 rounded-suave border border-cafe/12 bg-crema p-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center" data-pieza-panel={p.id}>
      <Foto foto={p.fotos[0]} className="aspect-[4/5] w-full rounded-[0.5rem]" sizes="5rem" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {p.nombre}
          {p.demo && (
            <span className="rounded-full border border-indigo/40 px-2 py-[2px] text-[0.55rem] font-medium uppercase tracking-[0.12em] text-indigo">
              Ejemplo {dinero(p.precio ?? 0)}
            </span>
          )}
        </p>
        <p className="text-[0.74rem] text-cafe/60">
          {p.categoria} · {ESTADO[estado]}
          {p.disponibles !== null && ` · ${p.disponibles} para reservar`}
        </p>
        {vista && <p className="mt-1 text-[0.74rem] text-cafe/70">Anticipo {dinero(vista.anticipo)} · saldo en estudio {dinero(vista.saldo)}</p>}
      </div>
      <div className="col-span-2 flex flex-wrap items-end gap-2 sm:col-span-1">
        <label className="text-[0.66rem] uppercase tracking-[0.1em] text-cafe/60">
          Precio
          <input
            type="number" min={1} inputMode="decimal" value={precio} placeholder="Pendiente"
            onChange={(e) => setPrecio(e.target.value)} aria-label={`Precio de ${p.nombre}`}
            className={`${claseCampo} mt-1 block h-9 w-32`}
          />
        </label>
        <label className="text-[0.66rem] uppercase tracking-[0.1em] text-cafe/60">
          Existencias
          <input
            type="number" min={0} inputMode="numeric" value={stock} placeholder="Sin conteo"
            onChange={(e) => setStock(e.target.value)} aria-label={`Existencias de ${p.nombre}`}
            className={`${claseCampo} mt-1 block h-9 w-32`}
          />
        </label>
        <button
          type="button"
          disabled={!cambiado || guardando}
          // Solo lo que cambió: guardar existencias no debe tocar el precio (ni borrar el de ejemplo).
          onClick={() =>
            guardar(
              {
                ...(cambioPrecio ? { precio: precioNum } : {}),
                ...(cambioStock ? { stock: stock.trim() === '' ? null : Number(stock) } : {}),
              },
              `«${p.nombre}» actualizada.`,
            )
          }
          className="min-h-9 rounded-full bg-cafe px-4 text-[0.68rem] font-medium uppercase tracking-[0.1em] text-crema disabled:opacity-30"
        >
          {guardando ? '…' : 'Guardar'}
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={() => guardar({ activa: !p.activa }, p.activa ? `«${p.nombre}» ya no se ofrece.` : `«${p.nombre}» se vuelve a ofrecer.`)}
          className="min-h-9 rounded-full border border-cafe/25 px-4 text-[0.68rem] font-medium uppercase tracking-[0.1em] hover:border-cafe disabled:opacity-40"
        >
          {p.activa ? 'Apagar' : 'Encender'}
        </button>
      </div>
    </li>
  );
}

export default function PanelPiezas() {
  const { datos, error, recargar } = useConsulta('admin:piezas', () => repoAdmin.piezas());
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  return (
    <div className="space-y-6">
      <EncabezadoPanel eyebrow="Pinta tu pieza" titulo="Piezas" />
      <p className="max-w-3xl text-[0.84rem] text-cafe/75">
        El precio de cada pieza define el anticipo ({PORCENTAJE_ANTICIPO} %) que se paga en línea. Sin precio, la pieza aparece como «Precio
        pendiente» y no se puede pagar. Existencias vacías = sin conteo; 0 = agotada. Se descuentan al confirmarse un
        anticipo y vuelven si la reserva se cancela.
      </p>
      {mensaje && <Aviso tipo={mensaje.error ? 'error' : 'exito'}>{mensaje.texto}</Aviso>}
      {!datos && error ? (
        <ErrorCarga onReintentar={recargar} />
      ) : !datos ? (
        <CargandoBloque className="h-80" />
      ) : datos.length === 0 ? (
        <p className="rounded-suave border border-dashed border-cafe/20 p-8 text-center text-nota text-cafe/70">
          Pinta tu pieza todavía no tiene piezas en este backend.
        </p>
      ) : (
        <ul className="space-y-2">
          {datos.map((p) => (
            <FilaPieza
              key={`${p.id}-${p.precio}-${p.stock}-${p.activa}-${p.demo}`}
              pieza={p}
              onGuardado={(texto, error = false) => {
                setMensaje({ texto, error });
                if (!error) recargar();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
