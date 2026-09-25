import { defineConfig, devices } from '@playwright/test';

// Recorridos de punta a punta en el navegador (Playwright), sobre la demo.
//   npm run test:e2e
// Levanta su propio servidor en el puerto 5175 y usa el Chrome instalado
// (channel: 'chrome'): no descarga navegadores.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5175',
    channel: 'chrome',
    locale: 'es-MX',
    timezoneId: 'America/Monterrey',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'npx vite --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_FUENTE_DATOS: 'demo' },
  },
});
