import { expect, test, type Page } from '@playwright/test';
import { entrarAlPanel, preparar, sinErrores, verificarCifrasPanel } from './apoyo';

const TALLER = '/talleres/tazas-de-halloween-03-oct';

/** "11 lugares" del horario de las 4:00 p.m. en el detalle del taller. */
async function lugaresA4pm(page: Page) {
  await page.goto(TALLER);
  const horario = page.getByRole('button', { name: /4:00 p\.m\./ });
  await expect(horario).toBeVisible();
  const texto = await horario.innerText();
  return Number(texto.match(/(\d+) lugar/)?.[1] ?? NaN);
}

/** Taller del 3 oct, 4:00 p.m., 2 personas, hasta el resumen y pago. */
async function hastaElPago(page: Page, correo: string) {
  await page.getByRole('button', { name: /4:00 p\.m\./ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: '¿Cuántas personas vienen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Una persona más' }).click();
  // Primero el total (2 × $800) y de él, el 50 %.
  await expect(page.locator('[data-cuenta-personas]')).toHaveText('$800 MXN × 2 = $1,600 MXN · hoy pagas $800 MXN (50 %)');
  const resumen = page.getByRole('complementary', { name: 'Resumen de tu reserva' });
  await expect(resumen.getByText('Hoy pagas', { exact: true })).toBeVisible();
  await expect(resumen.getByText('$1,600 MXN')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('#c-nombre').fill('Clienta E2E');
  await page.locator('#c-telefono').fill('81 1234 5678');
  await page.locator('#c-email').fill(correo);
  await page.locator('#c-password').fill('secreta-e2e');
  await page.getByRole('button', { name: 'Crear cuenta y continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Resumen y pago' })).toBeVisible();
  await expect(page.getByText('Pago de demostración')).toBeVisible();
}

test('reserva completa Casa Numa: taller de 2 personas con anticipo del 50 %', async ({ page }) => {
  const errores = await preparar(page);
  const antes = await lugaresA4pm(page);

  // 1-3. Inicio → Talleres → Tazas de Halloween
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Talleres' }).click();
  await expect(page).toHaveURL(/\/talleres$/);
  await page.getByRole('link', { name: 'Tazas de Halloween', exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${TALLER}$`));
  await expect(page.getByText('Reserva tu lugar pagando el 50 %; el resto se liquida en Casa Numa.')).toBeVisible();
  // 4-10. Sábado 3 de octubre, 4:00 p.m., 2 personas, datos
  await expect(page.getByText(/sábado 3 de octubre/i).first()).toBeVisible();
  await hastaElPago(page, 'e2e-aprobado@ejemplo.com');

  // 7-9. Resumen: total $1,600, hoy $800, saldo $800 (lo calculó la reserva, no la página)
  const resumen = page.locator('[data-resumen-pago]');
  await expect(resumen.getByText('Tazas de Halloween')).toBeVisible();
  await expect(resumen.locator('[data-asistentes]')).toHaveText('2 participantes');
  await expect(resumen.getByText('Precio por persona')).toBeVisible();
  await expect(resumen.locator('[data-total]')).toHaveText('$1,600 MXN');
  await expect(resumen.locator('[data-anticipo]')).toHaveText('$800 MXN');
  await expect(resumen.locator('[data-saldo]')).toHaveText('$800 MXN');
  await expect(resumen.locator('[data-texto-anticipo]')).toHaveText(
    'Tu reservación se confirma con el pago del 50 %: hoy pagarás $800 MXN. El saldo restante de $800 MXN se liquida posteriormente en Casa Numa.',
  );
  await expect(page.locator('[data-monto-cobro]')).toHaveText('$800 MXN');
  await expect(page.getByText('Esto representa el 50 % requerido para confirmar la reservación.')).toBeVisible();
  // Sin aceptar la casilla no se paga; el botón cobra $800, nunca $1,600.
  const pagar = page.getByRole('button', { name: 'Simular pago aprobado · $800 MXN' });
  await expect(pagar).toBeDisabled();
  await expect(page.getByRole('button', { name: /\$1,600/ })).toHaveCount(0);
  await page.getByLabel('Entiendo que hoy pagaré el 50 % y que existe un saldo pendiente por liquidar en Casa Numa.').check();

  // 11-13. Pago demo aprobado (doble clic: una sola reserva) → confirmación con folio
  await pagar.dblclick();
  await expect(page.getByRole('heading', { name: '¡Tu lugar está reservado!' })).toBeVisible();
  const folio = (await page.locator('[data-folio]').innerText()).trim();
  expect(folio).toMatch(/^NUMA-\d{5}$/);
  await expect(page.getByText('Reserva confirmada', { exact: true })).toBeVisible();
  await expect(page.locator('[data-estado-pago]')).toHaveText('Pago del 50 % recibido');
  await expect(page.locator('[data-asistentes]')).toHaveText('2 participantes');
  await expect(page.locator('[data-total]')).toHaveText('$1,600 MXN');
  await expect(page.locator('[data-pagado]')).toHaveText('$800 MXN');
  await expect(page.locator('[data-saldo]')).toHaveText('$800 MXN');
  await expect(page.getByRole('button', { name: 'Agregar a mi calendario' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver a talleres' })).toBeVisible();
  // El correo de demostración dice lo mismo.
  await page.getByText('Ver el correo de confirmación').click();
  await expect(page.locator('[data-correo-demo]')).toContainText('Anticipo pagado (50 %): $800 MXN');

  // 14-15. Mi cuenta: la misma reserva, una sola vez, con total / pagado / pendiente
  await page.getByRole('link', { name: 'Ver mis reservas' }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  const fila = page.getByRole('listitem').filter({ hasText: folio });
  await expect(fila).toHaveCount(1);
  await expect(fila.getByText('2 personas')).toBeVisible();
  await expect(fila.getByText('Confirmada')).toBeVisible();
  await expect(fila.getByText('Pago · Anticipo pagado')).toBeVisible();
  await expect(fila.locator('[data-cobro-cuenta] dd')).toHaveText(['$1,600 MXN', '$800 MXN', '$800 MXN']);

  // 16-20. Panel: el mismo folio con total $1,600, pagado $800, saldo $800
  await entrarAlPanel(page);
  await verificarCifrasPanel(page, folio, { total: '$1,600', pagado: '$800', pendiente: '$800', personas: '2' });

  // El cupo bajó en 2 (no 4: el doble clic no duplicó la reserva)
  expect(await lugaresA4pm(page)).toBe(antes - 2);
  sinErrores(errores);
});

test('pago rechazado: no hay reserva confirmada y se puede reintentar', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto(TALLER);
  await hastaElPago(page, 'e2e-rechazado@ejemplo.com');
  await page.locator('#p-acepto').check();

  await page.getByRole('button', { name: 'Simular pago rechazado' }).click();
  await expect(page.getByText('No pudimos completar el pago.')).toBeVisible();
  await expect(page.getByText('Tu reservación todavía no ha sido confirmada.')).toBeVisible();
  await expect(page.getByText('No se realizó ningún cargo.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Intentar de nuevo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver al taller' })).toBeVisible();

  // Mi cuenta: pendiente de pago, sin folio
  await page.goto('/cuenta');
  await expect(page.getByText('Pago en proceso').first()).toBeVisible();
  await expect(page.getByText('Pago · Rechazado').first()).toBeVisible();
  await expect(page.getByText('Confirmada', { exact: true })).toHaveCount(0);

  // Volver a intentar: ahora sí se confirma
  await page.goto(TALLER);
  await hastaElPagoConSesion(page);
  await page.locator('#p-acepto').check();
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

test('refresh y atrás/adelante después de pagar: nada en blanco y la reserva no se duplica', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto(TALLER);
  await hastaElPago(page, 'e2e-navegacion@ejemplo.com');
  await page.locator('#p-acepto').check();
  await page.getByRole('button', { name: /Simular pago aprobado/ }).click();
  await expect(page.getByRole('heading', { name: '¡Tu lugar está reservado!' })).toBeVisible();
  const folio = (await page.locator('[data-folio]').innerText()).trim();

  // Refresh en la confirmación: vuelve al taller con contenido, sin reservar otra vez.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /Mi cuenta/ }).first().click();
  await expect(page.getByRole('listitem').filter({ hasText: folio })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: folio })).toHaveCount(1);

  // Atrás y adelante: páginas con contenido; sigue habiendo una sola reserva.
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('listitem').filter({ hasText: folio })).toHaveCount(1);

  // Panel con refresh.
  await entrarAlPanel(page);
  await page.goto('/admin/reservas');
  await page.reload();
  await page.getByPlaceholder('Nombre, teléfono, correo o folio').fill(folio);
  await expect(page.getByRole('row').filter({ hasText: folio })).toHaveCount(1);
  sinErrores(errores);
});
