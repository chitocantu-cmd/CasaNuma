# Pruebas obligatorias

Ninguna se salta. Documenta el resultado de cada una antes de producción.

El seed deja dos escenarios listos:

- `noche-de-barro` — 16 de capacidad, 14 confirmados → **quedan 2**
- `ceramica-tematica-septiembre` — 10 de 10 → **lleno**

---

## TEST A · Reserva normal y confirmación

**Estado inicial:** capacidad 10, 8 confirmados.

```sql
-- Preparar
update workshops set capacity = 10 where slug = 'ceramica-desde-cero';
select capacity - lugares_ocupados(id) from workshops
 where slug = 'ceramica-desde-cero';   -- debe dar 2 (con 8 confirmados)

-- Crear hold de 2
select crear_reserva('ceramica-desde-cero', 2,
  'Ana Prueba', 'ana@ejemplo.com', '8112345678');

select disponibilidad(id) from workshops where slug = 'ceramica-desde-cero';
```

**Esperado:** `available: 0`, `holds: 2`. Tras el pago, `confirmed: 10`,
`holds: 0`, `available: 0`.

---

## TEST B · Rechazo por cupo insuficiente

**Estado inicial:** capacidad 10, 9 ocupados. Se piden 2.

```sql
select crear_reserva('ceramica-tematica-septiembre', 2,
  'Nadie', 'nadie@ejemplo.com', '8112345678');
```

**Esperado:** error `INSUFFICIENT_CAPACITY`, SQLSTATE `CN001`, con `DETAIL` = los
lugares que quedan. **No se inserta ninguna reserva.**

```sql
select count(*) from reservations where customer_id in
  (select id from customers where email = 'nadie@ejemplo.com');  -- 0
```

---

## TEST C · Concurrencia — la más importante

**Dos peticiones simultáneas por el último lugar. Solo una debe ganar.**

Deja `noche-de-barro` con 1 lugar libre y corre:

```bash
SLUG=noche-de-barro
URL="$SUPABASE_URL/functions/v1/create-reservation"

for i in 1 2; do
  curl -s -X POST "$URL" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"slug\":\"$SLUG\",\"quantity\":1,\"full_name\":\"P$i\",\"email\":\"p$i@ejemplo.com\",\"phone\":\"811234567$i\"}" &
done
wait
```

**Esperado:** exactamente una respuesta con `reservation_code`, y una con
`INSUFFICIENT_CAPACITY`.

**Repítelo diez veces.** Las condiciones de carrera son intermitentes por
naturaleza: una sola pasada exitosa no prueba nada.

Verificación directa en SQL, con dos sesiones abiertas a la vez:

```sql
-- Sesión 1                        -- Sesión 2 (al mismo tiempo)
begin;                             begin;
select crear_reserva(...);         select crear_reserva(...);
commit;                            commit;
```

La segunda debe bloquearse en el `for update` y fallar al desbloquearse.

---

## TEST D · Expiración del hold

```sql
-- Crear un hold que vence en 1 minuto
select crear_reserva('esmaltes-y-color', 2,
  'Temp', 'temp@ejemplo.com', '8112345678', null, null, 1);

select disponibilidad(id) from workshops where slug = 'esmaltes-y-color';
-- holds: 2
```

Espera 61 segundos:

```sql
select disponibilidad(id) from workshops where slug = 'esmaltes-y-color';
-- holds: 0  <- sin que corra el cron
```

**El punto de esta prueba:** el cupo se libera por la fórmula
(`expires_at > now()`), no por el cron. El barrido solo cambia la etiqueta:

```sql
select expirar_holds();
select status from reservations where customer_id in
  (select id from customers where email = 'temp@ejemplo.com');  -- expired
```

---

## TEST E · Pago exitoso completo

Reserva desde el sitio y paga con `4242 4242 4242 4242`.

```sql
select r.status, p.status as pago, r.confirmed_at
  from reservations r left join payments p on p.reservation_id = r.id
 where r.reservation_code = 'NUMA-XXXXXX';
```

**Esperado:** reserva `confirmed`, pago `paid`, `confirmed_at` con valor.
Correo recibido. Evento de Google Calendar actualizado.

---

## TEST F · Entrar a success sin pagar

Abre `/pago/exitoso?code=NUMA-XXXXXX` de una reserva `pending_payment`.

**Esperado:** la pantalla dice *«Estamos confirmando tu pago»* y **nunca**
cambia a confirmado. La reserva sigue `pending_payment` en la base.

Llegar a esa URL no prueba nada: solo el webhook firmado confirma.

---

## TEST G · Webhook duplicado

En Stripe → **Webhooks → el endpoint → un evento → Resend**.

```sql
select count(*) from integration_jobs
 where entity_id = 'RESERVATION-UUID' and type = 'email_send';
-- 2 (confirmación + aviso admin), NO 4

select count(*) from payments where reservation_id = 'RESERVATION-UUID';
-- 1
```

**Esperado:** la segunda entrega responde `{"duplicate": true}`. Un solo correo,
un solo pago, un solo evento de calendario.

---

## TEST H · Precio manipulado desde DevTools

En el modal, antes de enviar, cambia el precio en el estado de React o
intercepta la petición y agrega `"price": 1`.

**Esperado:** Stripe cobra el precio real de la base. La API de
`create-reservation` **no tiene ningún parámetro de precio**, y
`create-checkout-session` solo recibe `reservation_id`.

```sql
select unit_price, total_amount from reservations
 where reservation_code = 'NUMA-XXXXXX';
-- el precio del taller, no el manipulado
```

---

## TEST I · Google Calendar caído

Rompe la credencial a propósito:

```bash
supabase secrets set GOOGLE_REFRESH_TOKEN=invalido
```

Haz un pago completo.

**Esperado:** la reserva queda `confirmed` y el pago `paid`. El correo llega.
El trabajo de calendario queda registrado para reintento:

```sql
select type, status, attempts, last_error from integration_jobs
 where type = 'calendar_sync' order by created_at desc limit 3;
```

Restaura la credencial y usa **Reintentar** desde el panel: el evento se crea.

---

## TEST J · Resend caído

```bash
supabase secrets set RESEND_API_KEY=invalido
```

Haz un pago completo.

**Esperado:** reserva `confirmed` igual. El trabajo de correo queda `pending` y
luego `failed` tras 5 intentos, visible en la tarjeta de alertas del panel.
**Ningún pago se pierde por una caída del proveedor de correo.**

---

## TEST K · Cancelación

Desde `/admin/reservaciones`, cancela una reserva confirmada.

```sql
select disponibilidad(id) from workshops where slug = '...';
```

**Esperado:** `available` sube en la cantidad cancelada. El evento de calendario
se actualiza. El cliente recibe correo. El panel advirtió que **no** se hace
reembolso en Stripe.

---

## TEST L · Acceso público bloqueado

Con la **anon key** (nunca la de servicio):

```bash
curl "$SUPABASE_URL/rest/v1/public_workshops?select=slug,seats_available" \
  -H "apikey: $ANON_KEY"          # 11 talleres — OK

curl "$SUPABASE_URL/rest/v1/customers"    -H "apikey: $ANON_KEY"   # vacío/403
curl "$SUPABASE_URL/rest/v1/reservations" -H "apikey: $ANON_KEY"   # vacío/403
curl "$SUPABASE_URL/rest/v1/payments"     -H "apikey: $ANON_KEY"   # vacío/403
curl "$SUPABASE_URL/rest/v1/contact_leads" -H "apikey: $ANON_KEY"  # vacío/403
```

Y en el navegador: `/admin` sin sesión redirige a `/admin/login`. Una cuenta
que exista pero no esté en `admin_profiles` ve el aviso de sin permisos.

Además: **Database → Advisors → Security** no debe reportar
`rls_disabled_in_public`.

---

## Casos extra que conviene cubrir

| Caso | Esperado |
|---|---|
| Taller cotizable (`piezas-personalizadas`) | `WORKSHOP_REQUIRES_QUOTE`; manda a contacto |
| Taller con fecha pasada | `WORKSHOP_IN_PAST` |
| Reserva expirada, luego llega el pago | Pago `paid` + `needs_review`; la reserva **no** se confirma |
| Cambio de precio con reservas confirmadas | Las anteriores conservan su `unit_price` |
| Bajar capacidad por debajo de lo vendido | Rechazado por la interfaz |
| Formulario con honeypot lleno | Responde 200 sin guardar nada |
| 6 envíos de formulario desde la misma IP | El sexto responde 429 |

---

## Después de cada prueba

Deja la base limpia:

```sql
delete from reservations where customer_id in (
  select id from customers where email like '%@ejemplo.com'
);
delete from customers where email like '%@ejemplo.com';
```
