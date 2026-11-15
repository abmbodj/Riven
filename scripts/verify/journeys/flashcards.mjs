// Flashcards: generate a deck from pasted notes with AI, then study it with spaced
// repetition. Proves generate-deck streams cards into the UI and writes deck + cards,
// and that grading in study mode writes FSRS updates and a study_sessions row.
export const meta = {
  feature: 'flashcards',
  covers: 'AI deck from pasted notes (generate-deck, streaming) -> deck view -> study with recall grading',
  doc: 'docs/features/flashcards.md',
};

const NOTES = 'Glycolysis happens in the cytoplasm. The Krebs cycle makes NADH and FADH2. ATP synthase uses the proton gradient to make ATP.';

export default async function ({ page, step, expect, signIn, sql, fakeCalls }) {
  await step('sign in as the free student', () => signIn('student'));

  let deckId;
  await step('generate a deck from pasted notes', async () => {
    await page.goto('/create');
    await page.getByRole('button', { name: /Generate from Notes/i }).click();
    await page.getByPlaceholder('Deck name').filter({ visible: true }).first().fill('Respiration (AI)');
    await page.getByPlaceholder(/Paste your notes/).fill(NOTES);
    await page.getByRole('button', { name: /Generate Flashcards/ }).click();
    await page.waitForURL(/\/deck\/\d+$/, { timeout: 60_000 });
    deckId = Number(new URL(page.url()).pathname.split('/').pop());
    await expect(page.getByText('Respiration (AI)').first()).toBeVisible();
    await expect(page.getByText("What organelle produces most of the cell's ATP?").first()).toBeVisible();
  });

  await step('deck and five cards were written; the AI was called once', async () => {
    const [deck] = await sql('select title, user_id from public.decks where id = $1', [deckId]);
    expect(deck.title).toBe('Respiration (AI)');
    const cards = await sql('select front from public.cards where deck_id = $1 order by position, id', [deckId]);
    expect(cards.length).toBe(5);
    expect(fakeCalls().filter((c) => c.route === 'openai.chat:deck.flashcards').length).toBe(1);
    const [quota] = await sql("select ai_generations_count from public.users where email = 'student@riven.test'");
    expect(quota.ai_generations_count).toBe(1);
  });

  await step('open study mode and turn on spaced repetition', async () => {
    await page.goto(`/deck/${deckId}/study`);
    await expect(page.getByText('1 / 5', { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^(Recall|Spaced Repetition) OFF$/ }).filter({ visible: true }).first().click();
    await expect(page.getByRole('button', { name: /^(Recall|Spaced Repetition) ON$/ }).filter({ visible: true }).first()).toBeVisible();
  });

  for (let i = 1; i <= 5; i++) {
    await step(`reveal and grade card ${i} as Easy`, async () => {
      await expect(page.getByText(`${i} / 5`, { exact: true })).toBeVisible();
      await expect(page.getByText('Reveal prompt', { exact: true })).toBeVisible();
      await page.keyboard.press('Space');
      await expect(page.getByText('Grade recall', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /^Easy/ }).filter({ visible: true }).first().click();
    });
  }

  await step('session completes; leave through Back to Deck (saves on exit)', async () => {
    await expect(page.getByText('Session complete')).toBeVisible();
    await page.getByRole('link', { name: 'Back to Deck' }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/deck/${deckId}$`));
  });

  await step('grades and the study session were persisted', async () => {
    await expect.poll(async () => (await sql('select count(*)::int as n from public.study_sessions where deck_id = $1', [deckId]))[0].n, { timeout: 15_000 }).toBe(1);
    const graded = await sql("select reps, card_state from public.cards where deck_id = $1 and reps > 0", [deckId]);
    expect(graded.length).toBe(5);
  });
}
