import { expect, test, type Page } from '@playwright/test';
import { entrarAlPanel, preparar, sinErrores } from './apoyo';

const TALLER = '/talleres/tazas-de-halloween-03-oct';

/** "11 lugares" del horario de las 4:00 p.m. en el detalle del taller. */
async function lugaresA4pm(page: Page) {
  await page.goto(TALLER);
  const horario = page.getByRole('button', { name: /4:00 p\.m\./ });
  await expect(horario).toBeVisible();
  const texto = await horario.innerText();
  return Number(texto.match(/(\d+) lugar/)?.[1] ?? NaN);
}

async function hastaElPago(page: Page, correo: string) {
  await page.getByRole('button', { name: /4:00 p\.m\./ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: '¿Cuántas personas vienen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Una persona más' }).click();
  await expect(page.getByText('$800 MXN × 2', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('#c-nombre').fill('Clienta E2E');
  await page.locator('#c-telefono').fill('81 1234 5678');
  await page.locator('#c-email').fill(correo);
  await page.locator('#c-password').fill('secreta-e2e');
  await page.getByRole('button', { name: 'Crear cuenta y continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Pago' })).toBeVisible();
  await expect(page.getByText('Pago de demostración')).toBeVisible();
}

test('reserva completa Casa Numa', async ({ page }) => {
  const errores = await preparar(page);
  const antes = await lugaresA4pm(page);

  // 1-3. Inicio → Talleres → Tazas de Halloween
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Talleres' }).click();
  await expect(page).toHaveURL(/\/talleres$/);
  await page.getByRole('link', { name: 'Tazas de Halloween', exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${TALLER}$`));
  // 4-9. Sábado 3 de octubre, 4:00 p.m., 2 personas, datos
  await expect(page.getByText(/sábado 3 de octubre/i).first()).toBeVisible();
  await hastaElPago(page, 'e2e-aprobado@ejemplo.com');
  // Total $1,600, calculado por la reserva (no por la página)
  await expect(page.getByRole('button', { name: /Simular pago aprobado · \$1,600/ })).toBeVisible();

  // 10-12. Pago aprobado → confirmación con folio
  await page.getByRole('button', { name: /Simular pago aprobado/ }).click();
  await expect(page.getByRole('heading', { name: '¡Tu lugar está reservado!' })).toBeVisible();
  const folio = (await page.getByText(/^NUMA-\d{5}$/).first().innerText()).trim();
  expect(folio).toMatch(/^NUMA-\d{5}$/);
  await expect(page.getByText('Pago: Pagado · simulado en la demo')).toBeVisible();

  // 13-14. Mi cuenta
  await page.getByRole('link', { name: 'Ver mis reservas' }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByText(folio)).toBeVisible();

  // 15-17. Panel: buscar el folio y abrir la misma reserva
  await entrarAlPanel(page);
  await page.goto('/admin/reservas');
  await page.getByPlaceholder('Nombre, teléfono, correo o folio').fill(folio);
  await page.getByRole('link', { name: folio }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: folio })).toBeVisible();
  await expect(page.getByText('Clienta E2E').first()).toBeVisible();
  await expect(page.getByText('e2e-aprobado@ejemplo.com').first()).toBeVisible();

  // 18. El cupo bajó en 2
  expect(await lugaresA4pm(page)).toBe(antes - 2);
  sinErrores(errores);
});

test('pago rechazado: no hay reserva confirmada y se puede reintentar', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto(TALLER);
  await hastaElPago(page, 'e2e-rechazado@ejemplo.com');

  await page.getByRole('button', { name: 'Simular pago rechazado' }).click();
  await expect(page.getByText('El pago no pudo completarse.')).toBeVisible();
  await expect(page.getByText('Tu lugar todavía no ha sido confirmado.')).toBeVisible();

  // Mi cuenta: pendiente de pago, sin folio
  await page.goto('/cuenta');
  await expect(page.getByText('Pago en proceso').first()).toBeVisible();
  await expect(page.getByText('Pago · Rechazado').first()).toBeVisible();

  // Volver a intentar: ahora sí se confirma
  await page.goto(TALLER);
  await hastaElPagoConSesion(page);
  await page.getByRole('button', { name: /Simular pago aprobado/ }).click();
  await expect(page.getByRole('heading', { name: '¡Tu lugar está reservado!' })).toBeVisible();
  sinErrores(errores);
});

/** Ya con sesión: el paso de datos solo pide confirmar nombre y WhatsApp. */
async function hastaElPagoConSesion(page: Page) {
  await page.getByRole('button', { name: /4:00 p\.m\./ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar al pago' }).click();
  await expect(page.getByText('Pago de demostración')).toBeVisible();
}

test('el horario elegido sobrevive a recargar la página', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto(TALLER);
  await page.getByRole('button', { name: /4:00 p\.m\./ }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /4:00 p\.m\./ })).toHaveAttribute('aria-pressed', 'true');
  sinErrores(errores);
});
