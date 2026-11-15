// YouTube import: paste a video link, generate notes and flashcards from its
// transcript. Proves the background job pipeline end to end: create-ai-job ->
// run-ai-job (youtube_source, youtube_notes, youtube_deck) -> transcript fetch
// (transcriptapi fake) -> ai_jobs rows updated -> Realtime pushes progress to the page.
export const meta = {
  feature: 'youtube-import',
  covers: 'YouTube URL -> Notes + Flashcards via ai_jobs (create-ai-job/run-ai-job) with Realtime progress',
  doc: 'docs/features/youtube-import.md',
};

const VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

export default async function ({ page, step, expect, signIn, sql, fakeCalls }) {
  await step('sign in as the free student', () => signIn('student'));

  await step('paste a video link and pick Notes + Flashcards', async () => {
    await page.goto('/youtube');
    await page.getByPlaceholder('https://www.youtube.com/watch?v=...').fill(VIDEO);
    await page.getByPlaceholder('Custom title (optional)').fill('Cell energy video');
    for (const label of ['Notes', 'Flashcards']) {
      const option = page.getByRole('button', { name: new RegExp(`^${label}`) }).filter({ visible: true }).first();
      if ((await option.getAttribute('aria-pressed')) !== 'true') await option.click();
    }
  });

  await step('generate and wait for both results', async () => {
    await page.getByRole('button', { name: /^Generate \d/ }).filter({ visible: true }).first().click();
    await expect.poll(async () => (await sql("select count(*)::int as n from public.ai_jobs where status = 'completed' and kind in ('youtube_notes', 'youtube_deck')"))[0].n, { timeout: 120_000 }).toBe(2);
    await expect(page.getByText(/Open|View/).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
  });

  await step('a youtube note and a deck were written; the transcript came from the fake', async () => {
    const notes = await sql("select title from public.notes where source_type = 'youtube'");
    expect(notes.length).toBe(1);
    const decks = await sql("select d.id, count(c.id)::int as cards from public.decks d join public.cards c on c.deck_id = d.id where d.id <> 1001 group by d.id");
    expect(decks.length).toBe(1);
    expect(decks[0].cards).toBeGreaterThan(0);
    expect(fakeCalls().some((c) => c.route === 'transcriptapi.youtube')).toBe(true);
    const failed = await sql("select kind, error_payload from public.ai_jobs where status = 'failed'");
    expect(failed).toEqual([]);
  });
}
