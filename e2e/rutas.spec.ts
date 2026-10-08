import { expect, test } from '@playwright/test';
import { AGENDA } from '../src/datos/agenda';
import { PRODUCTOS_SEMILLA } from '../src/datos/demo/semilla';
import { preparar, sinErrores } from './apoyo';

const PUBLICAS = [
  '/', '/talleres', '/membresia', '/membresia/reservar', '/numa-kids', '/numa-kids/reservar', '/pinta-tu-pieza', '/pinta-tu-pieza/reservar', '/eventos',
  '/numa-store', '/nosotras', '/cuenta/entrar', '/cuenta/registro', '/cuenta/recuperar',
  '/aviso-de-privacidad', '/terminos', '/politica-de-reservaciones', '/pago/exitoso', '/pago/cancelado',
  ...AGENDA.filter((a) => a.is_active).map((a) => `/talleres/${a.slug}`),
  ...PRODUCTOS_SEMILLA.map((p) => `/numa-store/${p.slug}`),
];

test('todas las rutas públicas muestran contenido propio', async ({ page }) => {
  const errores = await preparar(page);
  for (const ruta of PUBLICAS) {
    await page.goto(ruta);
    const h1 = page.getByRole('heading', { level: 1 }).first();
    await expect(h1, ruta).toBeVisible();
    await expect(page.getByText('Algo salió mal.'), ruta).toHaveCount(0);
    await expect(page, ruta).not.toHaveTitle(/no encontrada/i);
    expect(await page.title(), ruta).not.toMatch(/^(Vite|Casa Numa)$/);
  }
  sinErrores(errores);
});

test('direcciones comunes llevan a su página', async ({ page }) => {
  const errores = await preparar(page);
  const casos: [string, RegExp][] = [
    ['/store', /\/numa-store$/],
    ['/store/taza-con-carita', /\/numa-store\/taza-con-carita$/],
    ['/tienda', /\/numa-store$/],
    ['/login', /\/cuenta\/entrar/],
    ['/registro', /\/cuenta\/registro$/],
    ['/recuperar-password', /\/cuenta\/recuperar$/],
    ['/mi-cuenta', /\/cuenta\/entrar/],
    ['/kids', /\/numa-kids$/],
    ['/pinta', /\/pinta-tu-pieza$/],
    ['/checkout', /\/talleres$/],
    ['/ubicacion', /\/#ubicacion$/],
    ['/admin/login', /\/admin\/entrar$/],
  ];
  for (const [de, a] of casos) {
    await page.goto(de);
    await expect(page, de).toHaveURL(a);
  }
  sinErrores(errores);
});

test('una ruta que no existe muestra el 404 de Casa Numa', async ({ page }) => {
  await preparar(page);
  await page.goto('/esta-ruta-no-existe');
  await expect(page.getByRole('heading', { name: 'Esta pieza todavía no existe.' })).toBeVisible();
  await expect(page.getByText('404')).toBeVisible();
  await page.getByRole('link', { name: 'Ver talleres' }).click();
  await expect(page).toHaveURL(/\/talleres$/);
});

test('el panel está protegido: sin sesión y con cuenta de clienta no entra', async ({ page }) => {
  const errores = await preparar(page);
  for (const ruta of ['/admin', '/admin/reservas', '/admin/talleres', '/admin/reservas/xyz']) {
    await page.goto(ruta);
    await expect(page, ruta).toHaveURL(/\/admin\/entrar$/);
  }
  await page.locator('#p-email').fill('ana@demo.casanuma.mx');
  await page.locator('#p-pass').fill('numa2026');
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.getByText('Esta cuenta no tiene acceso al panel.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/entrar$/);
  sinErrores(errores);
});

test('Mi cuenta sin sesión pide entrar y regresa a donde iba', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto('/cuenta');
  await expect(page).toHaveURL(/\/cuenta\/entrar$/);
  await page.locator('#a-email').fill('ana@demo.casanuma.mx');
  await page.locator('#a-password').fill('numa2026');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible();
  sinErrores(errores);
});

test('ningún enlace interno termina en 404 o en una página vacía', async ({ page }) => {
  const errores = await preparar(page);
  const porVisitar = new Set<string>();
  for (const origen of ['/', '/talleres', '/numa-store', '/eventos', '/nosotras', '/membresia', '/numa-kids']) {
    await page.goto(origen);
    // La demo tarda unos cientos de milisegundos en traer talleres y piezas.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
    for (const href of await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
      porVisitar.add(href.split('#')[0].split('?')[0] || '/');
    }
  }
  expect(porVisitar.size).toBeGreaterThan(20);
  for (const ruta of porVisitar) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page, ruta).not.toHaveTitle(/no encontrada/i);
    await expect(page.getByText('Algo salió mal.'), ruta).toHaveCount(0);
    const texto = (await page.locator('main').first().innerText()).trim();
    expect(texto.length, `${ruta} sin contenido`).toBeGreaterThan(40);
  }
  sinErrores(errores);
});

test('ningún enlace con href vacío o "#"', async ({ page }) => {
  await preparar(page);
  for (const ruta of ['/', '/talleres', '/eventos', '/numa-store', '/nosotras', '/membresia', '/numa-kids', '/cuenta/entrar']) {
    await page.goto(ruta);
    const malos = await page.locator('a').evaluateAll((as) =>
      as.filter((a) => { const h = a.getAttribute('href'); return !h || h === '#' || h.startsWith('javascript:'); }).map((a) => a.outerHTML.slice(0, 80)));
    expect(malos, ruta).toEqual([]);
  }
});
