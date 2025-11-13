import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-tests/specs',
  fullyParallel: false, // Run tests sequentially to avoid emulator conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Use single worker to avoid race conditions with emulators
  reporter: 'html',
  timeout: 60000, // 60 second timeout per test

  // Global setup and teardown
  globalSetup: require.resolve('./e2e-tests/global-setup'),
  globalTeardown: require.resolve('./e2e-tests/global-teardown'),

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start dev server before tests
  webServer: {
    command: 'cd client && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      VITE_USE_EMULATORS: 'true',
    },
  },
});
