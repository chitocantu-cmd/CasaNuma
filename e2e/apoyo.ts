import { expect, type Page } from '@playwright/test';

/** Hoy fijo (25 sep 2026, antes de la agenda de octubre): las pruebas no caducan. */
export const HOY = new Date('2026-09-25T10:00:00-06:00');

export const CUENTA_DEMO_ADMIN = { email: 'equipo@demo.casanuma.mx', password: 'numa-admin' };

/**
 * Prepara la página: reloj fijo, sin el aviso flotante de la demo y con
 * registro de errores de consola y de JavaScript (se revisan al final).
 */
export async function preparar(page: Page) {
  await page.clock.setFixedTime(HOY);
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('numa:aviso-demo', 'oculto');
    } catch {
      /* sin almacenamiento */
    }
  });
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(`JS: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`consola: ${m.text()}`);
  });
  return errores;
}

/** Nada en rojo en la consola durante la prueba. */
export function sinErrores(errores: string[]) {
  expect(errores, errores.join('\n')).toEqual([]);
}

export async function entrarAlPanel(page: Page) {
  await page.goto('/admin/entrar');
  await page.locator('#p-email').fill(CUENTA_DEMO_ADMIN.email);
  await page.locator('#p-pass').fill(CUENTA_DEMO_ADMIN.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/admin(\/)?$/);
}
