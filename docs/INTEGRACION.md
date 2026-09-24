# Conectar el sitio rediseñado al backend real

El sitio habla con los datos a través de dos contratos en
`src/datos/repositorio.ts`:

- `Repositorio`: sitio público y Mi cuenta.
- `RepositorioAdmin`: panel `/admin`.

Hoy los dos los cumple `src/datos/demo/repoDemo.ts`, con datos en el
navegador. Para producción hay que escribir `src/datos/supabase/repoSupabase.ts`
y elegirlo en `src/datos/index.ts` cuando `VITE_FUENTE_DATOS=supabase`.
Ningún componente cambia.

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

Migraciones v2 (`20260924100000_estados_v2.sql` … `20260924100400_pago_stripe_una_fila.sql`):
**aplicadas a la base real el 24 sep 2026**, con las Edge Functions ya
desplegadas y probadas con un pago real de Stripe en modo prueba. El sitio
público todavía no las usa: sigue en modo demo hasta el paso 5.

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

Pruebas: `npm run test:reservas` (65 pruebas, fechas relativas a hoy:
cupo, AGOTADO, pago tardío, folio, membresía, NUMA Kids, panel y RLS).
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
5. Escribir `repoSupabase.ts` y cambiar `VITE_FUENTE_DATOS=supabase`.

## Método por método

| Método | Hoy (demo) | Con Supabase |
|---|---|---|
| `talleres()` / `taller(slug)` | `src/datos/agenda.ts` | `workshops` + `public_sessions` (lugares disponibles; NULL si el cupo no está confirmado). |
| `mesesMembresia()` / `sesionesKids()` | filas de la agenda (Clases de Cerámica / Tardes de Cerámica · Niños) | `public_sessions` con `experience_type = 'membresia'` / `'kids'`. |
| `disponibilidad(ids)` | cuenta en el navegador | `public_sessions.seats_available`. |
| `apartar(solicitud)` | valida y guarda | `create-reservation` → `crear_reserva_sesiones`. |
| `pagar(id)` | confirma al instante (DEMO) | `create-checkout-session` → `{ tipo: 'redireccion', url }`. El webhook confirma. |
| `misReservas()` | por usuario | `select` sobre `reservations` con la sesión de la clienta: el RLS solo deja ver las suyas. |
| `registrar` / `entrar` / `salir` | localStorage | Supabase Auth. Hoy los registros públicos están desactivados a propósito; habilitarlos y confirmar correo. |
| `productos()` / `producto(slug)` | `PRODUCTOS_SEMILLA` | **Nuevo:** tabla `products`. |
| `suscribirNovedades` | localStorage | **Nuevo:** tabla `newsletter_subscribers`. |

Panel (`RepositorioAdmin`):

| Método | Con Supabase |
|---|---|
| `entrarAdmin` / `adminActual` | Supabase Auth + fila en `admin_profiles`. Una clienta no entra. |
| `resumen`, `reservas`, `reserva` | `select` con RLS de admin sobre `reservations`, `customers`, `payments`, `reservation_items`, `workshop_sessions`. |
| `actualizarReserva` | Edge Function `admin-actions` → `admin_actualizar_reserva`, `cancelar_reserva`, `registrar_reembolso`, `registrar_pago_manual`. |
| `crearReservaManual` | `admin-actions` → `crear_reserva_sesiones(..., origen = 'panel')` (+ `registrar_pago_manual` si ya pagó). |
| `agenda(mes)`, `talleres()` | `workshop_sessions` + `lugares_ocupados_sesion`. |
| `ajustarCupo` | `update workshop_sessions set capacity` (política de admin). |
| `membresias()` | `membership_usage`. |
| `avisos()` | `integration_jobs` (estado de cada correo / WhatsApp). |

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
