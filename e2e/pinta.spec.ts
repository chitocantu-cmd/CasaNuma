import { devices, expect, test, type Page } from '@playwright/test';
import { HOY, entrarAlPanel, preparar, sinErrores } from './apoyo';

// Pinta tu pieza de punta a punta (auditoría de la actualización de oct 2026).
// Hoy fijo: viernes 25 sep 2026. Precios de ejemplo de la demo: taza recta
// $300, florero dulce $600, sagrado corazón $900. Para reservar se paga el 50 %.

const RESERVAR = '/pinta-tu-pieza/reservar';

/** Fecha → horario → pieza, desde el principio del flujo. */
async function hastaLaPieza(page: Page, pieza: string, opciones: { dia?: RegExp; hora?: RegExp; tocar?: boolean } = {}) {
  const pulsar = (l: ReturnType<Page['locator']>) => (opciones.tocar ? l.tap() : l.click());
  await pulsar(page.getByRole('button', { name: opciones.dia ?? /sábado 26 de septiembre/ }));
  await expect(page.getByRole('heading', { name: 'Elige tu horario' })).toBeVisible();
  await pulsar(page.getByRole('button', { name: opciones.hora ?? /4:00 p\.m\./ }));
  await pulsar(page.getByRole('button', { name: 'Continuar' }));
  await expect(page.getByRole('heading', { name: '¿Qué quieres pintar?' })).toBeVisible();
  await pulsar(page.getByRole('button', { name: `Elegir: ${pieza}` }));
}

async function datosYResumen(page: Page, correo: string, tocar = false) {
  const pulsar = (l: ReturnType<Page['locator']>) => (tocar ? l.tap() : l.click());
  await pulsar(page.getByRole('button', { name: 'Continuar' }));
  await page.locator('#c-nombre').fill('Clienta Pinta');
  await page.locator('#c-telefono').fill('81 2345 6789');
  await page.locator('#c-email').fill(correo);
  await page.locator('#c-password').fill('secreta-e2e');
  await pulsar(page.getByRole('button', { name: 'Crear cuenta y continuar' }));
  await expect(page.getByRole('heading', { name: 'Tu reservación' })).toBeVisible();
}

async function pagarDemo(page: Page, monto: string, tocar = false) {
  await page.locator('#p-acepto').check();
  const pagar = page.getByRole('button', { name: `Simular pago aprobado · ${monto}` });
  await (tocar ? pagar.tap() : pagar.click());
  await expect(page.getByRole('heading', { name: '¡Tu lugar está reservado!' })).toBeVisible();
  return (await page.getByText(/^NUMA-\d{5}$/).first().innerText()).trim();
}

async function abrirEnPanel(page: Page, folio: string, entrar = true) {
  if (entrar) await entrarAlPanel(page);
  await page.goto('/admin/reservas');
  await page.getByPlaceholder('Nombre, teléfono, correo o folio').fill(folio);
  await page.getByRole('link', { name: folio }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: folio })).toBeVisible();
}

test('se llega desde Inicio, desde la navegación y desde «Reservar»', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto('/');
  const bloque = page.locator('section', { has: page.getByRole('heading', { name: 'Tú eliges la pieza. Tú eliges los colores.' }) });
  await expect(bloque.getByText('Piezas desde $200 MXN.')).toBeVisible();
  await expect(bloque.getByText('Reserva pagando el 50 % del valor de tu pieza.')).toBeVisible();
  await bloque.getByRole('link', { name: 'Quiero pintar' }).click();
  await expect(page).toHaveURL(/\/pinta-tu-pieza$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pinta tu pieza' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Pinta tu pieza' }).click();
  await expect(page).toHaveURL(/\/pinta-tu-pieza$/);

  await page.getByRole('banner').getByRole('button', { name: 'Reservar' }).click();
  await page.getByRole('link', { name: /^Pinta tu pieza Desde \$200 MXN · apartas con el 50 % de tu pieza/ }).click();
  await expect(page).toHaveURL(/\/pinta-tu-pieza\/reservar$/);
  await expect(page.getByRole('heading', { name: '¿Cuándo quieres venir?' })).toBeVisible();
  sinErrores(errores);
});

test('la página explica el 50 % sobre el valor de la pieza, horarios reales y nada de $100 fijos', async ({ page }) => {
  const errores = await preparar(page);
  await page.goto('/pinta-tu-pieza');
  await expect(page.getByText('Experiencia NUMA').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reservar mi lugar' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver cómo funciona' })).toBeVisible();
  for (const paso of ['Elige cuándo venir', 'Elige tu pieza', 'Aparta con el 50 %', 'Ven a crear', 'Liquida el resto']) {
    await expect(page.getByText(paso, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('$200 a $1,200 MXN')).toBeVisible();
  // Ejemplos del cálculo: anticipo = 50 % del valor de la pieza.
  for (const [valor, hoy] of [['$500 MXN', '$250 MXN'], ['$800 MXN', '$400 MXN'], ['$1,200 MXN', '$600 MXN']]) {
    await expect(page.getByRole('row', { name: new RegExp(`^\\${valor} \\${hoy} \\${hoy}$`) })).toBeVisible();
  }
  for (const h of ['7:00 p.m. – 9:00 p.m.', '10:00 a.m.', '11:00 a.m. · 4:00 p.m.']) {
    await expect(page.getByText(h, { exact: true })).toBeVisible();
  }
  // Catálogo: precio y «pagas hoy»; sin precio, no se paga.
  const taza = page.getByRole('article', { name: 'Taza recta' });
  await expect(taza.getByText('$300 MXN')).toBeVisible();
  await expect(taza.getByText('$150 MXN')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Jarra' }).getByText('Precio pendiente').first()).toBeVisible();
  await expect(page.getByRole('article', { name: 'Jarra' }).getByRole('link', { name: /Pintar/ })).toHaveCount(0);

  const texto = await page.locator('body').innerText();
  expect(texto).not.toMatch(/Reserv\w*\s*(con|·)\s*\$100/i);
  expect(texto).not.toMatch(/50\s*%\s*de descuento|mitad de precio|oferta 50/i);
  sinErrores(errores);
});

test('reserva completa: anticipo exacto, confirmación, Mi cuenta y saldo cobrado en el panel', async ({ page }) => {
  test.setTimeout(180_000);
  const errores = await preparar(page);
  await page.goto(RESERVAR);
  // Escritorio: la ruta completa de pasos.
  await expect(page.getByRole('navigation', { name: 'Pasos de la reserva' }).getByRole('listitem')).toHaveText(['1Fecha', '2Horario', '3Pieza', '4Datos', '5Pago']);
  await hastaLaPieza(page, 'Florero dulce');
  const resumen = page.getByRole('complementary', { name: 'Resumen de tu reserva' });
  await expect(resumen.getByText('Hoy pagas', { exact: true })).toBeVisible();
  // Hoy pagas $300 y saldo en Casa Numa $300; precio de la pieza $600.
  await expect(resumen.getByText('$300 MXN', { exact: true })).toHaveCount(2);
  await expect(resumen.getByText('$600 MXN')).toBeVisible();

  // Refresh a la mitad: la selección y el paso se conservan.
  await page.reload();
  await expect(page.getByRole('heading', { name: '¿Qué quieres pintar?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Elegida: Florero dulce' })).toHaveAttribute('aria-pressed', 'true');

  await datosYResumen(page, 'pinta-completa@ejemplo.com');
  await expect(page.locator('[data-anticipo]')).toHaveText('$300 MXN');
  await expect(page.locator('[data-saldo]')).toHaveText('$300 MXN');
  await expect(page.locator('[data-texto-anticipo]')).toHaveText(
    'Hoy pagarás $300 MXN para confirmar tu reservación. El saldo restante de $300 MXN se paga directamente en Casa Numa.',
  );
  await expect(page.locator('[data-monto-cobro]')).toHaveText('$300 MXN');
  // Sin aceptar la casilla no se paga, y se cobra el anticipo, no el total.
  await expect(page.getByRole('button', { name: 'Simular pago aprobado · $300 MXN' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Simular pago aprobado · \$600/ })).toHaveCount(0);
  const folio = await pagarDemo(page, '$300 MXN');

  // Confirmación
  await expect(page.getByText('Pieza: Florero dulce')).toBeVisible();
  await expect(page.locator('[data-saldo]')).toHaveText('$300 MXN');
  await expect(page.getByText('Tu reservación está confirmada. El saldo restante se liquida en Casa Numa.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver mis reservas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agregar a mi calendario' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver al inicio' })).toBeVisible();

  // Mi cuenta: total, anticipo pagado, saldo y folio.
  await page.getByRole('link', { name: 'Ver mis reservas' }).click();
  const fila = page.getByRole('listitem').filter({ hasText: folio });
  await expect(fila.getByText('Pinta tu pieza').first()).toBeVisible();
  await expect(fila.getByText('Confirmada')).toBeVisible();
  await expect(fila.getByText('Pieza: Florero dulce')).toBeVisible();
  await expect(fila.getByRole('definition').nth(0)).toHaveText('$600 MXN');
  await expect(fila.getByRole('definition').nth(1)).toHaveText('$300 MXN');
  await expect(fila.getByRole('definition').nth(2)).toHaveText('$300 MXN');

  // Panel: lista y detalle con lo pagado y lo que falta.
  await entrarAlPanel(page);
  await page.goto('/admin/reservas');
  await page.getByPlaceholder('Nombre, teléfono, correo o folio').fill(folio);
  const renglon = page.getByRole('row').filter({ hasText: folio });
  await expect(renglon.getByText('Florero dulce')).toBeVisible();
  await expect(renglon.getByRole('cell')).toContainText(['Pinta tu pieza', '$600', '$300', '$300', 'Anticipo pagado', 'Confirmada']);
  await renglon.getByRole('link', { name: folio }).click();
  await expect(page.locator('[data-saldo-panel]')).toHaveText('$300 MXN');
  await expect(page.getByText('Anticipo en línea (50 %)')).toBeVisible();

  await page.getByLabel('Cómo pagó el saldo').selectOption('efectivo');
  await page.getByRole('button', { name: 'Marcar saldo como pagado' }).click();
  await expect(page.getByText('Saldo de $300 cobrado: la reserva quedó pagada completa.')).toBeVisible();
  await expect(page.locator('[data-saldo-panel]')).toHaveText('$0 MXN');
  await expect(page.getByText('Pago final en el estudio').locator('..')).toContainText('$300 MXN');
  const movimientos = page.locator('li', { hasText: /Anticipo en línea|Saldo en el estudio/ });
  await expect(movimientos).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Marcar saldo como pagado' })).toHaveCount(0);
  sinErrores(errores);
});

test('cambio de pieza en el estudio: saldo = precio final − ya pagado, y revisión manual si pagó de más', async ({ page }) => {
  test.setTimeout(180_000);
  const errores = await preparar(page);
  await page.goto(RESERVAR);
  await hastaLaPieza(page, 'Taza recta');
  await datosYResumen(page, 'pinta-cambio@ejemplo.com');
  await expect(page.locator('[data-anticipo]')).toHaveText('$150 MXN');
  const folio = await pagarDemo(page, '$150 MXN');

  await abrirEnPanel(page, folio);
  await page.getByLabel('¿Cambió de pieza?').selectOption({ label: 'Florero dulce · $600' });
  await expect(page.locator('[data-vista-cambio]')).toHaveText('Nuevo total $600 · ya pagó $150 · saldo $450');
  await page.getByRole('button', { name: 'Cambiar pieza' }).click();
  await expect(page.getByText('Pieza cambiada a «Florero dulce».')).toBeVisible();
  await expect(page.locator('[data-saldo-panel]')).toHaveText('$450 MXN');
  await expect(page.getByText(/Taza recta \(\$300\) → Florero dulce \(\$600\)/)).toBeVisible();

  // Una pieza más barata que lo ya pagado: el equipo le pone $100 a «Plato».
  await page.goto('/admin/piezas');
  const plato = page.locator('[data-pieza-panel="plato"]');
  await plato.getByLabel('Precio de Plato').fill('100');
  await plato.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('«Plato» actualizada.')).toBeVisible();

  await abrirEnPanel(page, folio, false);
  await page.getByLabel('¿Cambió de pieza?').selectOption({ label: 'Plato · $100' });
  await expect(page.locator('[data-vista-cambio]')).toContainText('REVISIÓN MANUAL REQUERIDA ($50 a su favor)');
  await page.getByRole('button', { name: 'Cambiar pieza' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Revisión manual requerida' })).toBeVisible();
  await expect(page.locator('[data-saldo-panel]')).toHaveText('Revisión');
  await expect(page.getByRole('button', { name: 'Marcar saldo como pagado' })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByText('1 reserva requiere revisión manual')).toBeVisible();
  sinErrores(errores);
});

test('pieza agotada no se puede elegir y la última no se aparta dos veces', async ({ page, context }) => {
  test.setTimeout(180_000);
  const errores = await preparar(page);
  await entrarAlPanel(page);
  await page.goto('/admin/piezas');
  const taza = page.locator('[data-pieza-panel="taza-recta"]');
  await taza.getByLabel('Existencias de Taza recta').fill('0');
  await taza.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('«Taza recta» actualizada.')).toBeVisible();
  const florero = page.locator('[data-pieza-panel="florero-dulce"]');
  await florero.getByLabel('Existencias de Florero dulce').fill('1');
  await florero.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('«Florero dulce» actualizada.')).toBeVisible();

  await page.goto(RESERVAR);
  await hastaLaPieza(page, 'Florero dulce');
  const agotada = page.getByRole('article', { name: 'Taza recta' });
  await expect(agotada.getByText('Agotada').first()).toBeVisible();
  await expect(agotada.getByRole('button', { name: /Elegir/ })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Florero dulce' }).getByText('Queda 1')).toBeVisible();
  await datosYResumen(page, 'pinta-ultima@ejemplo.com');

  // Mientras paga, otra pestaña ve la última pieza apartada.
  const otra = await context.newPage();
  await otra.clock.setFixedTime(HOY);
  await otra.goto('/pinta-tu-pieza');
  await otra.getByRole('button', { name: 'Floreros y macetas' }).click();
  await expect(otra.getByRole('article', { name: 'Florero dulce' }).getByText('Agotada').first()).toBeVisible();
  await otra.close();
  sinErrores(errores);
});

test.describe('en el celular', () => {
  const { defaultBrowserType: _navegador, ...telefono } = devices['Pixel 7'];
  test.use(telefono);

  test('reserva a puro toque: barra «Hoy pagas» con el anticipo y pago del 50 %', async ({ page }) => {
    test.setTimeout(180_000);
    const errores = await preparar(page);
    await page.goto('/pinta-tu-pieza');
    await page.getByRole('link', { name: 'Reservar mi lugar' }).first().tap();
    await expect(page.getByText('Paso 1 de 5')).toBeVisible();
    const barra = page.locator('div.fixed.bottom-0');
    await expect(barra.getByText('—')).toBeVisible(); // sin pieza no hay monto (nunca $0)
    await hastaLaPieza(page, 'Sagrado corazón', { tocar: true });
    await expect(barra.getByText('$450 MXN')).toBeVisible();
    await datosYResumen(page, 'pinta-movil@ejemplo.com', true);
    await expect(page.locator('[data-anticipo]')).toHaveText('$450 MXN');
    await expect(page.locator('[data-saldo]')).toHaveText('$450 MXN');
    await pagarDemo(page, '$450 MXN', true);
    const sinDesborde = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(sinDesborde).toBe(true);
    sinErrores(errores);
  });
});
