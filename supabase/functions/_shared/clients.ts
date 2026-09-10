// ---------------------------------------------------------------------------
// Clientes y configuración compartida
// ---------------------------------------------------------------------------
// La llave service_role IGNORA por completo el Row Level Security. Solo puede
// existir aquí, en el entorno de las Edge Functions. Nunca en el código de
// React, nunca en el repositorio, nunca en una variable con prefijo VITE_
// (Vite incrusta esas en el bundle en tiempo de compilación y quedarían
// publicadas en internet).
// ---------------------------------------------------------------------------

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';

export function env(nombre: string, requerido = true): string {
  const v = Deno.env.get(nombre);
  if (!v && requerido) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v ?? '';
}

// Supabase tiene dos generaciones de llaves y ambas funcionan igual aquí:
//   · nueva  -> Secret key        (sb_secret_...)
//   · vieja  -> service_role key  (eyJhbGci...)
// Se acepta cualquiera de los dos nombres para no depender de cuál esté
// configurada en el proyecto.
export const SECRET_KEY =
  Deno.env.get('SUPABASE_SECRET_KEY') ||
  env('SUPABASE_SERVICE_ROLE_KEY');

export const db = createClient(
  env('SUPABASE_URL'),
  SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ---------------------------------------------------------------------------
// Stripe, construido PEREZOSAMENTE
// ---------------------------------------------------------------------------
// Antes se construía al cargar el módulo. Eso acoplaba funciones que no tienen
// nada que ver con pagos —create-reservation, submit-form— a que existiera la
// llave de Stripe: sin ella, el módulo lanzaba al importarse y esas funciones
// morían con un WORKER_ERROR imposible de diagnosticar desde afuera.
//
// Así, cada función solo exige las credenciales que de verdad usa.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(env('STRIPE_SECRET_KEY'), {
      // Stripe usa por omisión el cliente HTTP de Node, que no existe en Deno.
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2025-01-27.acacia',
    });
  }
  return _stripe;
}

// Deno no tiene el módulo `crypto` de Node. Stripe necesita este proveedor
// para verificar firmas de webhook de forma asíncrona.
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

export const APP_URL = Deno.env.get('APP_URL') ?? '';

// ---------------------------------------------------------------------------
// Traducción de los códigos de error de PostgreSQL a HTTP.
// Los define 20260909100200_functions.sql
// ---------------------------------------------------------------------------
export const ERRORES: Record<string, { status: number; code: string; mensaje: string }> = {
  CN001: { status: 409, code: 'INSUFFICIENT_CAPACITY',   mensaje: 'Este taller acaba de llenarse.' },
  CN002: { status: 404, code: 'WORKSHOP_NOT_AVAILABLE',  mensaje: 'Este taller ya no está disponible.' },
  CN003: { status: 400, code: 'WORKSHOP_REQUIRES_QUOTE', mensaje: 'Este taller se cotiza a la medida.' },
  CN004: { status: 400, code: 'INVALID_INPUT',           mensaje: 'Revisa tus datos, hay algo que no cuadra.' },
  CN005: { status: 404, code: 'RESERVATION_NOT_FOUND',   mensaje: 'No encontramos esa reservación.' },
  CN006: { status: 409, code: 'WORKSHOP_IN_PAST',        mensaje: 'Este taller ya ocurrió.' },
  CN007: { status: 409, code: 'RESERVATION_EXPIRED',     mensaje: 'Tu reserva expiró.' },
};

export function traducirError(error: { code?: string; details?: string; hint?: string }) {
  const conocido = ERRORES[error.code ?? ''];
  if (!conocido) return null;
  return {
    status: conocido.status,
    body: {
      error: conocido.code,
      message: conocido.mensaje,
      // Para INSUFFICIENT_CAPACITY, `details` trae los lugares disponibles.
      available: error.code === 'CN001' ? Number(error.details ?? 0) : undefined,
      detail: error.code !== 'CN001' ? (error.details ?? undefined) : undefined,
    },
  };
}

// Los logs de Edge Functions se ven en el panel de Supabase. Es toda la
// observabilidad que este proyecto necesita.
export function logError(contexto: string, error: unknown) {
  console.error(`[${contexto}]`, error instanceof Error ? error.message : error);
}
