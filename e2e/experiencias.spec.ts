import { expect, test, type Page } from '@playwright/test';
import { entrarAlPanel, preparar, sinErrores, verificarCifrasPanel } from './apoyo';

async function crearCuentaEnCheckout(page: Page, correo: string, nombre: string) {
  await page.locator('#c-nombre').fill(nombre);
  await page.locator('#c-telefono').fill('81 2345 6789');
  await page.locator('#c-email').fill(correo);
  await page.locator('#c-password').fill('secreta-e2e');
  await page.getByRole('button', { name: 'Crear cuenta y continuar' }).click();
  await expect(page.getByText('Pago de demostración')).toBeVisible();
}

test('NUMA Kids: $680 total, $340 hoy y $340 de saldo en checkout, confirmación, Mi cuenta y panel', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto('/numa-kids');
  await expect(page.getByText('Reserva tu lugar pagando el 50 %.')).toBeVisible();
  await page.goto('/numa-kids/reservar');
  await page.getByRole('button', { name: /Jueves 1 de octubre/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('#nino-0').fill('Leo');
  await page.locator('#edad-0').fill('8');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText(/10 a 14 años/).first()).toBeVisible();
  await page.locator('#edad-0').fill('11');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await crearCuentaEnCheckout(page, 'e2e-kids@ejemplo.com', 'Mamá E2E');
  const resumen = page.locator('[data-resumen-pago]');
  await expect(resumen.locator('[data-asistentes]')).toHaveText('Leo (11 años)');
  await expect(resumen.locator('[data-total]')).toHaveText('$680 MXN');
  await expect(resumen.locator('[data-anticipo]')).toHaveText('$340 MXN');
  await expect(resumen.locator('[data-saldo]')).toHaveText('$340 MXN');
  await page.locator('#p-acepto').check();
  await page.getByRole('button', { name: 'Simular pago aprobado · $340 MXN' }).click();

  await expect(page.getByRole('heading', { name: '¡Tu lugar está reservado!' })).toBeVisible();
  const folio = (await page.locator('[data-folio]').innerText()).trim();
  await expect(page.locator('[data-asistentes]')).toHaveText('Leo (11 años)');
  await expect(page.locator('[data-total]')).toHaveText('$680 MXN');
  await expect(page.locator('[data-pagado]')).toHaveText('$340 MXN');
  await expect(page.locator('[data-saldo]')).toHaveText('$340 MXN');

  await page.getByRole('link', { name: 'Ver mis reservas' }).click();
  const fila = page.getByRole('listitem').filter({ hasText: folio });
  await expect(fila.locator('[data-cobro-cuenta] dd')).toHaveText(['$680 MXN', '$340 MXN', '$340 MXN']);

  await entrarAlPanel(page);
  await verificarCifrasPanel(page, folio, { total: '$680', pagado: '$340', pendiente: '$340', personas: '1' });
  await expect(page.getByText('Leo · 11 años')).toBeVisible();
  sinErrores(errores);
});

test('membresía: 4 clases exactas, $1,600 hoy de $3,200, y Mi cuenta y panel con las mismas cifras', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto('/membresia');
  await page.getByRole('link', { name: /Quiero mi membresía/i }).first().click();
  await expect(page).toHaveURL(/\/membresia\/reservar/);
  await page.getByRole('button', { name: 'Continuar' }).click();

  const dias = ['2 de octubre', '9 de octubre', '16 de octubre', '23 de octubre', '30 de octubre'];
  for (const d of dias.slice(0, 4)) await page.getByRole('button', { name: new RegExp(`viernes ${d}`, 'i') }).click();
  await expect(page.getByLabel('4 de 4 clases elegidas')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`viernes ${dias[4]}`, 'i') }).click();
  await expect(page.getByText('Ya elegiste tus 4 clases. Quita una para cambiarla.')).toBeVisible();
  await expect(page.getByLabel('4 de 4 clases elegidas')).toBeVisible();

  await page.getByRole('button', { name: 'Continuar (4/4)' }).click();
  await expect(page.locator('[data-cuenta-membresia]')).toContainText('Reservas pagando el 50 % ($1,600 MXN)');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await crearCuentaEnCheckout(page, 'e2e-membresia@ejemplo.com', 'Alumna E2E');
  const resumen = page.locator('[data-resumen-pago]');
  await expect(resumen.locator('[data-asistentes]')).toHaveText('4 clases');
  await expect(resumen.locator('ol li')).toHaveCount(4);
  await expect(resumen.getByText('Precio mensual')).toBeVisible();
  await expect(resumen.locator('[data-total]')).toHaveText('$3,200 MXN');
  await expect(resumen.locator('[data-anticipo]')).toHaveText('$1,600 MXN');
  await expect(resumen.locator('[data-saldo]')).toHaveText('$1,600 MXN');
  await page.locator('#p-acepto').check();
  await page.getByRole('button', { name: 'Simular pago aprobado · $1,600 MXN' }).click();
  await expect(page.getByRole('heading', { name: '¡Tu lugar está reservado!' })).toBeVisible();
  const folio = (await page.locator('[data-folio]').innerText()).trim();
  await expect(page.locator('[data-pagado]')).toHaveText('$1,600 MXN');
  await expect(page.locator('[data-saldo]')).toHaveText('$1,600 MXN');

  await page.getByRole('link', { name: 'Ver mis reservas' }).click();
  await expect(page.getByText('Membresía octubre').first()).toBeVisible();
  await expect(page.getByText('utilizadas')).toBeVisible();
  await expect(page.getByText('4 clases disponibles, ya con fecha reservada.')).toBeVisible();
  await expect(page.locator('[data-cobro-cuenta] dd')).toHaveText(['$3,200 MXN', '$1,600 MXN', '$1,600 MXN']);

  await entrarAlPanel(page);
  await verificarCifrasPanel(page, folio, { total: '$3,200', pagado: '$1,600', pendiente: '$1,600' });
  await expect(page.getByText(/^[1-4]\/4$/)).toHaveCount(4);
  sinErrores(errores);
});

test('eventos: valida, conserva lo escrito y abre WhatsApp con el mensaje', async ({ page, context }) => {
  const errores = await preparar(page);
  await page.goto('/eventos');
  const enviar = page.getByRole('button', { name: 'Cotizar mi evento por WhatsApp' });
  await enviar.click();
  await expect(page.getByText('Escribe tu nombre.')).toBeVisible();
  await expect(page.getByText('Elige el tipo de evento.')).toBeVisible();
  await expect(page.getByText('Indica cuántas personas, al menos 1.')).toBeVisible();

  await page.locator('#e-nombre').fill('Invitada E2E');
  await page.locator('#e-tipo').selectOption('Cumpleaños');
  await page.locator('#e-personas').fill('10');
  // El chat de WhatsApp se abre en otra pestaña: se intercepta para no salir a internet.
  await context.route('https://wa.me/**', (r) => r.fulfill({ body: 'ok' }));
  const [ventana] = await Promise.all([context.waitForEvent('page'), enviar.click()]);
  expect(ventana.url()).toContain('wa.me/528125945907');
  expect(decodeURIComponent(ventana.url())).toContain('soy Invitada E2E');
  await expect(page.getByText('Abrimos WhatsApp con tu mensaje listo.')).toBeVisible();
  await expect(page.locator('#e-nombre')).toHaveValue('Invitada E2E');
  sinErrores(errores);
});

test('NUMA Store: pieza real con «Comprar por WhatsApp» y el nombre en el mensaje', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto('/numa-store');
  await page.getByRole('link', { name: /Vasija con rostro/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vasija con rostro' })).toBeVisible();
  const href = await page.getByRole('link', { name: 'Comprar por WhatsApp' }).getAttribute('href');
  expect(href).toContain('wa.me/528125945907');
  expect(decodeURIComponent(href ?? '')).toContain('«Vasija con rostro»');
  sinErrores(errores);
});
