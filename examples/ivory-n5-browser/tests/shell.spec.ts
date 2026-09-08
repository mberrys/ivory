import { expect, test } from '@playwright/test';

// Shell smoke only. Never reports research equivalence or language qualification.
test('N5 exposes the prerequisite block and command-backed execution controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'N5 research client', exact: true })).toBeVisible();
    for (const name of ['Open project', 'Resolve citation', 'Request run', 'Submit edit']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
    }
    await page.getByRole('button', { name: 'Read status', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Enter an execution ID' })).toBeVisible();
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'disconnected' })).toBeVisible();
});
