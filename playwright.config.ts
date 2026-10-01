import { defineConfig, devices } from '@playwright/test';

/**
 * E2E berjalan terhadap BUILD PRODUKSI (`vite preview`) di port sendiri (default 4173):
 * tidak bentrok dengan dev server yang sedang dipakai bermain, tanpa HMR/optimasi dependensi
 * yang bisa me-reload halaman, dan sama dengan yang dipakai saat deploy.
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: './e2e',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1366, height: 860 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // WebGL perangkat lunak agar scene 3D dapat dirender di lingkungan tanpa GPU (CI).
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
