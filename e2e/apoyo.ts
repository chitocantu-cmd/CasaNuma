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

/**
 * En el panel, la reserva de ese folio con las mismas cifras que vio la
 * clienta: en la lista (total, pagado, pendiente) y en el detalle.
 */
export async function verificarCifrasPanel(
  page: Page, folio: string, c: { total: string; pagado: string; pendiente: string; personas?: string },
) {
  await page.goto('/admin/reservas');
  await page.getByPlaceholder('Nombre, teléfono, correo o folio').fill(folio);
  const fila = page.getByRole('row').filter({ hasText: folio });
  await expect(fila).toHaveCount(1);
  const celdas = fila.getByRole('cell');
  // Folio, Cliente, Experiencia, Fecha, Hora, Personas, Total, Pagado, Pendiente, Pago, Estado
  if (c.personas) await expect(celdas.nth(5)).toHaveText(c.personas);
  await expect(celdas.nth(6)).toHaveText(c.total);
  await expect(celdas.nth(7)).toHaveText(c.pagado);
  await expect(celdas.nth(8)).toHaveText(c.pendiente);
  await expect(celdas.nth(9)).toHaveText(/Anticipo pagado/i);
  await expect(celdas.nth(10)).toHaveText(/Confirmada/i);
  await fila.getByRole('link', { name: folio }).click();
  await expect(page.getByRole('heading', { level: 1, name: folio })).toBeVisible();
  await expect(page.locator('[data-total-panel]')).toHaveText(`${c.total} MXN`);
  await expect(page.getByText(/^Anticipo recibido \(50 %\)$/).locator('..')).toContainText(`${c.pagado} MXN`);
  await expect(page.locator('[data-saldo-panel]')).toHaveText(`${c.pendiente} MXN`);
  await expect(page.getByRole('button', { name: 'Marcar saldo como pagado' })).toBeVisible();
}

export async function entrarAlPanel(page: Page) {
  await page.goto('/admin/entrar');
  await page.locator('#p-email').fill(CUENTA_DEMO_ADMIN.email);
  await page.locator('#p-pass').fill(CUENTA_DEMO_ADMIN.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/admin(\/)?$/);
}
