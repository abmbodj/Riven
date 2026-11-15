// Audio to notes: record a lecture in a new note (Chromium's fake microphone), see the
// live transcript stream in, stop, then Enhance to turn the recording into notes.
// Proves: transcription-token -> Deepgram live (browser WebSocket fake) -> transcript
// segments saved; chunks uploaded to Storage; stop -> Enhance -> note_enhancement job
// (create-ai-job/run-ai-job, Deepgram batch + OpenAI fakes) -> enhanced note content.
export const meta = {
  feature: 'audio-to-notes',
  covers: 'New note -> Record lecture (live transcript) -> Stop -> Enhance (note_enhancement job) -> enhanced notes',
  doc: 'docs/features/audio-to-notes.md',
};

export default async function ({ page, step, expect, signIn, sql, fakeCalls, deepgramLive }) {
  await step('sign in as the free student', () => signIn('student'));

  let noteId;
  await step('create a new note', async () => {
    await page.goto('/note/new');
    await expect(page.getByRole('button', { name: 'Record lecture' }).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
  });

  await step('start recording; the live transcript streams in', async () => {
    await page.getByRole('button', { name: 'Record lecture' }).filter({ visible: true }).first().click();
    await expect(page.getByRole('button', { name: /^Stop recording/ }).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Glycolysis happens in the cytoplasm/).first()).toBeVisible({ timeout: 30_000 });
    await page.waitForURL(/\/note\/[0-9a-f-]{36}/, { timeout: 15_000 }).catch(() => {});
  });

  await step('stop recording', async () => {
    await page.waitForTimeout(2_000); // let a few more audio chunks upload
    await page.getByRole('button', { name: /^Stop recording/ }).filter({ visible: true }).first().click();
    await expect(page.getByRole('button', { name: 'Enhance' }).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
    noteId = new URL(page.url()).pathname.split('/').pop();
  });

  await step('recording session, chunks and transcript were saved', async () => {
    await expect.poll(async () => (await sql('select state from public.recording_sessions where note_id = $1', [noteId]))[0]?.state, { timeout: 30_000 }).toBe('stopped');
    const [session] = await sql('select id, state, manifest_chunk_count from public.recording_sessions where note_id = $1', [noteId]);
    expect(session.manifest_chunk_count).toBeGreaterThan(0);
    const [segments] = await sql('select count(*)::int as n from public.transcript_segments where session_id = $1', [session.id]);
    expect(segments.n).toBeGreaterThan(0);
    const [objects] = await sql("select count(*)::int as n from storage.objects where bucket_id = 'recording-chunks'");
    expect(objects.n).toBeGreaterThan(0);
    expect(deepgramLive.results).toBeGreaterThan(0);
  });

  await step('Enhance turns the recording into structured notes', async () => {
    await page.getByRole('button', { name: 'Enhance' }).filter({ visible: true }).first().click();
    await expect.poll(async () => (await sql("select status from public.ai_jobs where kind = 'note_enhancement' order by created_at desc limit 1"))[0]?.status, { timeout: 120_000 }).toBe('completed');
    await expect(page.getByText(/ATP synthase uses the gradient to make ATP/).first()).toBeVisible({ timeout: 30_000 });
  });

  await step('the note content was replaced by the enhanced document', async () => {
    const [note] = await sql('select content::text as content, source_type from public.notes where id = $1', [noteId]);
    expect(note.content).toContain('Cellular respiration');
    const routes = fakeCalls().map((c) => c.route);
    expect(routes.some((r) => r.startsWith('openai.chat:notes.'))).toBe(true);
  });
}
