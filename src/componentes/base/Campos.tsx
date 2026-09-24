import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

// ---------------------------------------------------------------------------
// Campos de formulario: línea inferior, etiqueta arriba, error debajo.
// Cada campo tiene <label> real y el error se anuncia con aria-describedby.
// ---------------------------------------------------------------------------

interface Comunes {
  id: string;
  label: string;
  error?: string | null;
  ayuda?: string;
  opcional?: boolean;
}

function Marco({ id, label, error, ayuda, opcional, children }: Comunes & { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="eyebrow mb-2 flex items-baseline justify-between gap-3 text-cafe/70">
        <span>{label}</span>
        {opcional && <span className="text-[0.62rem] normal-case tracking-normal text-cafe/50">Opcional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-center gap-2 text-nota text-cafe" role="alert">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-naranja" aria-hidden="true" />
          {error}
        </p>
      ) : ayuda ? (
        <p id={`${id}-ayuda`} className="mt-2 text-nota text-cafe/60">{ayuda}</p>
      ) : null}
    </div>
  );
}

const linea = (error?: string | null) =>
  `w-full border-0 border-b bg-transparent px-0 pb-2.5 pt-1 text-cuerpo text-cafe outline-none transition-colors duration-rapida placeholder:text-cafe/35 focus:border-cafe focus-visible:outline-none ${
    error ? 'border-naranja' : 'border-cafe/30'
  }`;

function describir(id: string, error?: string | null, ayuda?: string) {
  if (error) return `${id}-error`;
  if (ayuda) return `${id}-ayuda`;
  return undefined;
}

export function Campo({
  id, label, error, ayuda, opcional, className = '', ...props
}: Comunes & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Marco id={id} label={label} error={error} ayuda={ayuda} opcional={opcional}>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describir(id, error, ayuda)}
        className={`${linea(error)} h-11 ${className}`}
        {...props}
      />
    </Marco>
  );
}

export function AreaTexto({
  id, label, error, ayuda, opcional, className = '', ...props
}: Comunes & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Marco id={id} label={label} error={error} ayuda={ayuda} opcional={opcional}>
      <textarea
        id={id}
        name={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describir(id, error, ayuda)}
        className={`${linea(error)} resize-none ${className}`}
        {...props}
      />
    </Marco>
  );
}

export function Selector({
  id, label, error, ayuda, opcional, children, className = '', ...props
}: Comunes & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Marco id={id} label={label} error={error} ayuda={ayuda} opcional={opcional}>
      <div className="relative">
        <select
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describir(id, error, ayuda)}
          className={`${linea(error)} h-11 appearance-none pr-8 ${className}`}
          {...props}
        >
          {children}
        </select>
        <svg className="pointer-events-none absolute right-1 top-3 h-4 w-4 text-cafe/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Marco>
  );
}

/** Casilla de verificación. El consentimiento de novedades siempre va aparte. */
export function Casilla({
  id, children, className = '', ...props
}: { id: string; children: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 text-nota text-cafe/80 ${className}`}>
      <span className="relative mt-0.5 flex h-[1.15rem] w-[1.15rem] shrink-0">
        <input
          id={id}
          name={id}
          type="checkbox"
          className="peer h-full w-full cursor-pointer appearance-none rounded-[0.3rem] border border-cafe/40 bg-transparent transition-colors checked:border-cafe checked:bg-cafe"
          {...props}
        />
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-crema opacity-0 peer-checked:opacity-100"
          fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  );
}

/** Aviso en línea. */
export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'info' | 'exito'; children: ReactNode }) {
  const estilo = {
    error: 'border-naranja/60 bg-naranja/10 text-cafe',
    info: 'border-cafe/20 bg-cafe/[0.04] text-cafe/80',
    exito: 'border-indigo/30 bg-indigo/[0.06] text-indigo',
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-suave border px-4 py-3 text-nota ${estilo}`}>
      {children}
    </div>
  );
}
