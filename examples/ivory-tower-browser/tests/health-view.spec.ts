import { expect, test } from '@playwright/test';

test('loads the minimal health view and reports readiness', async ({ page }) => {
    await page.goto('/');
    const health = page.locator('.ivory-tower-health');
    await expect(health).toBeVisible();
    await expect(health.locator('h1')).toHaveText('Ivory Tower');
    await expect(health.locator('p').first()).toContainText(/Status: (ok|degraded|unavailable)/);
    await expect(health).toContainText(/Ivory Tower (runtime is ready|runtime is not ready|readiness could not be checked)/);

    const scripts = await page.locator('script[src]').evaluateAll(elements => elements.map(element => (element as HTMLScriptElement).src));
    for (const script of scripts) {
        const source = await page.evaluate(async url => fetch(url).then(response => response.text()), script);
        expect(source).not.toContain('liquidify-react');
    }
});
