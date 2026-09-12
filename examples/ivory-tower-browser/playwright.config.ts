import { defineConfig, devices } from '@playwright/test';

const port = process.env.IVORY_BROWSER_PORT ?? '3000';
const baseURL = process.env.IVORY_BROWSER_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './tests',
    globalSetup: './tests/global-setup.ts',
    timeout: 30_000,
    use: {
        baseURL,
        ...devices['Desktop Chrome'],
    },
});
