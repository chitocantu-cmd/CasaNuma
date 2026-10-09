# Conectar el sitio rediseñado al backend real

El sitio habla con los datos a través de dos contratos en
`src/datos/repositorio.ts`:

- `Repositorio`: sitio público y Mi cuenta.
- `RepositorioAdmin`: panel `/admin`.

Los cumplen dos implementaciones y `src/datos/index.ts` elige con
`VITE_FUENTE_DATOS` (o su alias `VITE_DEMO_MODE`: `true` = demo,
`false` = supabase):

- `demo` → `src/datos/demo/repoDemo.ts`, datos en el navegador. Pago
  simulado con dos botones (aprobado / rechazado), avisos en una bandeja de
  demostración y Calendar marcado como «Simulado (demo)» en `/admin/avisos`.
- `supabase` → `src/datos/supabase/repoSupabase.ts`, la base real, Stripe
  Checkout y el panel con los datos del estudio. Se descarga solo en ese modo.

Ningún componente cambia entre una y otra.

## El flujo de una reserva (igual en la demo y en el backend)

1. **Apartar.** Se revisa el cupo *en el backend*, con las filas de las
   sesiones bloqueadas, y se crea la reserva en `pending_payment` con
   vencimiento (15 min en la web). El lugar ya no está disponible para nadie más.
2. **Pagar.** El proveedor de pago confirma (webhook de Stripe →
   `confirmar_pago`). El cupo **se vuelve a revisar** antes de confirmar; si
   el apartado venció y alguien tomó el lugar, el pago queda en revisión y la
   reserva **no** se confirma.
3. **Confirmada.** La base asigna el folio consecutivo (`NUMA-00001`…) y
   encola los avisos: correo a la clienta, correo al equipo
   (`ADMIN_NOTIFICATION_EMAIL`) y WhatsApp al equipo (API oficial).
4. La reserva aparece al instante en `/admin/reservas` y en Mi cuenta.

Una reserva **no** está confirmada hasta que el proveedor de pago la confirma
(o el equipo registra un pago en el panel).

## Qué ya existe en `supabase/`

Migraciones v1 (en producción):

- `workshops` + vista `public_workshops`, `crear_reserva()` atómica,
  `create-reservation`, `create-checkout-session`, `stripe-webhook`,
  `reservation-status`, holds con vencimiento, cron, correos (Resend),
  Google Calendar, `admin_profiles` + `es_admin()` + RLS.

Migraciones v2 (`20260924100000_estados_v2.sql` … `20260925130000_completar_job_con_nota.sql`):
**aplicadas a la base real** (hasta la 13 el 24 sep 2026; de la 14 a la 17 el 25 sep),
con las Edge Functions desplegadas. El sitio se probó de punta a punta en
modo `supabase` contra la base real y Stripe en modo prueba (paso 5). El
sitio publicado sigue en modo demo hasta el paso 6.

- `20260924100500_conexion_sitio.sql`: sesiones de NUMA Kids y membresía
  ligadas a su tarjeta, `workshops.booking_type`, `sesiones_ocupacion`,
  `liberar_mi_apartado()`, `crear_reserva_panel()` (importe capturado por el
  equipo) y `admin_marcar_reembolso()`.
- `20260925100000_mi_cuenta_y_panel.sql`: `mis_reservas()` (Mi cuenta, sin
  notas internas: la clienta ya no lee la tabla `reservations`),
  `newsletter_subscribers` + `suscribir_novedades()`, `admin_cuentas()` y
  `cancelar_reserva()` corregida (cancelar una membresía fallaba al encolar
  Calendar sin taller).
- `20260925110000_calendario_por_sesion.sql`: un evento de Google Calendar
  por sesión (ver abajo).
- `20260925120000_catalogo_panel.sql`: `workshops.origen` (`agenda` /
  `panel`) y `editado_en`. Los talleres creados o editados desde
  `/admin/talleres` quedan protegidos: `dev/cargar-agenda.mjs` ya no los
  sobrescribe, ni los cierra, ni los oculta.
- `20260925130000_completar_job_con_nota.sql`: `completar_job(id, nota)`
  cierra el trabajo y guarda su nota («OMITIDO…», «PARCIAL…») en un solo
  paso, para que el panel no muestre «enviado» un instante antes de saber
  que se omitió.

| Entidad pedida | Tabla |
|---|---|
| users | `auth.users` (Supabase Auth) + `customers.user_id` + `admin_profiles` (rol admin) |
| workshops | `workshops` (catálogo: título, descripción, foto, categoría) |
| workshop_sessions | `workshop_sessions` — fecha, hora, `capacity` (NULL = sin confirmar), `price` (NULL = Info DM), tipo `taller` / `kids` / `membresia` |
| reservations | `reservations` + `folio`, `experience_type`, `user_id`, `origin` (web/panel), `internal_notes` |
| reservation_items | `reservation_items` — qué sesiones ocupa cada reserva |
| payments | `payments` + `method` (tarjeta/transferencia/efectivo/otro) y `reference` |
| memberships | `memberships` + `membership_plans` (4 clases, $3,200) + vista `membership_usage` (utilizadas/reservadas/restantes) |
| NUMA Kids | `reservation_children` — **solo** nombre y edad; el tutor es el cliente |

Estados: `pending_payment`, `confirmed`, `cancelled`, `completed`,
`refunded`, `no_show` (y `expired` para apartados vencidos).

Funciones (solo las llama el backend con `service_role`; el navegador no):

- `crear_reserva_sesiones(tipo, sesiones[], personas, nombre, correo, teléfono, niños, usuario, origen)`
- `confirmar_pago(...)`: misma firma que v1, ahora revalida por sesión.
- `registrar_pago_manual(reserva, monto, método, referencia)`: transferencia o efectivo desde el panel.
- `admin_actualizar_reserva(reserva, 'completed' | 'no_show', nota)`.
- `datos_reserva(reserva)`: lo que usan los correos y el WhatsApp.
- `siguiente_folio()` + trigger `asignar_folio`: ningún camino confirma sin folio.

Pruebas:

- `npm run test:reservas` (131 pruebas sobre las migraciones en PGlite,
  fechas relativas a hoy: cupo, AGOTADO, pago tardío, folio, membresía, NUMA
  Kids, panel, Mi cuenta, novedades, RLS, Calendar por sesión y catálogo del
  panel). `npm run test:migraciones`: todas aplican en orden.
- `npm run test:unit` (Vitest): lógica de precios, fechas y validaciones, y
  el repositorio demo (doble clic, pago rechazado, catálogo del panel).
- `npm run test:e2e` (Playwright, Chrome instalado; levanta el sitio en modo
  demo en el puerto 5175 con la fecha fija 25 sep 2026): reserva completa de
  punta a punta, NUMA Kids, membresía, eventos, todas las rutas, 320–1440 px
  sin desbordes, panel (crear/editar/desactivar taller, reserva manual) y
  una revisión de cada botón, imagen y campo del sitio y del panel.
- `npm test` (v1, 73 pruebas): la semilla se recorre a fechas relativas a
  hoy, así que ya no caduca.

### Para activar v2

1. Borrar los datos de ejemplo (`node dev/admin-db.mjs limpiar`), aplicar
   las migraciones v2 en el SQL Editor —una por una, en orden— y regresar
   el folio a cero (`node dev/admin-db.mjs folio-cero`). *Hecho el 24 sep 2026
   (`estados_v2` y `reservas_v2`).*
2. Aplicar `20260924100200_catalogo_agenda.sql` (cupo y hora de cierre
   opcionales en `workshops`) y cargar la agenda:
   `node dev/cargar-agenda.mjs` (simula) → `node dev/cargar-agenda.mjs --aplicar`.
   La agenda (`src/datos/agenda.ts`) es la única fuente de fechas: talleres,
   NUMA Kids (Tardes de Cerámica · Niños) y clases de membresía (Clases de
   Cerámica). Agrega lo que falta, llena precios u horas vacías, cierra lo
   que ya no está publicado (sin reservas vivas) y oculta los ejemplos; no
   borra nada y nunca toca el cupo. *Octubre completo cargado el 24 sep 2026
   (29 horarios).*
3. *Hecho el 24 sep 2026.* `create-reservation` llama `crear_reserva_sesiones`
   (acepta el formato v1 `{ slug }` y lo traduce a la sesión: v1 ya no aparta).
   `create-checkout-session` cobra lo que calculó la base, también para NUMA
   Kids y membresía. `admin-actions` suma registrar pago, completar / no
   asistió / notas, reserva manual y cupo. NUMA Kids 10 a 14 años en la base.
   Webhook de Stripe (modo prueba) creado con 4 eventos; su secreto está en
   `dev/secretos.env` y en Supabase. `node dev/desplegar.mjs` solo sube
   valores reales (omite vacíos y los idénticos al ejemplo).
   Prueba de punta a punta: `node dev/prueba-pago-tmp.mjs` (no se versiona;
   crea reservas `@ejemplo.com` que se borran con `admin-db.mjs limpiar` y
   `folio-cero`).
4. Configurar `ADMIN_NOTIFICATION_EMAIL` y Resend (`RESEND_API_KEY`,
   `RESEND_FROM_EMAIL` con dominio verificado); si se quiere, WhatsApp.
   Mientras tanto los correos quedan en la cola y fallan con aviso claro.
5. *Hecho el 25 sep 2026.* `repoSupabase.ts` cumple los dos contratos; el
   panel `/admin` es el mismo en los dos modos. Probado de punta a punta con
   el sitio local en modo `supabase` (`VITE_FUENTE_DATOS=supabase npx vite`)
   con `dev/prueba-sitio-tmp.mjs` (no se versiona): catálogo, cuenta,
   apartar y cambiar de idea, NUMA Kids, membresía, pago en Stripe y regreso
   a `/pago/exitoso` con la confirmación y el folio, Mi cuenta, y en el
   panel: detalle, notas, agenda, cupo, reserva manual, pago, cancelación,
   reembolso, clientes, pagos y avisos. Los datos de prueba se borraron y el
   folio volvió a cero.
6. **Anticipo del 50 % (pendiente de aplicar en la base real).** En este
   orden, porque el panel nuevo lee columnas que crea la migración:
   1. `npx supabase db query --linked -f supabase/migrations/20261008100000_anticipo_50.sql`
      (no `db push`) y verificar con
      `select to_regprocedure('admin_liquidar_saldo(uuid,text,text)');`.
   2. `npx supabase functions deploy create-checkout-session admin-actions process-jobs --project-ref xjerknpiyokzzcihwkpg`.
   3. Publicar el sitio. Hasta entonces el sitio publicado cobra el total.
7. Publicar: en Vercel, `VITE_FUENTE_DATOS=supabase`; en Supabase,
   `APP_URL` y `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` con el dominio
   definitivo. En Supabase → Authentication:
   - **URL Configuration:** Site URL = el dominio, y en Redirect URLs
     `https://<dominio>/**` (los enlaces de confirmar cuenta y de nueva
     contraseña regresan a la página donde se pidieron, y a
     `/cuenta/nueva-contrasena`).
   - **SMTP:** el correo integrado de Supabase manda muy pocos por hora;
     conectar Resend (el mismo dominio verificado del paso 4) antes de abrir
     los registros al público.
   - **Confirmar correo** está activo: quien crea su cuenta en el checkout
     debe abrir el enlace antes de pagar (el sitio se lo explica). Si Casa
     Numa prefiere no pedirlo, se desactiva ahí mismo; el código funciona
     igual con las dos opciones.

## Método por método

| Método | Hoy (demo) | Con Supabase |
|---|---|---|
| `talleres()` / `taller(slug)` | `src/datos/agenda.ts` | `workshops` + `public_sessions` (lugares disponibles; NULL si el cupo no está confirmado). |
| `mesesMembresia()` / `sesionesKids()` | filas de la agenda (Clases de Cerámica / Tardes de Cerámica · Niños) | `public_sessions` con `experience_type = 'membresia'` / `'kids'`. |
| `disponibilidad(ids)` | cuenta en el navegador | `public_sessions.seats_available`. |
| `apartar(solicitud)` | valida y guarda | `create-reservation` → `crear_reserva_sesiones`. |
| `pagar(id, { simulacion })` | `aprobado` confirma al instante; `rechazado` registra el pago fallido y responde `PAGO_RECHAZADO` (la reserva sigue apartada) | `create-checkout-session` → `{ tipo: 'redireccion', url }`. El webhook confirma. La opción de simulación se ignora. |
| `liberar(id)` | marca expirada | `liberar_mi_apartado()`: solo el apartado propio, web y pendiente. |
| `misReservas()` | por usuario | `mis_reservas()`: las de la cuenta y las que el equipo registró con su correo, sin notas internas. |
| `registrar` / `entrar` / `salir` | localStorage | Supabase Auth; nombre y teléfono en los metadatos de la cuenta. Con confirmación de correo, `registrar` responde `CONFIRMAR_CORREO`. |
| `recuperarPassword` / `cambiarPassword` | sin correo | Enlace de Supabase Auth a `/cuenta/nueva-contrasena`. |
| `productos()` / `producto(slug)` | `PRODUCTOS_SEMILLA` | **Pendiente:** tabla `products`. Mientras, las mismas fichas de ejemplo (marcadas demo). |
| `sesionesPinta()` / `piezasPinta()` | horario semanal + `src/contenido/piezasPinta.ts` (precios de ejemplo solo con datos de demostración visibles) | **Pendiente:** ver «Pinta tu pieza». Hoy devuelven `[]`. |
| `suscribirNovedades` | localStorage | `suscribir_novedades()` → `newsletter_subscribers` (10 intentos por IP cada 10 min). |

Panel (`RepositorioAdmin`):

| Método | Con Supabase |
|---|---|
| `entrarAdmin` / `adminActual` | Supabase Auth + fila en `admin_profiles`. Una clienta no entra. |
| `resumen`, `reservas`, `reserva` | `select` con RLS de admin sobre `reservations`, `customers`, `payments`, `reservation_items`, `workshop_sessions`. |
| `actualizarReserva` | Edge Function `admin-actions` → `registrar_pago_manual` (avisa a la clienta), `cancelar_reserva`, `admin_marcar_reembolso`, `admin_actualizar_reserva` (completada / no asistió / notas). |
| `crearReservaManual` | `admin-actions` → `crear_reserva_panel()` con el importe que captura el equipo (+ `registrar_pago_manual` si ya pagó). |
| `agenda(mes)`, `talleres()` | `sesiones_ocupacion` + partidas de las reservas vivas. |
| `catalogo()` | `workshops` (todos, publicados o no) + sus sesiones con lo ocupado. |
| `crearTaller` | `insert` en `workshops` (`origen = 'panel'`, slug único) y una `workshop_sessions` por horario. RLS de admin. |
| `editarTaller` | Nombre, descripción, categoría, foto y precio (también el de sus horarios). Marca `editado_en`. El precio de NUMA Kids y membresía no se cambia aquí. |
| `activarTaller` | `status` `published` / `draft`: desactivado deja de verse en el sitio; las reservas existentes no se tocan. |
| `integraciones()` | Último trabajo terminado de cada tipo en `integration_jobs`: conectado, sin configurar (nota «OMITIDO») o con error. |
| `ajustarCupo` | `admin-actions` → `admin_ajustar_cupo()` (nunca menor a lo reservado). |
| `membresias()` | reservas de tipo membresía con sus 4 clases. |
| `clientes()` | clientes de las reservas + `admin_cuentas()` (cuentas sin reservas). |
| `avisos()` | `integration_jobs`: enviado, en cola, sin destinatario, WhatsApp omitido (sin configurar) o fallido con su motivo. |

## Anticipo del 50 % (toda reserva en línea)

Talleres, NUMA Kids, membresía y Pinta tu pieza se confirman pagando el 50 %
del total (precio × personas); el resto se liquida en Casa Numa. Eventos y
NUMA Store siguen por WhatsApp y no usan la regla. Las reservas que registra
el equipo en el panel se pagan completas, como antes.

- **Sitio y demo:** el porcentaje vive solo en `src/config/reservas.ts` y la
  cuenta en `src/lib/anticipo.ts` (`calcularPagoReserva`, en centavos).
- **Base** (`20261008100000_anticipo_50.sql`): `anticipo_porcentaje()` = 50;
  al apartar en la web un trigger fija `deposit_percentage` y
  `deposit_amount`; `amount_paid` es la suma de los pagos cobrados;
  `remaining_balance` y `payment_status` (`pending` → `deposit_paid` →
  `paid_in_full`, o `refunded`) se calculan solos.
- **Stripe:** `reserva_para_pago` devuelve `amount_due` (el anticipo) y
  `create-checkout-session` cobra solo eso, en una línea «Anticipo 50 % ·
  taller» con el total y el saldo en la descripción. `confirmar_pago` no
  confirma si Stripe cobró menos del anticipo (queda en revisión).
- **Panel:** «Marcar saldo como pagado» → `admin-actions` `settle_balance` →
  `admin_liquidar_saldo()`: agrega un pago `manual` por el saldo y llena
  `final_payment_amount`; el pago del anticipo se conserva.
- **Avisos:** `datos_reserva` lleva total, anticipo, pagado y saldo; el correo
  y el WhatsApp (variable {{5}}) los muestran.

## Pinta tu pieza

Funciona completo en la demo. **En Supabase todavía no existe**: `sesionesPinta()`
y `piezasPinta()` devuelven listas vacías (la página ofrece WhatsApp) y
`apartar` con `tipo: 'pinta'` responde `NO_CONECTADO`. Así nunca se cobra un
anticipo calculado en el navegador. Para conectarlo:

**Regla única.** `src/lib/anticipo.ts` → `calcularPagoReserva(precio)` =
`{ total, porcentajeAnticipo: 50, anticipo, saldo }`, en centavos (el centavo
impar queda en el saldo). El servidor debe repetir la misma cuenta; nunca se
escribe un anticipo a mano. `SALDO = PRECIO FINAL − TOTAL YA PAGADO`, también
al cambiar de pieza.

El anticipo, los estados de pago, el cobro en Stripe y «Marcar saldo como
pagado» ya están en la base (sección anterior). Falta lo propio de las piezas.

**Base (migración pendiente, aplicar con `supabase db query --linked -f`):**

| Qué | Detalle |
|---|---|
| `experience_type` | nuevo valor `paint_your_piece`; sesiones del horario semanal (jue 19:00–21:00, vie 10:00, sáb 11:00 y 16:00, dom 11:00; lunes a miércoles nada), cupo 16. |
| `paint_pieces` | `id, name, description, category, images, price numeric NULL, size, finish_type, requires_firing, stock int NULL, is_available`. `price NULL` = «Precio pendiente», no se puede apartar. `stock NULL` = sin conteo. Hoy el catálogo vive en `src/contenido/piezasPinta.ts` con la misma forma. |
| `reservations` | `piece_id, piece_name, piece_price` y el historial de cambios de pieza (`piece_changes jsonb` o tabla aparte). |
| `crear_reserva_sesiones` | con `piece_id`: `SELECT … FOR UPDATE` sobre la pieza, rechaza sin precio / inactiva / sin existencias (contando apartados vigentes); el total es el precio de la pieza y el trigger fija el anticipo. |
| Confirmar pago | descuenta 1 de `stock` (si no es NULL). Cancelar devuelve la pieza. |

**Panel.** `cambiarPieza(id, piezaId)` → mueve el inventario, guarda el cambio y
recalcula el saldo; si queda negativo, **revisión manual** (sin reembolso
automático hasta que Casa Numa defina su política). `piezas()` /
`editarPieza()` → inventario (precio, existencias, encendida).

Nombres: `total` = totalPrice, `cobro.porcentaje` = depositPercentage,
`cobro.anticipo` = depositAmount, `cobro.pagado` = amount paid,
`cobro.pagoFinal` = finalPaymentAmount, `cobro.saldo` = remainingBalance,
`tipo: 'pinta'` = experienceType `paint_your_piece`.

## Avisos

- **Correo al equipo:** `ADMIN_NOTIFICATION_EMAIL`. Asunto
  `Nueva reserva Casa Numa — {experiencia} — {DD Mmm}`, con cliente,
  teléfono, correo, experiencia, fecha, hora, participantes, total, estado,
  folio y botón **Ver reservación** (`APP_URL/admin/reservas/{id}`). Vacío a
  propósito hasta que Casa Numa dé el correo: no se inventa.
- **Correo a la clienta:** confirmación con folio y enlace a Mi cuenta.
- **WhatsApp al equipo:** `supabase/functions/_shared/whatsapp.ts`, API de
  WhatsApp Business Cloud con plantilla aprobada por Meta (`aviso_reserva`,
  categoría Utilidad, es_MX, 6 variables). No es un enlace `wa.me`. Puede
  avisar a varios números (`WHATSAPP_ADMIN_TO` separados por coma). Sin
  configurar, se omite sin error y el panel lo muestra como «pendiente de
  integrar».

## Google Calendar

Un evento por **sesión** (cada horario de taller, NUMA Kids y clase de
membresía) en el calendario del equipo, con cupo, reservas confirmadas,
teléfono y, en NUMA Kids, los niños. Migración `calendario_por_sesion`:

- Se encola solo al crear o cambiar una sesión (cupo, horario, estado) y
  cuando una reserva entra o sale de confirmada/completada.
- `encolar_calendario()` (o `admin-actions` → `sync_calendar` sin id)
  sincroniza toda la agenda próxima: hay que correrlo una vez al conectar.
- Acceso con **cuenta de servicio** de Google (no caduca): la llave JSON va
  en `dev/google-calendar.json` y `node dev/desplegar.mjs` la sube como
  `GOOGLE_SERVICE_ACCOUNT`; el calendario se comparte con el correo de esa
  cuenta («Hacer cambios en los eventos») y su id va en `GOOGLE_CALENDAR_ID`.
- Sin configurar, cada trabajo se cierra con la nota «OMITIDO».

## Agenda sin precio o sin cupo

**Cupo confirmado por Casa Numa (25 sep 2026): 16 lugares por sesión**, en
talleres, NUMA Kids y clases de membresía. Está en `src/datos/agenda.ts` (las
sesiones nuevas se cargan con él) y se aplicó a las 29 sesiones de la base
real con `admin_ajustar_cupo` (queda en la bitácora). Cada sesión se puede
cambiar en `/admin/talleres`. En línea se aparta hasta 6 personas por
reserva; grupos más grandes, por mensaje.

- `price: null` → «Info DM» y botón de «Solicitar información».
  `crear_reserva_sesiones` rechaza esas sesiones aunque alguien llame a la
  función a mano.
- `capacity: null` → «Cupo limitado»; no se cuenta cupo, solo el tope por
  reserva (6, pendiente de confirmar). En cuanto haya número, el conteo
  transaccional aplica y el sitio muestra «Solo quedan N lugares» y
  «Agotado».

## Configuración

`src/config/site.ts` lee variables `VITE_NUMA_*`. Cuando el panel edite
`site_settings`, basta con un hook que lea esa tabla y tenga prioridad
sobre las variables.

## Datos personales de menores

NUMA Kids guarda solo nombre y edad de cada niño (la tabla no tiene más
columnas). Fuera de cualquier vista pública; mencionarlo en el aviso de
privacidad.
