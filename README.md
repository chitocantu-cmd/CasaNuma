# Casa Numa

Sitio y sistema de reservas de **Casa Numa** — talleres creativos y cerámica (es-MX).

Cupos con control transaccional real, pagos verificados en el backend,
confirmación por correo y agenda administrativa en Google Calendar.

**Stack:** React + TypeScript + Vite + Tailwind · Supabase (PostgreSQL, Auth,
RLS, RPC, Edge Functions, Cron) · Stripe · Resend · Cloudinary · Vercel.

---

## Índice

1. [Local Setup](#local-setup)
2. [Supabase Setup](#supabase-setup)
3. [Database Migrations](#database-migrations)
4. [Authentication](#authentication)
5. [Admin Creation](#admin-creation)
6. [Stripe Test Setup](#stripe-test-setup)
7. [Stripe Webhooks](#stripe-webhooks)
8. [Stripe Production](#stripe-production)
9. [Cloudinary Setup](#cloudinary-setup)
10. [Resend Setup](#resend-setup)
11. [Google Calendar Setup](#google-calendar-setup)
12. [Cron Setup](#cron-setup)
13. [Environment Variables](#environment-variables)
14. [Vercel Deploy](#vercel-deploy)
15. [Pruebas](#pruebas)
16. [Production Checklist](#production-checklist)

---

## Local Setup

```bash
npm install
cp .env.example .env.local     # deja solo las VITE_* y llena los valores
npm run dev                    # http://localhost:5173
```

`npm run build` compila. `npm run typecheck` valida tipos sin compilar.

### Estructura

```
src/
  lib/supabase/client.ts   cliente con la anon key
  lib/formato.ts           fechas, dinero, cupo, WhatsApp
  lib/ics.ts               calendario del cliente (.ics)
  services/                api, workshops, reservations, forms, cloudinary
  features/
    workshops/hooks.ts     useWorkshops, useWorkshop, useTitulo
    reservations/          pantalla de estado de reserva
    admin/auth.tsx         sesión de admin y guardián de rutas
  componentes/             layout, UI, tarjeta, modal, tabla
  paginas/                 público + paginas/admin/
supabase/
  migrations/              esquema, funciones, RLS, cron
  functions/               7 Edge Functions
  seed.sql                 los 11 talleres
content/talleres.json      catálogo rescatado del demo original
demo/                      el demo estático original, como referencia
```

---

## Supabase Setup

1. Crea un proyecto en [supabase.com](https://supabase.com). Anota la región
   más cercana a México.
2. **Project Settings → General**: copia el `Project URL`
   (`https://xxxx.supabase.co`).
3. **Project Settings → API Keys**: copia la **Publishable key**
   (`sb_publishable_…`) y la **Secret key** (`sb_secret_…`).

   > Si tu proyecto es viejo verás `anon public` y `service_role` en formato
   > JWT (`eyJhbGci…`) en la pestaña *Legacy*. Funcionan igual y los nombres de
   > las variables no cambian.
   >
   > La **publishable** es pública: va en el sitio y no pasa nada. La
   > **secret** ignora el RLS por completo — solo se carga como secreto de
   > Supabase, nunca en el frontend ni en el repositorio.
4. **Database → Extensions**: habilita `pg_cron` y `pg_net`.
5. Crea un segundo proyecto para producción cuando llegue el momento. Nunca
   uses la misma base para pruebas y para cobrar de verdad.

---

## Database Migrations

Las migraciones están en `supabase/migrations/`, numeradas. **El orden importa.**

**Opción A — panel.** SQL Editor, pega cada archivo en orden y ejecútalo.

**Opción B — CLI.**

```bash
npm i -g supabase
supabase link --project-ref TU_PROJECT_REF
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

| Archivo | Contiene |
|---|---|
| `…100000_types.sql` | Extensiones, enums, `updated_at`, normalización de teléfono, generador de códigos |
| `…100100_tables.sql` | 12 tablas, constraints, índices, triggers |
| `…100200_functions.sql` | Disponibilidad, **reserva atómica**, confirmación de pago, cancelación, expiración |
| `…100300_jobs_y_consultas.sql` | Cola de integraciones, consultas, formularios, rate limit |
| `…100400_rls.sql` | RLS en todas las tablas + vista pública |
| `…100500_cron.sql` | Tres tareas programadas |
| `seed.sql` | Los 11 talleres reales |

> `…100500_cron.sql` requiere crear dos secretos en el vault **antes** de
> correrlo. El propio archivo trae las instrucciones al inicio.

---

## Authentication

Supabase Auth se usa **solo para el equipo de Casa Numa**. Los clientes reservan
sin crear cuenta: su identidad es el correo que capturan al reservar.

En **Authentication → Providers → Email**:

- Deja habilitado *Email*.
- **Desactiva "Enable sign ups"**. Si lo dejas abierto, cualquiera con un correo
  se crea cuenta. Es la puerta trasera más fácil de olvidar.

---

## Admin Creation

No hay credenciales en el código. Se crea a mano, una vez:

1. **Authentication → Users → Add user**. Correo y contraseña. Marca
   *Auto Confirm User*.
2. Copia el `User UID`.
3. En el SQL Editor:

```sql
insert into admin_profiles (user_id, name, role)
values ('PEGA-AQUI-EL-UUID', 'Nombre', 'admin');
```

Tener sesión **no basta**: hay que estar en `admin_profiles`. Esa comprobación
se hace en el navegador para la interfaz, y otra vez en el servidor para cada
acción sensible.

Entra en `/admin/login`.

---

## Stripe Test Setup

1. Crea cuenta en [stripe.com](https://stripe.com) y quédate en **modo Test**.
2. **Developers → API keys**: copia la *Secret key* (`sk_test_…`).
3. No hace falta crear productos ni precios en Stripe: **el precio se calcula
   en la base de datos** en cada compra (`workshops.price × quantity`).

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase functions deploy create-checkout-session
```

### Tarjetas de prueba

| Número | Resultado |
|---|---|
| `4242 4242 4242 4242` | Aprobado |
| `4000 0000 0000 0002` | Rechazado |
| `4000 0000 0000 9995` | Fondos insuficientes |

Cualquier fecha futura y cualquier CVV.

---

## Stripe Webhooks

Es la pieza más delicada del sistema: **la única vía por la que una reserva
llega a `confirmed`**.

1. **Developers → Webhooks → Add endpoint**
2. URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Eventos:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copia el *Signing secret* (`whsec_…`).

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase functions deploy stripe-webhook
```

### Tres cosas que hay que hacer bien

**1. Cuerpo crudo.** La firma se verifica sobre `await req.text()`, nunca sobre
JSON re-serializado. Un espacio de diferencia rompe el HMAC.

**2. `verify_jwt = false`.** Stripe no manda un JWT de Supabase. Con la
verificación activada todos los webhooks devuelven 401 y ningún pago se
confirma — y el síntoma en Stripe es solo "endpoint fallando". Ya está
configurado en `supabase/config.toml`.

**3. Idempotencia que distingue duplicado de reintento.** No basta con «ya
existe el evento → saltar»: si el registro se insertó y el procesamiento falló
después, Stripe reintenta, y ese atajo dejaría el pago sin confirmar para
siempre. Solo se salta cuando el evento ya quedó `processed`.

### Pruebas locales

```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
supabase functions serve
```

---

## Stripe Production

1. Completa la activación de la cuenta (RFC y cuenta bancaria). **Este trámite
   tarda días: empiézalo temprano.**
2. Cambia a **modo Live** y copia la nueva *Secret key* (`sk_live_…`).
3. Crea un webhook nuevo apuntando al proyecto de producción y copia su
   signing secret (es distinto al de prueba).
4. Actualiza los secretos y vuelve a desplegar.

---

## Cloudinary Setup

1. Crea cuenta en [cloudinary.com](https://cloudinary.com).
2. **Dashboard**: copia `Cloud name`, `API Key` y `API Secret`.

```bash
supabase secrets set \
  CLOUDINARY_CLOUD_NAME=... \
  CLOUDINARY_API_KEY=... \
  CLOUDINARY_API_SECRET=...
supabase functions deploy cloudinary-sign
```

**Subida firmada, no preset abierto.** Un preset *unsigned* deja que cualquiera
que lea el bundle suba lo que quiera a la cuenta de Casa Numa. Aquí el panel
pide una firma al servidor y el archivo va **directo** del navegador a
Cloudinary: no pasa por la base de datos. El `API_SECRET` nunca sale de la Edge
Function.

Las imágenes se sirven con `f_auto,q_auto,w_…` para no mandar un JPEG de 4 MB a
un teléfono.

---

## Resend Setup

1. Crea cuenta en [resend.com](https://resend.com).
2. **Domains → Add domain**: agrega los registros SPF y DKIM en tu DNS.
   **Sin dominio verificado los correos caen en spam o Resend responde 422.**
   La propagación tarda: hazlo temprano.
3. **API Keys**: crea una y cópiala.

```bash
supabase secrets set \
  RESEND_API_KEY=re_... \
  RESEND_FROM_EMAIL="Casa Numa <hola@casanuma.mx>" \
  RESEND_ADMIN_EMAIL=hola@casanuma.mx
```

Correos que manda el sistema: confirmación al cliente, aviso de reserva al
estudio, cancelación, y aviso de prospecto (contacto/membresía).

**Nunca se manda el correo de "confirmado" antes de que el pago esté
verificado.** Esos trabajos solo se encolan desde `confirmar_pago()`.

---

## Google Calendar Setup

Casa Numa tiene su propio calendario administrativo, con **un evento por
taller** (no uno por reservación: eso lo volvería ilegible).

### 1. Proyecto en Google Cloud

- [console.cloud.google.com](https://console.cloud.google.com) → **New Project**
  → nómbralo `casa-numa`.

### 2. Habilitar la API

- **APIs & Services → Library** → busca *Google Calendar API* → **Enable**.

### 3. Pantalla de consentimiento

- **APIs & Services → OAuth consent screen**
- Tipo **External**, en modo *Testing*.
- Agrega tu correo de Google en **Test users** (obligatorio en modo Testing).
- Scope: `https://www.googleapis.com/auth/calendar`

### 4. Crear el OAuth Client

- **Credentials → Create Credentials → OAuth client ID**
- Tipo: **Web application**
- *Authorized redirect URIs*: `https://developers.google.com/oauthplayground`
- Copia `Client ID` y `Client Secret`.

### 5. Obtener el refresh token

- Abre [OAuth Playground](https://developers.google.com/oauthplayground).
- Engrane (arriba derecha) → marca **Use your own OAuth credentials** → pega
  Client ID y Secret.
- Panel izquierdo: escribe `https://www.googleapis.com/auth/calendar` → **Authorize APIs**.
- Autoriza con la cuenta de Google **dueña del calendario**.
- **Exchange authorization code for tokens** → copia el `refresh_token`.

> Si no aparece refresh token, revoca el acceso de la app en
> [myaccount.google.com/permissions](https://myaccount.google.com/permissions) y
> repite: Google solo lo entrega en la primera autorización.

### 6. Crear el calendario y obtener su ID

- En Google Calendar: **+ → Crear calendario** → `CASA NUMA — TALLERES`.
- **Configuración del calendario → Integrar calendario** → copia el
  **ID de calendario** (`...@group.calendar.google.com`).
- Asegúrate de que la cuenta que autorizó tenga permiso para **hacer cambios en
  eventos**.

### 7. Cargar y probar

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID=... \
  GOOGLE_CLIENT_SECRET=... \
  GOOGLE_REFRESH_TOKEN=... \
  GOOGLE_CALENDAR_ID=...@group.calendar.google.com \
  GOOGLE_TIMEZONE=America/Monterrey
supabase functions deploy process-jobs
```

Publica un taller desde `/admin/talleres` y revisa el calendario.

### Qué hace la sincronización

| Evento | Efecto |
|---|---|
| Se publica un taller | Crea el evento, guarda `google_calendar_event_id` |
| Alguien paga | Actualiza conteo y lista de asistentes |
| Se cancela una reserva | Actualiza conteo y lista |
| Cambia horario o lugar | Mueve el **mismo** evento, no crea otro |
| Se cancela el taller | El título pasa a `CANCELADO | …` |
| Google está caído | **Nada se rompe**: se reintenta, los pagos siguen |

El worker **reconstruye la descripción completa desde la base cada vez** en vez
de aplicar cambios incrementales. Eso lo hace idempotente por construcción y
hace que N pagos seguidos colapsen en una sola llamada a Google.

**Los clientes nunca se agregan como `attendees`.** Google les mandaría
invitaciones automáticas y cada asistente vería el correo de todos los demás.

---

## Cron Setup

Tres tareas, todas en `…100500_cron.sql`.

Antes de correr esa migración, crea los dos secretos del vault:

```sql
select vault.create_secret(
  'https://TU-PROJECT-REF.supabase.co/functions/v1/process-jobs',
  'jobs_worker_url'
);
select vault.create_secret('EL-MISMO-VALOR-QUE-CRON_SECRET', 'cron_secret');
```

| Tarea | Frecuencia | Qué hace |
|---|---|---|
| `casa-numa-expirar-holds` | cada minuto | Marca `expired` los holds vencidos |
| `casa-numa-completar-talleres` | cada hora | Marca `completed` los talleres pasados |
| `casa-numa-jobs` | cada minuto | Vacía la cola: correos y calendario |

```sql
-- Verificar
select jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details
 where jobname like 'casa-numa%' order by start_time desc limit 10;
```

> **El barrido de holds es cosmético, no crítico.** `lugares_ocupados()` filtra
> por `expires_at > now()`, así que un hold vencido deja de contar en el
> instante exacto en que vence, sin que nada se ejecute. Si el cron muere, **no
> se sobrevende**: solo se ven reservas fantasma en el panel. Está diseñado así
> a propósito.

---

## Environment Variables

Ver [`.env.example`](.env.example). Resumen: **4 públicas, 15 secretas**.

Las `VITE_*` van en Vercel y quedan dentro del bundle — eso es correcto y
esperado. El resto se carga con `supabase secrets set` y **nunca** llega al
navegador.

La regla que no se rompe: `SUPABASE_SERVICE_ROLE_KEY` ignora RLS por completo.
Si aparece en el frontend, cualquiera puede descargar la lista de clientes con
sus teléfonos o poner todos los talleres en $1.

---

## Vercel Deploy

1. Importa el repositorio en [vercel.com](https://vercel.com).
2. Framework: **Vite**. Build: `npm run build`. Output: `dist`.
3. **Settings → Environment Variables**: agrega las cuatro `VITE_*`.
4. Conecta el dominio en **Settings → Domains**.
5. Actualiza `APP_URL`, `STRIPE_SUCCESS_URL` y `STRIPE_CANCEL_URL` en los
   secretos de Supabase con el dominio real, y vuelve a desplegar las funciones.

Como es una SPA con React Router, agrega `vercel.json` en la raíz si las rutas
directas devuelven 404:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

> El plan **Hobby de Vercel es para uso no comercial**. Un sitio que cobra
> talleres probablemente requiera el plan de pago: revisa sus términos.

---

## Pruebas

La lista completa, con SQL reproducible, está en
[`docs/PRUEBAS.md`](docs/PRUEBAS.md).

La más importante es la **C: dos peticiones simultáneas por el último lugar**.
No se salta por parecer improbable — es exactamente el caso que produce
sobreventa.

---

## Production Checklist

- [ ] Proyecto Supabase de producción, separado del de pruebas
- [ ] Las 6 migraciones aplicadas en orden
- [ ] `pg_cron` y `pg_net` habilitadas; las 3 tareas activas
- [ ] Secretos del vault creados (`jobs_worker_url`, `cron_secret`)
- [ ] RLS activo en todas las tablas (**Database → Advisors → Security** sin avisos)
- [ ] Verificado con la anon key: `customers`, `reservations` y `payments` devuelven vacío
- [ ] Registro público de usuarios **desactivado** en Supabase Auth
- [ ] Primer admin creado en `admin_profiles` y probado en `/admin/login`
- [ ] `service_role` confirmada fuera del bundle (búscala en el JS publicado)
- [ ] Stripe en modo Live, activación fiscal completa
- [ ] Webhook de producción registrado, con entregas exitosas
- [ ] Cloudinary configurado; una subida de prueba funciona
- [ ] Dominio de Resend verificado; prueba de entrega a Gmail y Outlook
- [ ] Google Calendar conectado; un taller publicado aparece en el calendario
- [ ] Variables en Vercel; dominio conectado con HTTPS
- [ ] Las 12 pruebas de `docs/PRUEBAS.md` ejecutadas y documentadas
- [ ] Bloque de ocupación de demostración borrado de `seed.sql`
- [ ] Cliente `demo@casanuma.local` borrado
- [ ] `site_settings` con WhatsApp, correo y dirección reales
- [ ] Talleres reales cargados con fechas y precios definitivos
- [ ] Compra real de prueba con tarjeta propia, y su reembolso
- [ ] Backups: plan Pro de Supabase, y una restauración probada
- [ ] Casa Numa sabe usar el panel: cancelar, ver pagos, atender prospectos

---

## Pendientes de contenido

No son de programación, pero bloquean el lanzamiento:

- **38 fotos** del estudio, los talleres y el equipo. Mientras no existan, el
  sitio dibuja marcadores que describen el encuadre que hace falta.
- **Datos reales** de WhatsApp, correo y dirección (van en `site_settings`).
- **Bios del equipo** y la historia real de Casa Numa.
- **Política de cancelación**, que decide qué hace el sistema con los reembolsos.
