// Mock exams: generate a practice exam from a saved note, take it as an exam
// simulation, submit, and see results. Proves generate-exam writes a mock_exams row
// whose questions survive normalization, and that submitting records an attempt.
export const meta = {
  feature: 'mock-exams',
  covers: 'Generate exam from a note (generate-exam) -> exam simulation -> submit -> results + attempt row',
  doc: 'docs/features/mock-exams.md',
};

export default async function ({ page, step, expect, signIn, sql, fakeCalls }) {
  await step('sign in as the free student', () => signIn('student'));

  let examId;
  await step('open the generate dialog on Mock Exams', async () => {
    await page.goto('/exams');
    // The generate button is icon-only (no accessible name); it is the sparkles button.
    await page.locator('button:has(svg.lucide-sparkles)').filter({ visible: true }).last().click();
    await expect(page.getByPlaceholder('Practice Mock Exam')).toBeVisible();
  });

  await step('generate from the seeded lecture note', async () => {
    await page.getByPlaceholder('Practice Mock Exam').fill('Respiration practice exam');
    await page.getByRole('button', { name: 'Note', exact: true }).click();
    await page.getByRole('button', { name: /Lecture 5: Cellular respiration/ }).click();
    await page.getByRole('button', { name: /Generate Exam/ }).click();
    await page.waitForURL(/\/exam\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    examId = new URL(page.url()).pathname.split('/').pop();
  });

  await step('exam row holds the normalized questions; one AI call', async () => {
    const [exam] = await sql('select title, jsonb_array_length(questions) as n, source_type from public.mock_exams where id = $1', [examId]);
    expect(exam).toMatchObject({ title: 'Respiration practice exam', n: 6, source_type: 'notes' });
    expect(fakeCalls().filter((c) => c.route === 'openai.chat:exam.questions').length).toBe(1);
  });

  await step('choose Exam Simulation', async () => {
    await page.getByRole('button', { name: /Exam Simulation/ }).click();
    await expect(page.getByRole('button', { name: 'Exit exam' })).toBeVisible();
  });

  await step('answer the first question', async () => {
    await page.getByText('Mitochondrion', { exact: true }).filter({ visible: true }).first().click();
  });

  await step('submit the exam early', async () => {
    await page.getByRole('button', { name: /^Submit/ }).filter({ visible: true }).first().click();
    const confirm = page.getByRole('button', { name: /Submit( anyway| exam)?$/i }).filter({ visible: true });
    if (await confirm.count() > 1) await confirm.last().click();
  });

  await step('results render and the attempt was recorded', async () => {
    await expect(page.getByText('Topic Breakdown')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200); // let the score count-up animation settle for the screenshot
    await expect.poll(async () => (await sql('select xp_awarded from public.exam_attempts where exam_id = $1', [examId]))[0]?.xp_awarded, { timeout: 15_000 }).not.toBeNull();
    // exam-complete re-scores the stored answers: Q1 right, the rest unanswered -> 1/6 -> 17 XP.
    const [attempt] = await sql('select score, total, xp_awarded from public.exam_attempts where exam_id = $1', [examId]);
    expect(attempt).toEqual({ score: 1, total: 6, xp_awarded: 17 });
  });
}
