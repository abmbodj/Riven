// Journey: add a flashcard to an existing deck from the deck page.
// Proves: the Add Card modal saves, the card shows in the deck, and a `cards`
// row is inserted at the next position.
import { runJourney } from '../harness.mjs';

await runJourney('add-card', async ({ page, step, expect, writes }) => {
    await step('open the Cell Biology deck', async () => {
        await page.goto('/deck/31');
        await expect(page.getByText('What is the powerhouse of the cell?').first()).toBeVisible();
    });

    await step('open the add card modal', async () => {
        // Toolbar "+ Add" button (label text is hidden below sm, so match the visible button by text).
        await page.getByRole('button', { name: /^Add$/ }).filter({ visible: true }).first().click();
        await expect(page.getByPlaceholder('Question or term')).toBeVisible();
    });

    await step('fill and save the card', async () => {
        await page.getByPlaceholder('Question or term').fill('What organelle does photosynthesis?');
        await page.getByPlaceholder('Answer or definition').fill('The chloroplast');
        await page.getByRole('button', { name: 'Add Card' }).click();
        await expect(page.getByPlaceholder('Question or term')).toBeHidden();
    });

    await step('card is listed in the deck', async () => {
        await expect(page.getByText('What organelle does photosynthesis?').first()).toBeVisible();
    });

    await step('a cards row was inserted at position 3', async () => {
        const insert = writes.find((w) => w.table === 'cards' && w.op === 'insert');
        expect(insert, 'cards insert').toBeTruthy();
        expect(insert.rows[0]).toMatchObject({ deck_id: 31, front: 'What organelle does photosynthesis?', back: 'The chloroplast', position: 3 });
    });
});
