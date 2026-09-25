# AUDITORÍA CASA NUMA

25 de septiembre de 2026. Respaldo del estado anterior: etiqueta git
`respaldo-antes-auditoria` (commit `4d11de9`).

Se recorrió el sitio completo dos veces como clienta nueva, clienta con
cuenta, mamá o papá de NUMA Kids, alumna de membresía, persona que cotiza un
evento, compradora de NUMA Store, visitante en celular y equipo de Casa Numa
en el panel. En la primera pasada se detectó y corrigió; en la segunda se
volvió a probar todo con las pruebas automáticas.

## Estado general

| | |
|---|---|
| Sitio y panel en modo demo (el que está publicado) | **100 %** de los recorridos principales en PASS |
| Listo para cobrar y avisar de verdad | **≈ 85 %** — el código está; faltan credenciales externas y publicar en modo Supabase |

Nada de lo pendiente es un error del sitio: son llaves de Stripe, Resend,
Google y Meta, y decisiones de Casa Numa.

## Corregido

**Errores, carga y estados vacíos**

- Página 404 propia («Esta pieza todavía no existe.») y un Error Boundary que
  atrapa cualquier falla de una pantalla («Algo salió mal.») con *Intentar de
  nuevo* y *Volver al inicio*, en vez de una pantalla en blanco.
- Estados de carga, error («No pudimos conectarnos. / Reintentar») y vacío
  en Talleres, NUMA Store, Mi cuenta, los tres checkouts y las nueve
  pantallas del panel. Mi cuenta mostraba un hueco mientras cargaba.
- Filtros sin resultados con salida («Ver todos los talleres»); Mi cuenta sin
  reservas invita a «Descubrir talleres».

**Reservas y pago**

- Pago de demostración con dos botones: *Simular pago aprobado* y *Simular
  pago rechazado*. El rechazo explica que el lugar no está confirmado,
  permite *Intentar nuevamente* y no crea una reserva confirmada.
- Candados contra doble clic en apartar, pagar, crear cuenta, entrar (sitio
  y panel), reserva manual, cambios de una reserva y formulario de taller.
- El horario, las fechas de NUMA Kids y las clases de membresía elegidas
  sobreviven a recargar la página. Si el mes guardado ya no existe, se
  recupera sin romperse. NUMA Kids ya no ofrece fechas pasadas.
- Al regresar de un paso, el apartado se libera en lugar de quedarse
  ocupando el lugar.
- La confirmación muestra el estado del pago y un enlace para agregar la
  experiencia a Google Calendar.
- Eventos privados: campo de nombre, validación (tipo, personas, fecha no
  pasada), conserva lo escrito y confirma el envío con un enlace de respaldo
  a WhatsApp.

**Panel**

- Catálogo de talleres completo en `/admin/talleres`: **nuevo, editar,
  activar y desactivar** (con confirmación si ya tiene reservas). El precio
  de NUMA Kids y membresía no se cambia por fecha. Lo creado o editado en el
  panel ya no lo sobrescribe la carga de la agenda (migración 16).
- `/admin/avisos` dice con honestidad el estado de cada integración (correo
  al equipo, correo a la clienta, WhatsApp, Google Calendar): funcionando,
  sin configurar, con error o simulado en la demo. Se corrigió una carrera
  que mostraba «enviado» antes de saber que se había omitido (migración 17).
- La agenda muestra «X / cupo reservados · N disponibles».

**Móvil y accesibilidad**

- Sin desborde horizontal de 320 a 1440 px (el pie de foto del portafolio
  empujaba 5 px en 320 px).
- Visor del portafolio con anterior/siguiente, flechas del teclado, deslizar
  en celular y contador «n / total».
- En todos los modales el foco no se sale con Tab y Esc cierra. Un solo h1
  por página; todo campo tiene etiqueta; toda imagen tiene alt.

**Rutas**

- Direcciones comunes llevan a su página: `/store`, `/tienda`, `/checkout`,
  `/login`, `/registro`, `/recuperar-password`, `/mi-cuenta` (y sus
  secciones), `/ubicacion`, `/kids`, `/admin/login`.

**Contenido**

- Los testimonios de ejemplo ya no se publican (solo aparecen en desarrollo):
  no se muestran reseñas inventadas.
- Mi cuenta: la membresía dice «utilizadas» y cuántas clases quedan con
  fecha reservada.

**Pruebas**

- Nuevas: Vitest (lógica y repositorio demo) y Playwright (25 recorridos del
  navegador). `npm test` (v1) volvió a pasar: su semilla caducaba con la
  fecha.
- La segunda pasada encontró un error introducido en la primera: en
  «Entrar», el candado contra doble clic quedó después de la redirección y
  React fallaba al volver a Mi cuenta tras iniciar sesión. Corregido, y se
  revisó todo `src/` con la regla *rules-of-hooks* de ESLint: sin más casos.

## Rutas verificadas

Cada una carga con contenido propio, sin errores de JavaScript, sin
`undefined`/`NaN`/`null` a la vista, y ningún enlace interno termina en 404.

- **Sitio:** `/`, `/talleres`, `/talleres/:slug`, `/membresia`,
  `/membresia/reservar`, `/numa-kids`, `/numa-kids/reservar`, `/eventos`,
  `/numa-store`, `/numa-store/:slug`, `/nosotras`, `/contacto`,
  `/aviso-de-privacidad`, `/terminos`, `/politica-de-reservaciones`,
  `/reserva/:code`, `/pago/exitoso`, `/pago/cancelado`, 404.
- **Cuenta:** `/cuenta`, `/cuenta/entrar`, `/cuenta/registro`,
  `/cuenta/recuperar`, `/cuenta/nueva-contrasena`.
- **Alias:** `/store`, `/store/:slug`, `/tienda`, `/tienda/:slug`, `/kids`,
  `/checkout`, `/login`, `/registro`, `/recuperar-password`, `/mi-cuenta`,
  `/mi-cuenta/reservas`, `/mi-cuenta/membresia`, `/mi-cuenta/perfil`,
  `/ubicacion`.
- **Panel:** `/admin`, `/admin/entrar`, `/admin/reservas`,
  `/admin/reservas/nueva`, `/admin/reservas/:id`, `/admin/calendario`,
  `/admin/talleres`, `/admin/membresias`, `/admin/clientes`,
  `/admin/pagos`, `/admin/avisos`. Sin sesión, o con cuenta de clienta, no
  se entra.

## Flujos verificados

| Flujo | Resultado |
|---|---|
| Reserva completa: taller → horario → cuenta → pago aprobado → folio `NUMA-000xx` → Mi cuenta → aparece en el panel | PASS |
| Pago rechazado: sin reserva confirmada, reintento exitoso | PASS |
| Doble clic en pagar y en crear taller: una sola operación | PASS |
| Recargar la página a media reserva conserva lo elegido | PASS |
| NUMA Kids con edad validada (10 a 14); el panel ve nombre y edad del niño | PASS |
| Membresía: exactamente 4 clases, no deja una quinta; Mi cuenta «0/4 utilizadas» | PASS |
| Eventos: valida, conserva lo escrito y abre WhatsApp con el mensaje | PASS |
| NUMA Store: pieza real, «Comprar por WhatsApp» con su nombre | PASS |
| Panel: crear, editar y desactivar un taller; el sitio lo refleja | PASS |
| Panel: reserva registrada por el equipo, pago recibido y nota interna | PASS |
| Mi cuenta sin sesión pide entrar y regresa a donde iba | PASS |
| Menú móvil, visor del portafolio y modales con teclado | PASS |
| Contra la base real (modo Supabase): catálogo del panel crear / editar / precio / desactivar e integraciones; datos de prueba borrados | PASS |

## Tests

| Prueba | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | PASS |
| Compilación | `npm run build` | PASS |
| Unitarias (Vitest) | `npm run test:unit` | PASS · 16/16 |
| Base v2 (PGlite) | `npm run test:reservas` | PASS · 131/131 |
| Base v1 (PGlite) | `npm test` | PASS · 73/73 |
| Migraciones en orden | `npm run test:migraciones` | PASS |
| Navegador (Playwright) | `npm run test:e2e` | PASS · 25/25 |

## Integraciones pendientes

Los secretos van en `dev/secretos.env` (nunca en GitHub) y se suben con
`node dev/desplegar.mjs`. Mientras falten, el sitio no se rompe: el panel lo
marca como «Sin configurar» y la demo simula.

| Integración | Preparado | Falta | Variables | Dónde se conecta |
|---|---|---|---|---|
| **Stripe** | Checkout, webhook con 4 eventos, revalidación de cupo al pagar, reembolsos desde el panel. Probado de punta a punta en modo prueba. | Activar la cuenta (datos fiscales y bancarios) y crear el webhook en modo Live. | `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_WEBHOOK_SECRET` (el del webhook Live) | `supabase/functions/create-checkout-session`, `stripe-webhook` |
| **Resend** | Correo a la clienta y «Nueva reserva Casa Numa» al equipo (`casanuma5@gmail.com`), en cola con reintentos. | Cuenta, API key y dominio verificado (DNS). Conviene usarlo también como SMTP de Supabase Auth. | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | `supabase/functions/_shared/` (correos), `process-jobs` |
| **Google Calendar** | Un evento por sesión con cupo, reservas y asistentes; se mueve, no se duplica; `encolar_calendario()` para la primera carga. | Cuenta de servicio, su llave JSON y el calendario compartido con ella. | `dev/google-calendar.json` → `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_CALENDAR_ID` | `supabase/functions/_shared/google-calendar.ts` |
| **Supabase** | Base con 17 migraciones aplicadas, RLS, Edge Functions desplegadas, panel y Mi cuenta probados con datos reales. | Publicar el sitio en modo Supabase y configurar Auth (Site URL, Redirect URLs, SMTP). | En Vercel: `VITE_FUENTE_DATOS=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `src/datos/index.ts` (elige demo o Supabase) |
| **WhatsApp API** | Aviso al equipo por la API oficial de Meta, a varios números, plantilla `aviso_reserva` (es_MX, 6 variables). Los botones de WhatsApp del sitio ya funcionan con 81 2594 5907. | App de Meta, número de WhatsApp Business, token permanente y plantilla aprobada. | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ADMIN_TO` | `supabase/functions/_shared/whatsapp.ts` |
| **Google Maps** | Dirección, mapa, «Cómo llegar» y horarios confirmados con la ficha de Google. | Nada. | `VITE_NUMA_MAPS_URL`, `VITE_NUMA_MAPS_EMBED` (opcionales; ya hay valores por defecto) | `src/config/site.ts` |

## Bloqueadores reales

Solo cosas que necesitan credenciales o una decisión de Casa Numa:

1. **Stripe Live:** activar la cuenta y pasar la `sk_live_…` y el secreto del
   webhook Live. Sin esto no se cobra de verdad.
2. **Resend:** API key y dominio verificado. Sin esto no salen los correos
   de confirmación ni el aviso al equipo por correo.
3. **Google Calendar:** llave de la cuenta de servicio e ID del calendario.
4. **WhatsApp de Meta:** token, Phone Number ID, números que reciben el aviso
   y la plantilla aprobada.
5. **Cuentas del panel** para el equipo (correo de cada persona).
6. **Decisiones de Casa Numa:**
   - ¿Se pide confirmar el correo al crear la cuenta? (hoy sí)
   - ¿Se avisa por correo a la clienta cuando el equipo registra un pago
     manual?
   - Precios de NUMA Store (hoy «Precio por mensaje»).
   - Reglas para reprogramar y política de cancelación y reembolso.
   - Fotos que faltan: Gloria y las fundadoras, la fachada y los talleres de
     temporada.
