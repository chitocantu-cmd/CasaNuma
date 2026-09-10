import { useEffect, useState } from 'react';
import {
  listarLeadsMembresia, listarLeadsContacto, actualizarLead,
} from '../../services/forms';
import type { MembershipLead, ContactLead, LeadStatus } from '../../tipos';
import { fechaHoraCorta, enlaceWhatsapp } from '../../lib/formato';
import { useTitulo } from '../../features/workshops/hooks';
import { Cargando, Aviso } from '../../componentes/ui';
import { Tabla, Th, Td, Etiqueta } from '../../componentes/tabla';

const ESTADOS: { id: LeadStatus; label: string; tono: string }[] = [
  { id: 'new', label: 'Nuevo', tono: 'aviso' },
  { id: 'contacted', label: 'Contactado', tono: 'neutro' },
  { id: 'converted', label: 'Convertido', tono: 'ok' },
  { id: 'discarded', label: 'Descartado', tono: 'apagado' },
];

type Pestana = 'membresia' | 'contacto';

export default function AdminProspectos() {
  useTitulo('Prospectos · Panel');

  const [pestana, setPestana] = useState<Pestana>('membresia');
  const [membresia, setMembresia] = useState<MembershipLead[]>([]);
  const [contacto, setContacto] = useState<ContactLead[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarLeadsMembresia(), listarLeadsContacto()])
      .then(([m, c]) => { if (vivo) { setMembresia(m); setContacto(c); } })
      .catch((e: Error) => { if (vivo) setError(e.message); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  async function cambiarEstado(
    tabla: 'membership_leads' | 'contact_leads',
    id: string,
    status: LeadStatus,
  ) {
    try {
      await actualizarLead(tabla, id, { status });
      if (tabla === 'membership_leads') {
        setMembresia((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
      } else {
        setContacto((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos actualizar el prospecto.');
    }
  }

  if (cargando) return <Cargando texto="Cargando prospectos…" />;

  const nuevos = (ls: { status: LeadStatus }[]) => ls.filter((l) => l.status === 'new').length;

  return (
    <div>
      <h1 className="font-display text-[1.8rem] leading-none">Prospectos</h1>

      {error && <div className="mt-5"><Aviso>{error}</Aviso></div>}

      <div className="mt-6 flex gap-6 border-b border-tinta/12">
        {([
          { id: 'membresia' as const, label: 'Membresía', n: nuevos(membresia) },
          { id: 'contacto' as const, label: 'Contacto', n: nuevos(contacto) },
        ]).map((p) => (
          <button key={p.id} onClick={() => setPestana(p.id)}
            className={`dato border-b-2 pb-3 transition-colors ${
              pestana === p.id ? 'border-terracota text-terracota'
                : 'border-transparent text-tinta/55 hover:text-tinta'
            }`}>
            {p.label}
            {p.n > 0 && (
              <span className="ml-2 rounded-full bg-terracota px-1.5 py-0.5 text-[0.65rem] text-crema">
                {p.n}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <Tabla min="58rem">
          <thead>
            <tr>
              <Th>Fecha</Th><Th>Nombre</Th><Th>Contacto</Th>
              {pestana === 'membresia' && <Th>Le interesa</Th>}
              <Th>Mensaje</Th><Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {(pestana === 'membresia' ? membresia : contacto).map((l) => {
              const wa = enlaceWhatsapp(l.phone);
              const tabla = pestana === 'membresia' ? 'membership_leads' : 'contact_leads';
              return (
                <tr key={l.id}>
                  <Td className="text-[0.8rem] text-tinta/55">{fechaHoraCorta(l.created_at)}</Td>
                  <Td>{l.name}</Td>
                  <Td className="text-[0.82rem]">
                    <a href={`mailto:${l.email}`} className="text-terracota hover:underline">
                      {l.email}
                    </a>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer"
                        className="mt-1 block text-tinta/60 hover:text-terracota">
                        {l.phone} · WhatsApp
                      </a>
                    )}
                  </Td>
                  {pestana === 'membresia' && (
                    <Td className="text-[0.82rem] text-tinta/60">
                      {(l as MembershipLead).interests?.join(', ') || '—'}
                    </Td>
                  )}
                  <Td className="max-w-[26rem] whitespace-pre-wrap text-[0.85rem] text-tinta/70">
                    {l.message || '—'}
                  </Td>
                  <Td>
                    <select
                      value={l.status}
                      onChange={(e) => cambiarEstado(tabla, l.id, e.target.value as LeadStatus)}
                      aria-label={`Estado de ${l.name}`}
                      className="border border-tinta/20 bg-transparent px-2 py-1 text-[0.8rem] outline-none focus:border-terracota"
                    >
                      {ESTADOS.map((e) => (
                        <option key={e.id} value={e.id}>{e.label}</option>
                      ))}
                    </select>
                    <div className="mt-1">
                      <Etiqueta tono={ESTADOS.find((e) => e.id === l.status)?.tono}>
                        {ESTADOS.find((e) => e.id === l.status)?.label}
                      </Etiqueta>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>

        {(pestana === 'membresia' ? membresia : contacto).length === 0 && (
          <p className="mt-6 text-tinta/55">Todavía no hay prospectos aquí.</p>
        )}
      </div>
    </div>
  );
}
