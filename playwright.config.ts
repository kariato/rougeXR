import { defineConfig, devices } from '@playwright/test';

const pages = process.env.ROUGEXR_TEST_PAGES === '1';

export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: true,
  reporter: 'line',
  use: { baseURL: pages ? 'http://127.0.0.1:4173/rougeXR/' : 'http://127.0.0.1:4173', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
  webServer: { command: pages ? 'GITHUB_PAGES=true npx vite preview --host 127.0.0.1 --port 4173' : 'npm run dev -- --port 4173', url: pages ? 'http://127.0.0.1:4173/rougeXR/' : 'http://127.0.0.1:4173', reuseExistingServer: false },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], deviceScaleFactor: 2 } },
  ],
});
