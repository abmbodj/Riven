// Journey: study a flashcard deck with spaced repetition and grade every card.
// Proves: cards render front->back, each grade writes an FSRS update to `cards`,
// and finishing writes a `study_sessions` row and stamps `decks.last_studied`.
import { runJourney } from '../harness.mjs';

await runJourney('study-deck', async ({ page, step, expect, writes }) => {
    await step('open study mode for Cell Biology', async () => {
        await page.goto('/deck/31/study');
        await expect(page.getByText('1 / 3', { exact: true })).toBeVisible();
        await expect(page.getByText('What is the powerhouse of the cell?').first()).toBeVisible();
    });

    await step('turn on spaced repetition', async () => {
        // Desktop (>= xl) shows "Recall OFF/ON"; below xl the control reads "Spaced Repetition OFF/ON".
        await page.getByRole('button', { name: /^(Recall|Spaced Repetition) OFF$/ }).filter({ visible: true }).first().click();
        await expect(page.getByRole('button', { name: /^(Recall|Spaced Repetition) ON$/ }).filter({ visible: true }).first()).toBeVisible();
    });

    const answers = ['The mitochondrion', 'Proteins', 'The plasma membrane'];
    for (const [i, answer] of answers.entries()) {
        await step(`reveal and grade card ${i + 1} as Easy`, async () => {
            // Wait for the previous card's transition to settle; flips during a transition are ignored.
            await expect(page.getByText(`${i + 1} / 3`, { exact: true })).toBeVisible();
            await expect(page.getByText('Reveal prompt', { exact: true })).toBeVisible();
            await page.keyboard.press('Space');
            // Phase label flips to "Grade recall" only once the answer side is showing.
            await expect(page.getByText('Grade recall', { exact: true })).toBeVisible();
            await expect(page.getByText(answer).filter({ visible: true }).first()).toBeVisible();
            await page.getByRole('button', { name: /^Easy/ }).filter({ visible: true }).first().click();
        });
    }

    await step('session completes', async () => {
        await expect(page.getByText('Session complete')).toBeVisible();
        await expect(page.getByText(/3\/3 correct/)).toBeVisible();
    });

    await step('leave study mode (session is saved on exit)', async () => {
        await page.getByRole('link', { name: 'Back to Deck' }).filter({ visible: true }).first().click();
        await expect(page).toHaveURL(/\/deck\/31$/);
    });

    await step('side effects were written to Supabase', async () => {
        await expect.poll(() => writes.filter((w) => w.table === 'study_sessions' && w.op === 'insert').length).toBe(1);
        const graded = writes.filter((w) => w.table === 'cards' && w.op === 'update');
        expect(graded.length).toBe(3);
        for (const w of graded) expect(w.patch).toMatchObject({ card_state: 'review', reps: 1, next_review: expect.any(String) });
        const session = writes.find((w) => w.table === 'study_sessions').rows[0];
        expect(session).toMatchObject({ deck_id: 31, cards_studied: 3, cards_correct: 3 });
        expect(writes.some((w) => w.table === 'decks' && w.op === 'update' && w.patch.last_studied)).toBe(true);
    });
});
