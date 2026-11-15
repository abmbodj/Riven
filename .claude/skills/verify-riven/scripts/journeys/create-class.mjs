// Journey: create a class manually from /classes.
// Proves: the Add class form submits, the new class appears in the list, and a
// `classes` row is inserted for the signed-in user with the typed fields.
import { runJourney } from '../harness.mjs';

await runJourney('create-class', async ({ page, step, expect, writes }) => {
    await step('open classes list', async () => {
        await page.goto('/classes');
        await expect(page.getByText('Biology', { exact: true }).first()).toBeVisible();
    });

    await step('open the add class form', async () => {
        await page.getByRole('button', { name: 'Add class' }).click();
        await expect(page.getByPlaceholder('e.g. CS 101')).toBeVisible();
    });

    await step('fill and submit the class', async () => {
        await page.getByPlaceholder('e.g. CS 101').fill('Organic Chemistry');
        await page.getByPlaceholder('Dr. Smith').fill('Dr. Okafor');
        await page.getByRole('button', { name: 'Create Class' }).click();
        await expect(page.getByPlaceholder('e.g. CS 101')).toBeHidden();
    });

    await step('new class is listed', async () => {
        await expect(page.getByText('Organic Chemistry', { exact: true }).first()).toBeVisible();
    });

    await step('a classes row was inserted for user 7', async () => {
        const insert = writes.find((w) => w.table === 'classes' && w.op === 'insert');
        expect(insert, 'classes insert').toBeTruthy();
        expect(insert.rows[0]).toMatchObject({ user_id: 7, name: 'Organic Chemistry', professor: 'Dr. Okafor' });
    });
});
