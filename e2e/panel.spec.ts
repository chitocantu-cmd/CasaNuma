import { expect, test } from '@playwright/test';
import { entrarAlPanel, preparar, sinErrores } from './apoyo';

const PANTALLAS = [
  '/admin', '/admin/reservas', '/admin/reservas/nueva', '/admin/calendario', '/admin/talleres',
  '/admin/membresias', '/admin/piezas', '/admin/clientes', '/admin/pagos', '/admin/avisos',
];

test('cada pantalla del panel carga sin undefined, NaN ni null a la vista', async ({ page }) => {
  const errores = await preparar(page);
  await entrarAlPanel(page);
  for (const ruta of PANTALLAS) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1 }), ruta).toBeVisible();
    const texto = await page.locator('main').innerText();
    expect(texto, ruta).not.toMatch(/\b(undefined|NaN|null)\b|\$undefined|\[object Object\]/);
  }
  sinErrores(errores);
});

test('Avisos dice con honestidad qué está simulado y qué falta conectar', async ({ page }) => {
  await preparar(page);
  await entrarAlPanel(page);
  await page.goto('/admin/avisos');
  await expect(page.getByText('Google Calendar', { exact: true })).toBeVisible();
  await expect(page.getByText('Simulado (demo)').first()).toBeVisible();
});

test('el equipo crea un taller, lo edita, lo desactiva y el sitio lo refleja', async ({ page }) => {
  const errores = await preparar(page);
  await entrarAlPanel(page);
  await page.goto('/admin/talleres');
  await page.getByRole('button', { name: 'Nuevo taller' }).click();
  const form = page.getByRole('dialog', { name: 'Nuevo taller' });
  await expect(form).toBeVisible();

  // Sin nombre no guarda y lo dice.
  await form.getByRole('button', { name: 'Crear taller' }).click();
  await expect(form.getByText('Escribe el nombre del taller.')).toBeVisible();

  await form.getByLabel('Nombre').fill('Tazas de otoño E2E');
  await form.getByLabel('Descripción corta').fill('Crea tu taza de temporada con colores de otoño.');
  await form.getByLabel('Categoría').selectOption('temporada');
  await form.getByLabel('Precio por persona (MXN)').fill('750');
  await form.getByLabel('Fecha').fill('2026-11-14');
  await form.getByLabel('Cupo por horario').fill('10');
  // Doble clic: un solo taller.
  await form.getByRole('button', { name: 'Crear taller' }).dblclick();
  await expect(page.getByText('«Tazas de otoño E2E» ya está en la agenda del sitio.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // En el sitio
  await page.goto('/talleres');
  await expect(page.getByRole('link', { name: 'Tazas de otoño E2E', exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: 'Tazas de otoño E2E', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tazas de otoño E2E' })).toBeVisible();
  await expect(page.getByText('$750 MXN').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /11:00 a\.m\..*10 lugares/ })).toBeVisible();

  // Editar
  await page.goto('/admin/talleres');
  const fila = page.getByRole('listitem').filter({ hasText: 'Tazas de otoño E2E' });
  await fila.getByRole('button', { name: 'Editar' }).click();
  const edicion = page.getByRole('dialog', { name: 'Editar taller' });
  await edicion.getByLabel('Nombre').fill('Tazas de otoño E2E (edición)');
  await edicion.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Guardamos los cambios de «Tazas de otoño E2E (edición)».')).toBeVisible();

  // Desactivar: ya no se ve en el sitio
  await page.getByRole('listitem').filter({ hasText: 'Tazas de otoño E2E (edición)' }).getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByText('«Tazas de otoño E2E (edición)» ya no se muestra en el sitio.')).toBeVisible();
  await page.goto('/talleres');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('link', { name: /Tazas de otoño E2E/ })).toHaveCount(0);
  sinErrores(errores);
});

test('reserva registrada por el equipo, pago recibido y nota interna', async ({ page }) => {
  const errores = await preparar(page);
  await entrarAlPanel(page);
  await page.goto('/admin/reservas/nueva');
  const sesion = page.locator('#n-sesion');
  const valor = await sesion.locator('option', { hasText: 'Tazas de Halloween + Pan de Muerto' }).first().getAttribute('value');
  await sesion.selectOption(valor ?? '');
  await page.locator('#n-nombre').fill('Clienta Instagram E2E');
  await page.locator('#n-tel').fill('81 5555 0000');
  await page.locator('#n-email').fill('instagram-e2e@ejemplo.com');
  await page.getByRole('button', { name: 'Registrar reserva' }).click();
  await expect(page).toHaveURL(/\/admin\/reservas\/.+/);
  await expect(page.getByRole('heading', { level: 1, name: /^NUMA-\d{5}$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Registrar pago recibido' }).click();
  await expect(page.getByText('Pago registrado: la reserva quedó confirmada.')).toBeVisible();
  await page.getByLabel('Notas internas').fill('Pagó por transferencia (prueba).');
  await page.getByRole('button', { name: 'Guardar nota' }).click();
  await expect(page.getByText('Nota guardada.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Notas internas')).toHaveValue('Pagó por transferencia (prueba).');
  sinErrores(errores);
});
