import { defineConfig, mergeConfig } from 'vitest/config';
import vite from './vite.config';

// Pruebas de lógica (Vitest). Las de la base (supabase/tests/*.mjs) y las de
// navegador (e2e/, Playwright) corren aparte.
export default mergeConfig(
  vite,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
      testTimeout: 30_000,
    },
  }),
);
