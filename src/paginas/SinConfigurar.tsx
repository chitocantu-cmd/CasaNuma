/**
 * Pantalla que aparece cuando faltan las variables de Supabase.
 *
 * Es para el equipo, no para clientes: un sitio en producción nunca debe
 * llegar aquí. Existe porque la alternativa —una página en blanco con un error
 * escondido en la consola— es imposible de diagnosticar para quien no
 * programa, y es exactamente lo que pasa al desplegar en Vercel sin configurar
 * las variables de entorno.
 */
export default function SinConfigurar() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-papel px-5 py-20">
      <div className="w-full max-w-lg">
        <p className="dato text-tinta/45">Casa Numa</p>
        <h1 className="mt-3 font-display text-[2.2rem] leading-tight">
          Falta conectar la base de datos
        </h1>
        <p className="mt-4 leading-relaxed text-tinta/70">
          El sitio está desplegado pero todavía no sabe de dónde leer los
          talleres. Hay que darle dos valores.
        </p>

        <div className="mt-8 border border-tinta/15 bg-crema p-6">
          <p className="dato mb-4 text-tinta/50">Dónde encontrarlos</p>
          <p className="text-[0.92rem] leading-relaxed text-tinta/75">
            En Supabase: <strong>Project Settings → API</strong>. Copia
            <em> Project URL</em> y la llave <em>anon public</em>.
          </p>

          <p className="dato mb-2 mt-6 text-tinta/50">Dónde ponerlos</p>
          <p className="text-[0.92rem] leading-relaxed text-tinta/75">
            En local, en un archivo <code className="bg-tinta/8 px-1">.env.local</code>.
            En Vercel, en <strong>Settings → Environment Variables</strong>, y
            volver a desplegar.
          </p>

          <pre className="mt-4 overflow-x-auto border border-tinta/12 bg-papel p-4 text-[0.78rem] leading-relaxed">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
          </pre>

          <p className="mt-4 text-[0.82rem] leading-relaxed text-tinta/55">
            Estas dos son públicas: viajan dentro del sitio y no hay problema.
            La llave <strong>service_role</strong> de esa misma pantalla no va
            aquí nunca — esa solo se carga como secreto de Supabase.
          </p>
        </div>

        <p className="mt-6 text-[0.85rem] leading-relaxed text-tinta/50">
          Si ya pusiste las variables y sigues viendo esto, falta volver a
          desplegar: Vite las incrusta al compilar, no al cargar la página.
        </p>
      </div>
    </div>
  );
}
