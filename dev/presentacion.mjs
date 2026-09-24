// ===========================================================================
// Presentación en un solo archivo
// ---------------------------------------------------------------------------
//   npm run presentacion [-- "ruta/de/salida.html"]
//
// Genera un .html autónomo del sitio en modo demo para enseñarlo sin subirlo
// a ningún lado: se abre con doble clic, sin servidor. Lleva adentro el
// JavaScript, los estilos y las fotos de referencia; solo las tipografías
// llegan de Google Fonts (sin internet se ve con tipografías del sistema).
//
// Diferencias con el sitio normal:
//   · rutas con # (HashRouter), porque file:// no tiene servidor;
//   · sin panel ni páginas de pago con Stripe (necesitan Supabase);
//   · notas de "pendiente" y fotos de referencia visibles.
// ===========================================================================

import { build } from 'vite';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporal = join(raiz, 'presentacion', '.build');
const salida = resolve(process.argv[2] ?? join(raiz, 'presentacion', 'casa-numa-demo.html'));

// Vite da prioridad a las variables que ya existen en el proceso.
Object.assign(process.env, {
  VITE_ROUTER: 'hash',
  VITE_SIN_BACKEND: 'true',
  VITE_MOSTRAR_PENDIENTES: 'true',
  VITE_FUENTE_DATOS: 'demo',
});

await build({
  root: raiz,
  base: './',
  mode: 'presentacion',
  logLevel: 'warn',
  build: {
    outDir: temporal,
    emptyOutDir: true,
    copyPublicDir: false,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

// --- Imágenes que usa el sitio, como data: URIs -----------------------------
const publico = join(raiz, 'public');
const dataUri = (ruta, tipo) => `data:${tipo};base64,${readFileSync(join(publico, ruta)).toString('base64')}`;

// Foto.tsx usa el segundo tamaño de cada foto (1280, o 810 en jarrones):
// referencias del brandbook y fotos reales de /fotos/talleres.
const recursos = {};
for (const carpeta of ['referencia', 'talleres']) {
  const porFoto = new Map();
  for (const archivo of readdirSync(join(publico, 'fotos', carpeta))) {
    const [, nombre, ancho] = archivo.match(/^(.+)-(\d+)\.webp$/) ?? [];
    if (nombre) porFoto.set(nombre, [...(porFoto.get(nombre) ?? []), Number(ancho)].sort((a, b) => a - b));
  }
  for (const [nombre, anchos] of porFoto) {
    const ruta = `/fotos/${carpeta}/${nombre}-${anchos[Math.min(1, anchos.length - 1)]}.webp`;
    recursos[ruta] = dataUri(ruta.slice(1), 'image/webp');
  }
}
const lino = dataUri('texturas/lino.webp', 'image/webp');
recursos['/texturas/lino.webp'] = lino;

// --- Todo dentro del HTML -----------------------------------------------------
const assets = join(temporal, 'assets');
const js = readdirSync(assets).filter((f) => f.endsWith('.js'));
const css = readdirSync(assets).filter((f) => f.endsWith('.css'));
if (js.length !== 1 || css.length !== 1) {
  throw new Error(`Se esperaba un solo .js y un solo .css, hay ${js.length} y ${css.length}`);
}

// Un "</script" dentro del código cerraría la etiqueta antes de tiempo.
const codigo = readFileSync(join(assets, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const estilos = readFileSync(join(assets, css[0]), 'utf8').replace(
  /url\((['"]?)[./]*texturas\/lino\.webp\1\)/g,
  () => `url("${lino}")`,
);
const favicon = `data:image/svg+xml;base64,${readFileSync(join(publico, 'favicon.svg')).toString('base64')}`;

let html = readFileSync(join(temporal, 'index.html'), 'utf8');
// Siempre con funciones de reemplazo: el código minificado trae "$&" y "$1".
html = html
  .replace(/<script type="module"[^>]*src="[^"]+"><\/script>\s*/, () => '')
  .replace(/<link rel="stylesheet"[^>]*href="[^"]+">\s*/, () => '')
  .replace(/href="[^"]*favicon\.svg"/, () => `href="${favicon}"`)
  .replace('</head>', () => `<style>${estilos}</style>\n</head>`)
  .replace(
    '</body>',
    () =>
      `<script>window.__NUMA_RECURSOS__=${JSON.stringify(recursos)};</script>\n` +
      `<script type="module">${codigo}</script>\n</body>`,
  );

mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, html);
console.log(`Listo: ${salida} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB)`);
