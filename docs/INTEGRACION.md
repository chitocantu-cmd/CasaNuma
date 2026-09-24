# Conectar el sitio rediseñado al backend real

El sitio habla con los datos a través de un solo contrato:
`src/datos/repositorio.ts`. Hoy lo cumple `src/datos/demo/repoDemo.ts`.
Para producción hay que escribir `src/datos/supabase/repoSupabase.ts` y
elegirlo en `src/datos/index.ts` cuando `VITE_FUENTE_DATOS=supabase`.

Ningún componente cambia. Las reglas que la demo ya aplica (precio desde el
catálogo, cupo verificado al apartar, 4 clases del mismo mes, edad mínima 7,
apartado de 15 minutos) son las que el backend debe hacer cumplir en SQL.

## Qué ya existe en `supabase/`

- `workshops` + vista `public_workshops` (cupo ya descontado).
- `crear_reserva()` atómica, `create-reservation`, `create-checkout-session`,
  `stripe-webhook` (única vía a `confirmed`), `reservation-status`.
- Holds con vencimiento, cron, correos (Resend), Google Calendar, panel.
- `site_settings` para WhatsApp, dirección, mapa y horarios.

## Qué falta, método por método

| Método | Hoy (demo) | Con Supabase |
|---|---|---|
| `talleres()` / `taller(slug)` | `src/datos/agenda.ts` (datos reales) | `public_workshops`. Cada registro de `agenda.ts` ya tiene la forma de la fila: `id, slug, title, description, date, sessions, category, image, price, price_type, price_label, capacity/available_spots/is_sold_out (por sesión), age_min, age_max, is_featured, is_active, booking_type`. Hoy la tabla es una fila por fecha y horario; para «un taller, varios horarios» agregar `workshop_sessions` o una columna `grupo`. `capacity`, `price` y `end_time` deben aceptar `null` (dato no publicado). |
| `mesesMembresia()` | generado | **Nuevo:** tabla `class_sessions` (`tipo` = `membresia`/`kids`, fecha, inicio, fin, `capacity`, `status`) + vista pública con disponibles. |
| `sesionesKids()` | generado | `class_sessions` con `tipo = 'kids'`. |
| `productos()` / `producto(slug)` | `PRODUCTOS_SEMILLA` | **Nuevo:** tabla `products` (fotos en Cloudinary, `published`, `disponibilidad`) + vista pública. |
| `apartar(solicitud)` | valida y guarda en localStorage | Extender `create-reservation`: para membresía y kids, **nuevo** RPC que bloquee las N sesiones con `FOR UPDATE` en orden fijo (evita deadlocks), valide 4 sesiones del mismo mes / edad ≥ 7, calcule el precio en SQL y cree la reserva con una tabla puente `reservation_sessions`. |
| `pagar(id)` | confirma al instante | `create-checkout-session` → devolver `{ tipo: 'redireccion', url }`. El webhook confirma; la vuelta llega a `/pago/exitoso` (ya existe). |
| `liberar(id)` | marca expirada | RPC que expire el hold propio (opcional: el cron ya lo hace). |
| `misReservas()` | por usuario | **Nuevo:** vista `mis_reservas` filtrada por `auth.uid()` con RLS. |
| `registrar` / `entrar` / `salir` | localStorage | Supabase Auth. **Hoy los registros públicos están desactivados a propósito** (solo el equipo tiene cuenta): hay que habilitarlos, confirmar correo, y ligar `customers.user_id → auth.users`. El panel sigue exigiendo `admin_profiles`. |
| `recuperarPassword` | simulado | `supabase.auth.resetPasswordForEmail` + página de nueva contraseña. |
| `actualizarPerfil` | localStorage | `update customers` con RLS sobre la propia fila. |
| `suscribirNovedades` | localStorage | **Nuevo:** tabla `newsletter_subscribers` (correo, fecha y origen del consentimiento, baja). Independiente de la cuenta. |

## Agenda sin precio o sin cupo

- `price: null` + `booking_type: 'inquiry'` → la tarjeta muestra
  `price_label` («Info DM») y un botón de «Solicitar información» (WhatsApp o
  mensaje directo de Instagram). `create-reservation` debe rechazar estos
  talleres aunque alguien llame a la función a mano.
- `capacity: null` → «Cupo limitado»; no se cuenta cupo ni se rechaza por
  lleno. En cuanto haya número, el conteo transaccional existente aplica.

## Configuración

`src/config/site.ts` lee variables `VITE_NUMA_*`. Cuando el panel edite
`site_settings`, basta con un hook que lea esa tabla y tenga prioridad
sobre las variables.

## Panel administrativo

Para lo que pide el documento (sección 9) faltan pantallas de: sesiones de
membresía y NUMA Kids (crear, cupo, bloquear fechas), membresías vendidas,
productos de NUMA Store (crear, editar, marcar agotado) y testimonios.
El panel actual ya cubre talleres, reservaciones, pagos y prospectos.

## Datos personales de menores

NUMA Kids guarda nombre y edad de cada niño. Pedir solo eso, dejarlo fuera
de cualquier vista pública y mencionarlo en el aviso de privacidad.
