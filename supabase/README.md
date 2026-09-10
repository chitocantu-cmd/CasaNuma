# Backend de Casa Numa

Esquema, seguridad, lógica transaccional y las funciones de pago.

| Fase | Qué cubre | Dónde |
|---|---|---|
| **2** | Base de datos, RLS, control de cupo | este archivo |
| **5 y 6** | Edge Functions: reserva, pago y webhook | [`functions/README.md`](functions/README.md) |
| **7** | Worker de la cola y correos | [`functions/README.md`](functions/README.md) |

Pendientes: pantalla de estado (8), Google Calendar (9), panel (11–12).

---

# Fase 2 — Base de datos

La fundación: todo lo demás se apoya aquí. El esquema es el mismo haya o no
código fuente del frontend, y sea Stripe o Mercado Pago el proveedor.

## Archivos

| Archivo | Qué hace |
|---|---|
| `migrations/20260908120000_schema.sql` | Tablas, constraints, índices |
| `migrations/20260908120100_functions.sql` | Las funciones transaccionales. **El control de cupo vive aquí** |
| `migrations/20260908120200_rls.sql` | Row Level Security y la vista pública |
| `migrations/20260908120300_cron.sql` | Barrido de holds vencidos |
| `migrations/20260908120400_worker.sql` | Reparto de la cola (Fase 7) |
| `migrations/20260908120500_cron_worker.sql` | Disparo del worker (Fase 7) |
| `seed.sql` | Los 11 talleres reales, rescatados del bundle |

`../content/talleres.json` es el catálogo completo extraído del demo
(descripciones, FAQs, incluye, crearás, galerías). Sirve para este seed y
también para reconstruir el frontend si hace falta.

## Cómo aplicarlo

**Opción A — panel de Supabase.** Abre el SQL Editor y pega cada archivo en
orden, uno por uno. Es lo más simple para la primera vez.

**Opción B — CLI.** Requiere instalar `supabase`:

```bash
supabase link --project-ref TU_PROJECT_REF
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

El orden importa: `schema` → `functions` → `rls` → `cron` → `seed`.

> `pg_cron` puede requerir habilitarse antes desde
> **Database → Extensions**. Si el archivo de cron falla por permisos, actívala
> ahí y vuelve a correrlo.

## Verificación

Estas consultas confirman que la fase quedó bien. Córrelas en el SQL Editor.

### 1. El catálogo cargó

```sql
select slug, capacity, price_cents, booking_mode,
       capacity - lugares_ocupados(id) as disponibles
  from workshops order by date;
```

Esperado: 11 filas. `noche-de-barro` con 2 disponibles,
`ceramica-tematica-septiembre` con 0, `piezas-personalizadas` con
`booking_mode = 'quote'`.

### 2. El público no ve nada que no deba

Con la **anon key** (no la de servicio), desde la consola del navegador o curl:

```bash
# Debe devolver 11 talleres con seats_available
curl "$SUPABASE_URL/rest/v1/public_workshops?select=slug,seats_available" \
  -H "apikey: $ANON_KEY"

# Deben devolver [] o error de permisos — NUNCA datos
curl "$SUPABASE_URL/rest/v1/customers"    -H "apikey: $ANON_KEY"
curl "$SUPABASE_URL/rest/v1/reservations" -H "apikey: $ANON_KEY"
curl "$SUPABASE_URL/rest/v1/payments"     -H "apikey: $ANON_KEY"
```

### 3. El linter no reporta tablas sin RLS

**Database → Advisors → Security.** No debe haber advertencias de
`rls_disabled_in_public`.

### 4. Una reserva se crea y descuenta cupo

```sql
select crear_reserva(
  'noche-de-barro', 2,
  'Fernanda Prueba', 'fernanda@ejemplo.com', '8112345678'
);

-- Ahora debe decir 0
select capacity - lugares_ocupados(id) from workshops
 where slug = 'noche-de-barro';
```

### 5. El cupo se respeta

```sql
-- Debe fallar con CUPO_INSUFICIENTE (SQLSTATE CN001)
select crear_reserva(
  'ceramica-tematica-septiembre', 1,
  'Nadie', 'nadie@ejemplo.com', '8112345678'
);
```

### 6. Un taller cotizable no entra al flujo de pago

```sql
-- Debe fallar con TALLER_REQUIERE_COTIZACION (CN003).
-- Esto es lo que impide que alguien quede confirmado pagando $0.
select crear_reserva(
  'piezas-personalizadas', 1,
  'Nadie', 'nadie@ejemplo.com', '8112345678'
);
```

### 7. El precio no se puede manipular

`crear_reserva` no recibe precio: lo lee de `workshops` dentro de la misma
transacción. No hay ningún parámetro que un cliente malicioso pueda alterar.

### 8. Confirmar dos veces no duplica nada

```sql
select confirmar_reserva_pagada(
  '<reservation_id>', 'stripe', 'pi_prueba_1', 'cs_prueba_1', 130000);
-- 'confirmada'

select confirmar_reserva_pagada(
  '<reservation_id>', 'stripe', 'pi_prueba_1', 'cs_prueba_1', 130000);
-- 'ya_confirmada'  <- sin efectos secundarios

select kind, count(*) from outbox group by kind;
-- un solo email_confirmacion
```

### 9. La prueba de concurrencia — la más importante

Requiere dos sesiones SQL simultáneas. Deja `noche-de-barro` con 2 lugares
libres y corre en ambas, al mismo tiempo, una petición de 2 lugares.

**Exactamente una debe tener éxito.** La otra debe fallar con `CN001`.

Repítelo unas diez veces: las condiciones de carrera son intermitentes por
naturaleza, y una sola pasada exitosa no prueba nada.

## Decisiones de diseño que conviene conocer

**No existe `workshops.reserved`.** El demo tenía un contador guardado. Un
contador se desincroniza tarde o temprano —una cancelación que no lo baja, un
error que lo sube dos veces— y cuando eso pasa se sobrevende sin que nadie se
entere. La ocupación se calcula siempre desde `reservations`.

**El hold vencido se libera solo.** `lugares_ocupados()` filtra por
`hold_expires_at > now()`, así que el lugar queda disponible en el instante
exacto del vencimiento. El cron solo cambia la etiqueta para que el panel no
muestre reservas fantasma. **Si el cron muere, no se sobrevende.**

**Hold de 35 minutos, sesión de pago de 31.** El demo usaba 15. Stripe Checkout
no permite sesiones que expiren en menos de 30 minutos, así que un hold de 15
dejaría una ventana en la que alguien puede pagar un lugar ya liberado. Se
hace que el hold dure **más** que la sesión, no lo mismo: así la sesión siempre
caduca primero y la ventana no existe ni con desfases de reloj. Aun así,
`confirmar_reserva_pagada` revalida el cupo como red de seguridad.

**Códigos sin caracteres ambiguos.** El demo usaba hexadecimal, que incluye 0
y 1. Estos códigos se dictan por WhatsApp y por teléfono, así que el alfabeto
excluye `0/O` y `1/I/L`.

**Ningún dato de tarjeta, nunca.** `payments` solo guarda identificadores
opacos del proveedor. Ni los últimos 4 dígitos.

## Antes de producción

- [ ] Borrar el bloque de ocupación de demostración del final de `seed.sql`
      (las reservas con nota "Borrar antes de produccion")
- [ ] Borrar el cliente `demo@casanuma.local`
- [ ] Cargar fechas y precios reales de los talleres
- [ ] Llenar `site_settings` (hoy el sitio tiene `[PENDIENTE: WhatsApp]` escrito
      dentro del código)
- [ ] Crear el primer registro en `admin_users`
