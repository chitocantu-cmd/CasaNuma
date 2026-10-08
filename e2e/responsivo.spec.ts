import { expect, test } from '@playwright/test';
import { entrarAlPanel, preparar, sinErrores } from './apoyo';

const ANCHOS = [320, 375, 390, 430, 768, 1024, 1440];
const RUTAS = [
  '/', '/talleres', '/talleres/tazas-de-halloween-03-oct', '/membresia', '/membresia/reservar', '/numa-kids',
  '/numa-kids/reservar', '/pinta-tu-pieza', '/pinta-tu-pieza/reservar', '/eventos', '/numa-store', '/numa-store/vasija-con-rostro', '/nosotras', '/cuenta/entrar',
  '/esta-ruta-no-existe', '/admin/entrar',
];

test('sin desborde horizontal de 320 a 1440 px', async ({ page }) => {
  test.setTimeout(300_000);
  const errores = await preparar(page);
  const desbordes: string[] = [];
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 900 });
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');
      const { scroll, vista } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, vista: window.innerWidth }));
      if (scroll > vista + 1) desbordes.push(`${ancho}px ${ruta}: ${scroll} > ${vista}`);
    }
  }
  expect(desbordes).toEqual([]);
  sinErrores(errores);
});

test('panel sin desborde en celular y tableta', async ({ page }) => {
  const errores = await preparar(page);
  await entrarAlPanel(page);
  const desbordes: string[] = [];
  for (const ancho of [375, 768]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    for (const ruta of ['/admin', '/admin/reservas', '/admin/calendario', '/admin/talleres', '/admin/piezas', '/admin/membresias', '/admin/clientes', '/admin/pagos', '/admin/avisos']) {
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');
      const { scroll, vista } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, vista: window.innerWidth }));
      if (scroll > vista + 1) desbordes.push(`${ancho}px ${ruta}: ${scroll} > ${vista}`);
    }
  }
  expect(desbordes).toEqual([]);
  sinErrores(errores);
});

test('menú móvil: abre, cierra con Esc, bloquea el scroll y navega', async ({ page }) => {
  const errores = await preparar(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const abrir = page.getByRole('button', { name: 'Abrir menú' });
  await abrir.click();
  const menu = page.getByRole('dialog', { name: 'Menú' });
  await expect(menu).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');

  await abrir.click();
  await menu.getByRole('link', { name: /Talleres/ }).click();
  await expect(page).toHaveURL(/\/talleres$/);
  await expect(menu).toBeHidden();
  sinErrores(errores);
});

test('portafolio: visor con anterior, siguiente, flechas y Esc', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto('/');
  const primera = page.getByRole('button', { name: 'Ver pieza: Vasija con rostro' });
  await primera.click();
  const visor = page.getByRole('dialog', { name: 'Vasija con rostro' });
  await expect(visor).toBeVisible();
  await expect(visor.getByText('1 / 7')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Taza con carita' })).toBeVisible();
  await page.getByRole('button', { name: 'Pieza siguiente' }).click();
  await expect(page.getByText('3 / 7')).toBeVisible();
  await page.getByRole('button', { name: 'Pieza anterior' }).click();
  await page.getByRole('button', { name: 'Pieza anterior' }).click();
  await expect(page.getByText('1 / 7')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(primera).toBeFocused();
  sinErrores(errores);
});

test('en los modales Tab no se sale del diálogo', async ({ page }) => {
  await preparar(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver pieza: Vasija con rostro' }).click();
  const visor = page.getByRole('dialog');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await visor.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
});
