// AI tutor: create a River tutor session from a saved note, then open it.
// Proves generate-guide runs the two-phase pipeline (skeleton -> per-card teaching)
// and writes a study_guides row the GuideView can render.
export const meta = {
  feature: 'ai-tutor',
  covers: 'Create tutor session from a note (generate-guide: skeleton + teaching) -> lecture -> ask River (tutor-chat) -> answer a card (grade-tutor-answer)',
  doc: 'docs/features/ai-tutor.md',
};

export default async function ({ page, step, expect, signIn, sql, fakeCalls }) {
  await step('sign in as the free student', () => signIn('student'));

  await step('open Create Tutor Session', async () => {
    await page.goto('/guides');
    await page.getByRole('button', { name: 'Create tutor session' }).filter({ visible: true }).first().click();
    await expect(page.getByRole('dialog', { name: 'Create Tutor Session' })).toBeVisible();
  });

  let guideId;
  await step('pick the lecture note and generate', async () => {
    const dialog = page.getByRole('dialog', { name: 'Create Tutor Session' });
    await dialog.getByRole('button', { name: /From notes/ }).click();
    await dialog.getByRole('button', { name: /Lecture 5: Cellular respiration/ }).click();
    await dialog.getByRole('button', { name: /Continue/ }).click();
    await dialog.getByRole('button', { name: /Generate session/ }).click();
    await page.waitForURL(/\/guide\/[0-9a-f-]{36}$/, { timeout: 90_000 });
    guideId = new URL(page.url()).pathname.split('/').pop();
  });

  await step('guide row and AI calls match the two-phase pipeline', async () => {
    const [guide] = await sql("select title, jsonb_array_length(guide_data -> 'cards') as cards from public.study_guides where id = $1", [guideId]);
    expect(guide.cards).toBe(2);
    const routes = fakeCalls().map((c) => c.route);
    expect(routes.filter((r) => r === 'openai.chat:guide.skeleton').length).toBe(1);
    expect(routes.filter((r) => r === 'openai.chat:guide.teaching').length).toBe(2);
  });

  await step('the lecture renders the opening from the generated session', async () => {
    await expect(page.getByText(/follow a glucose molecule|Glycolysis/).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
  });

  await step('start the lecture', async () => {
    await page.getByRole('button', { name: 'Start with River' }).click();
    await expect(page.getByRole('textbox', { name: 'Ask River' })).toBeVisible({ timeout: 15_000 });
  });

  await step('ask River a question (tutor-chat)', async () => {
    await page.getByRole('textbox', { name: 'Ask River' }).fill('Does glycolysis need mitochondria?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByText(/Glycolysis happens in the cytoplasm, so it does not need mitochondria/).first()).toBeVisible({ timeout: 30_000 });
    expect(fakeCalls().some((c) => c.route === 'openai.chat:tutor.chat')).toBe(true);
  });

  await step('skip to the recall question and answer it', async () => {
    await page.getByRole('button', { name: 'Skip to question' }).click();
    const answer = page.getByRole('textbox', { name: 'Your answer' }).filter({ visible: true }).first();
    await expect(answer).toBeVisible({ timeout: 15_000 });
    await answer.fill('It happens in the cytoplasm');
    await page.getByRole('button', { name: 'Submit Answer' }).filter({ visible: true }).first().click();
  });

  await step('River grades the answer (grade-tutor-answer) and the state is saved', async () => {
    await expect(page.getByRole('button', { name: 'Submit Answer' }).filter({ visible: true })).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText('Spot on, glycolysis runs in the cytoplasm.').filter({ visible: true }).first()).toBeVisible();
    expect(fakeCalls().some((c) => c.route === 'openai.chat:grade.tutor')).toBe(true);
    await expect.poll(async () => (await sql("select coalesce(jsonb_typeof(study_state), 'null') as t from public.study_guides where id = $1", [guideId]))[0].t, { timeout: 15_000 }).toBe('object');
  });
}
