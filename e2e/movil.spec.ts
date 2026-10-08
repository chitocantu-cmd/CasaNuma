import { devices, expect, test } from '@playwright/test';
import { preparar, sinErrores } from './apoyo';

// Celular de verdad: pantalla táctil y toques (tap), no clics de escritorio.
// defaultBrowserType no se puede fijar dentro de un archivo: se queda Chrome.
const { defaultBrowserType: _navegador, ...telefono } = devices['Pixel 7'];
test.use(telefono);

test('menú móvil con red lenta: se cierra al tocar y la página llega después', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Desde aquí, cada página tarda 3 s en descargarse (como con datos móviles).
  await page.route(/\/src\/paginas\/|\/assets\/.*\.js$/, async (r) => {
    await new Promise((listo) => setTimeout(listo, 3000));
    await r.continue();
  });

  await page.getByRole('button', { name: 'Abrir menú' }).tap();
  const menu = page.getByRole('dialog', { name: 'Menú' });
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: /Talleres/ }).tap();

  // Antes de que llegue la página: el menú ya no tapa nada y el encabezado sigue.
  await expect(menu).toBeHidden({ timeout: 2000 });
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
  await expect(page.getByRole('status').getByText('Cargando…')).toBeAttached();

  await expect(page.getByRole('heading', { level: 1, name: /Cada fin de semana/ })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');

  // Y se puede volver a usar.
  await page.getByRole('button', { name: 'Abrir menú' }).tap();
  await menu.getByRole('link', { name: /Nosotras/ }).tap();
  await expect(page).toHaveURL(/\/nosotras$/);
  await expect(menu).toBeHidden();
  sinErrores(errores);
});

test('«Reservar» se cierra al tocar fuera del panel', async ({ page }) => {
  const errores = await preparar(page);
  // Como Safari en iPhone: tocar algo que no es enlace ni botón no genera mousedown.
  await page.addInitScript(() => {
    window.addEventListener('mousedown', (e) => {
      if (!(e.target as Element).closest?.('a, button')) e.stopImmediatePropagation();
    }, true);
  });
  await page.goto('/');
  const reservar = page.getByRole('banner').getByRole('button', { name: 'Reservar' });
  await reservar.tap();
  const opcion = page.getByRole('link', { name: /^Clases de fin de semana Elige taller/ });
  await expect(opcion).toBeVisible();
  // Un toque en una zona sin enlaces, debajo del panel (en iPhone no genera
  // mousedown). Se comprueba primero que ahí no haya nada que se pueda tocar.
  const libre = await page.evaluate(() => !document.elementFromPoint(206, 700)?.closest('a, button, [role=dialog]'));
  expect(libre).toBe(true);
  await page.touchscreen.tap(206, 700);
  await expect(opcion).toBeHidden();
  await expect(page).toHaveURL(/\/$/);

  await reservar.tap();
  await opcion.tap();
  await expect(page).toHaveURL(/\/talleres$/);
  await expect(opcion).toBeHidden();
  sinErrores(errores);
});

test('reserva de taller a puro toque: la barra inferior avanza cada paso', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto('/talleres/tazas-de-halloween-03-oct');
  const barra = page.locator('div.fixed.bottom-0');
  await page.getByRole('button', { name: /4:00 p\.m\./ }).first().tap();
  await barra.getByRole('button', { name: 'Continuar' }).tap();
  await expect(page.getByRole('heading', { name: '¿Cuántas personas vienen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Una persona más' }).tap();
  await barra.getByRole('button', { name: 'Continuar' }).tap();
  await expect(page.locator('#c-nombre')).toBeVisible();
  sinErrores(errores);
});
