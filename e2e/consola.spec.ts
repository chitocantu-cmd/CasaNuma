import { expect, test, type Page } from '@playwright/test';
import { entrarAlPanel, preparar } from './apoyo';

// Consola limpia y red tranquila en modo demo: sin advertencias de React, sin
// recursos rotos y sin una sola petición a Supabase (la demo no lo necesita).
// En las páginas públicas tampoco se ve NaN, undefined, null ni $0.

const PUBLICAS = [
  '/', '/talleres', '/talleres/tazas-de-halloween-03-oct', '/talleres/tardes-de-ceramica-adultos-01-oct', '/pinta-tu-pieza',
  '/pinta-tu-pieza/reservar', '/membresia', '/membresia/reservar', '/numa-kids', '/numa-kids/reservar', '/eventos',
  '/numa-store', '/numa-store/vasija-con-rostro', '/nosotras', '/cuenta/entrar', '/cuenta/registro', '/cuenta/recuperar',
  '/aviso-de-privacidad', '/terminos', '/politica-de-reservaciones', '/esta-ruta-no-existe',
];
const PANEL = [
  '/admin', '/admin/reservas', '/admin/reservas/nueva', '/admin/calendario', '/admin/talleres', '/admin/piezas',
  '/admin/membresias', '/admin/clientes', '/admin/pagos', '/admin/avisos',
];

function vigilar(page: Page) {
  const avisos: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') avisos.push(`${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => avisos.push(`JS: ${e.message}`));
  page.on('request', (r) => {
    if (/supabase\.co|\/rest\/v1\/|\/functions\/v1\//.test(r.url())) avisos.push(`petición a Supabase en demo: ${r.url().slice(0, 120)}`);
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.hostname === 'localhost' && r.status() >= 400) avisos.push(`HTTP ${r.status()}: ${u.pathname}`);
  });
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    // Las fuentes de Google y los mapas se cortan al navegar rápido: no son del sitio.
    if (u.hostname === 'localhost') avisos.push(`falló: ${u.pathname} (${r.failure()?.errorText})`);
  });
  return avisos;
}

async function recorrer(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 800) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
  });
  await page.waitForTimeout(300);
  return page.locator('body').innerText();
}

test('sitio público: consola limpia, sin Supabase en demo y sin NaN / undefined / null / $0', async ({ page }) => {
  test.setTimeout(240_000);
  await preparar(page);
  const avisos = vigilar(page);
  const textosMalos: string[] = [];
  for (const ruta of PUBLICAS) {
    const texto = await recorrer(page, ruta);
    const malo = texto.match(/\bNaN\b|\bundefined\b|\bnull\b|\$\s?0(?![\d,.])|\$NaN/);
    if (malo) textosMalos.push(`${ruta}: «${malo[0]}»`);
  }
  expect(textosMalos).toEqual([]);
  expect(avisos).toEqual([]);
});

test('panel: consola limpia y sin Supabase en demo', async ({ page }) => {
  test.setTimeout(240_000);
  await preparar(page);
  const avisos = vigilar(page);
  await entrarAlPanel(page);
  for (const ruta of PANEL) {
    const texto = await recorrer(page, ruta);
    expect(texto, ruta).not.toMatch(/\bNaN\b|\bundefined\b|\$NaN/);
  }
  // Una reserva de ejemplo abierta, con sus acciones.
  await page.goto('/admin/reservas');
  await page.getByRole('link', { name: /^NUMA-\d{5}$/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(avisos).toEqual([]);
});
