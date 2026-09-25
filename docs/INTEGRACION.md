# Conectar el sitio rediseñado al backend real

El sitio habla con los datos a través de dos contratos en
`src/datos/repositorio.ts`:

- `Repositorio`: sitio público y Mi cuenta.
- `RepositorioAdmin`: panel `/admin`.

Los cumplen dos implementaciones y `src/datos/index.ts` elige con
`VITE_FUENTE_DATOS`:

- `demo` → `src/datos/demo/repoDemo.ts`, datos en el navegador, pagos falsos.
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

Migraciones v2 (`20260924100000_estados_v2.sql` … `20260925100000_mi_cuenta_y_panel.sql`):
**aplicadas a la base real** (hasta la 13 el 24 sep 2026; la 14 el 25 sep),
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

Pruebas: `npm run test:reservas` (115 pruebas, fechas relativas a hoy:
cupo, AGOTADO, pago tardío, folio, membresía, NUMA Kids, panel, Mi cuenta,
novedades y RLS).
`npm test` (v1) tiene una semilla con fechas de septiembre de 2026 que ya
pasaron; falla por eso, no por la v2.

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
6. Publicar: en Vercel, `VITE_FUENTE_DATOS=supabase`; en Supabase,
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
| `pagar(id)` | confirma al instante (DEMO) | `create-checkout-session` → `{ tipo: 'redireccion', url }`. El webhook confirma. |
| `liberar(id)` | marca expirada | `liberar_mi_apartado()`: solo el apartado propio, web y pendiente. |
| `misReservas()` | por usuario | `mis_reservas()`: las de la cuenta y las que el equipo registró con su correo, sin notas internas. |
| `registrar` / `entrar` / `salir` | localStorage | Supabase Auth; nombre y teléfono en los metadatos de la cuenta. Con confirmación de correo, `registrar` responde `CONFIRMAR_CORREO`. |
| `recuperarPassword` / `cambiarPassword` | sin correo | Enlace de Supabase Auth a `/cuenta/nueva-contrasena`. |
| `productos()` / `producto(slug)` | `PRODUCTOS_SEMILLA` | **Pendiente:** tabla `products`. Mientras, las mismas fichas de ejemplo (marcadas demo). |
| `suscribirNovedades` | localStorage | `suscribir_novedades()` → `newsletter_subscribers` (10 intentos por IP cada 10 min). |

Panel (`RepositorioAdmin`):

| Método | Con Supabase |
|---|---|
| `entrarAdmin` / `adminActual` | Supabase Auth + fila en `admin_profiles`. Una clienta no entra. |
| `resumen`, `reservas`, `reserva` | `select` con RLS de admin sobre `reservations`, `customers`, `payments`, `reservation_items`, `workshop_sessions`. |
| `actualizarReserva` | Edge Function `admin-actions` → `registrar_pago_manual` (avisa a la clienta), `cancelar_reserva`, `admin_marcar_reembolso`, `admin_actualizar_reserva` (completada / no asistió / notas). |
| `crearReservaManual` | `admin-actions` → `crear_reserva_panel()` con el importe que captura el equipo (+ `registrar_pago_manual` si ya pagó). |
| `agenda(mes)`, `talleres()` | `sesiones_ocupacion` + partidas de las reservas vivas. |
| `ajustarCupo` | `admin-actions` → `admin_ajustar_cupo()` (nunca menor a lo reservado). |
| `membresias()` | reservas de tipo membresía con sus 4 clases. |
| `clientes()` | clientes de las reservas + `admin_cuentas()` (cuentas sin reservas). |
| `avisos()` | `integration_jobs`: enviado, en cola, sin destinatario, WhatsApp omitido (sin configurar) o fallido con su motivo. |

## Avisos

- **Correo al equipo:** `ADMIN_NOTIFICATION_EMAIL`. Asunto
  `Nueva reserva Casa Numa — {experiencia} — {DD Mmm}`, con cliente,
  teléfono, correo, experiencia, fecha, hora, participantes, total, estado,
  folio y botón **Ver reservación** (`APP_URL/admin/reservas/{id}`). Vacío a
  propósito hasta que Casa Numa dé el correo: no se inventa.
- **Correo a la clienta:** confirmación con folio y enlace a Mi cuenta.
- **WhatsApp al equipo:** `supabase/functions/_shared/whatsapp.ts`, API de
  WhatsApp Business Cloud con plantilla aprobada por Meta. No es un enlace
  `wa.me`. Sin configurar, se omite sin error.

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
