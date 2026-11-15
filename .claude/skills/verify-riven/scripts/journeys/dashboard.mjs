// Journey: signed-in user lands on the dashboard (Home).
// Proves: the dashboard bootstrap renders weekly stats and recent decks, and the
// Classes nav link routes to /classes. Read-only: asserts no writes happen.
import { runJourney } from '../harness.mjs';

await runJourney('dashboard', async ({ page, step, expect, writes }) => {
    await step('dashboard becomes ready', async () => {
        await page.goto('/dashboard');
        await expect(page.locator('[data-dashboard-ready="true"]')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    });

    await step('weekly summary and recent deck render from the bootstrap', async () => {
        await expect(page.getByText('86%', { exact: true })).toBeVisible();
        await expect(page.getByText('Cell Biology', { exact: true }).first()).toBeVisible();
    });

    await step('Classes nav link routes to /classes', async () => {
        await page.getByRole('link', { name: 'Classes', exact: true }).first().click();
        await expect(page).toHaveURL(/\/classes$/);
        await expect(page.getByText('Calculus', { exact: true }).first()).toBeVisible();
    });

    await step('viewing made no data writes', async () => {
        expect(writes.filter((w) => w.op === 'insert' || w.op === 'update' || w.op === 'delete')).toEqual([]);
    });
});
