const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3106', viewport: { width: 1400, height: 850 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', channel: process.env.PW_CHANNEL || 'msedge' } }],
  webServer: { command: 'node server.js', url: 'http://127.0.0.1:3106', env: { PORT: '3106', AUTH0_TEST_MODE: 'true' }, reuseExistingServer: false }
});
