-- ============================================================================
-- Casa Numa · 01 · Extensiones, enums y utilidades
-- ============================================================================

create extension if not exists citext;

-- gen_random_uuid() esta en el core de PostgreSQL desde la version 13, asi que
-- pgcrypto no hace falta. Pedirla de mas solo agrega un requisito que puede no
-- estar disponible en todos los entornos.

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'workshop_status') then
    create type workshop_status as enum ('draft', 'published', 'cancelled', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type reservation_status as enum (
      'pending_payment', 'confirmed', 'expired', 'cancelled', 'refunded'
    );
  end if;

  -- 'paid' es el estado interno de pago. La reserva NO tiene un estado 'paid'
  -- separado de 'confirmed': el dinero vive en payments, la reserva vive en
  -- reservations. Un solo hecho, un solo lugar.
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum (
      'pending', 'paid', 'failed', 'cancelled', 'refunded'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type lead_status as enum ('new', 'contacted', 'converted', 'discarded');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_type') then
    create type job_type as enum ('calendar_sync', 'email_send');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('pending', 'processing', 'done', 'failed');
  end if;
end
$$;


-- ----------------------------------------------------------------------------
-- Trigger común de updated_at
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- Normalización de contacto
-- ----------------------------------------------------------------------------
-- Evita clientes duplicados por diferencias cosméticas. "81 1234 5678",
-- "+52 81 1234 5678" y "8112345678" son la misma persona.
--
-- Se guarda en E.164 (+52...) porque es lo que necesita el enlace de wa.me,
-- y porque comparar cadenas con formato libre garantiza duplicados.
-- ----------------------------------------------------------------------------
create or replace function normalizar_telefono(p_telefono text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if p_telefono is null then return null; end if;

  d := regexp_replace(p_telefono, '\D', '', 'g');
  if d = '' then return null; end if;

  -- 10 dígitos: número nacional mexicano.
  if length(d) = 10 then
    return '+52' || d;
  end if;

  -- 52 + 10 dígitos: ya trae lada de país.
  if length(d) = 12 and left(d, 2) = '52' then
    return '+' || d;
  end if;

  -- 521 + 10 dígitos: formato viejo de móvil mexicano.
  if length(d) = 13 and left(d, 3) = '521' then
    return '+52' || right(d, 10);
  end if;

  -- Cualquier otro caso: se conserva tal cual con prefijo, sin inventar.
  return '+' || d;
end;
$$;


-- ----------------------------------------------------------------------------
-- Código de reservación: NUMA-XXXXXX
-- ----------------------------------------------------------------------------
-- Alfabeto sin caracteres ambiguos (sin 0/O, sin 1/I/L). Estos códigos se
-- dictan por WhatsApp y por teléfono; confundir un 0 con una O es un problema
-- real de operación, no teórico.
--
-- Nunca se le muestra el UUID al cliente.
-- ----------------------------------------------------------------------------
create or replace function generar_reservation_code()
returns text
language plpgsql
volatile
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidato text;
  i int;
begin
  loop
    candidato := 'NUMA-';
    for i in 1..6 loop
      candidato := candidato ||
        substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (
      select 1 from reservations where reservation_code = candidato
    );
  end loop;
  return candidato;
end;
$$;
