import { expect, test, type Page } from '@playwright/test';
import { entrarAlPanel, preparar, sinErrores } from './apoyo';

// Revisión de cada elemento interactivo de la página: nada decorativo.
const PUBLICAS = [
  '/', '/talleres', '/talleres/tazas-de-halloween-03-oct', '/talleres/tardes-de-ceramica-adultos-01-oct', '/membresia',
  '/membresia/reservar', '/numa-kids', '/numa-kids/reservar', '/eventos', '/numa-store', '/numa-store/vasija-con-rostro',
  '/nosotras', '/cuenta/entrar', '/cuenta/registro', '/cuenta/recuperar', '/aviso-de-privacidad', '/pago/cancelado',
  '/esta-ruta-no-existe',
];
const PANEL = ['/admin', '/admin/reservas', '/admin/reservas/nueva', '/admin/calendario', '/admin/talleres', '/admin/piezas', '/admin/membresias', '/admin/clientes', '/admin/pagos', '/admin/avisos'];

async function revisar(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState('networkidle');
  // Bajar la página: cargan las fotos diferidas.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const props = (el: Element) => {
      const k = Object.keys(el).find((x) => x.startsWith('__reactProps$'));
      return (k ? (el as unknown as Record<string, Record<string, unknown>>)[k] : {}) as Record<string, unknown>;
    };
    const botonesMuertos = [...document.querySelectorAll('button')]
      .filter((b) => {
        const p = props(b);
        const envia = (b.getAttribute('type') ?? 'submit') === 'submit' && b.closest('form');
        return !p.onClick && !envia && !b.disabled;
      })
      .map((b) => (b.innerText || b.getAttribute('aria-label') || '').slice(0, 60));
    // El clic sube: basta un manejador en el elemento o en un contenedor (fila de tabla, etc.).
    const conAccion = (el: Element | null): boolean => {
      for (let x = el; x; x = x.parentElement) if (props(x).onClick) return true;
      return false;
    };
    const clicSinAccion = [...document.querySelectorAll('div,article,li,span,figure,img')]
      .filter((el) => getComputedStyle(el).cursor === 'pointer' && !el.closest('a,button,label,summary,[role=button]') && !conAccion(el))
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}`);
    const imagenesRotas = [...document.querySelectorAll('img')]
      .filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src'))
      .map((i) => i.getAttribute('src'));
    const sinAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map((i) => i.getAttribute('src'));
    const camposSinEtiqueta = [...document.querySelectorAll('input,select,textarea')]
      .filter((i) => (i as HTMLInputElement).type !== 'hidden' && !i.getAttribute('aria-label')
        && !(i.id && document.querySelector(`label[for="${i.id}"]`)) && !i.closest('label'))
      .map((i) => i.id || (i as HTMLInputElement).name || i.tagName);
    const h1 = document.querySelectorAll('h1').length;
    return { botonesMuertos, clicSinAccion, imagenesRotas, sinAlt, camposSinEtiqueta, h1 };
  });
}

function sinHallazgos(ruta: string, r: Awaited<ReturnType<typeof revisar>>) {
  expect(r.botonesMuertos, `${ruta}: botones sin acción`).toEqual([]);
  expect(r.clicSinAccion, `${ruta}: parece clicable y no hace nada`).toEqual([]);
  expect(r.imagenesRotas, `${ruta}: imágenes rotas`).toEqual([]);
  expect(r.sinAlt, `${ruta}: imágenes sin alt`).toEqual([]);
  expect(r.camposSinEtiqueta, `${ruta}: campos sin etiqueta`).toEqual([]);
  expect(r.h1, `${ruta}: un solo h1`).toBe(1);
}

test('sitio público: todo lo interactivo hace algo, sin imágenes rotas ni campos sin etiqueta', async ({ page }) => {
  test.setTimeout(240_000);
  const errores = await preparar(page);
  for (const ruta of PUBLICAS) sinHallazgos(ruta, await revisar(page, ruta));
  sinErrores(errores);
});

test('panel: todo lo interactivo hace algo', async ({ page }) => {
  test.setTimeout(240_000);
  const errores = await preparar(page);
  await entrarAlPanel(page);
  for (const ruta of PANEL) sinHallazgos(ruta, await revisar(page, ruta));
  sinErrores(errores);
});
