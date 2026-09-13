import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 60000,
    workers: 1,
    outputDir: '../../artifacts/n5/browser',
    use: {
        baseURL: 'http://127.0.0.1:3107',
        browserName: 'chromium',
        channel: 'msedge',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run start',
        url: 'http://127.0.0.1:3107',
        reuseExistingServer: false,
        timeout: 120000,
    },
});
