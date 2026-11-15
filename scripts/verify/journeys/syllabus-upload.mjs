// Syllabus upload: create a class by uploading a syllabus; AI fills in the class form
// (name, professor, room, meeting times, assignments) and saving writes it all.
// Proves generate-class parses an uploaded text file and the form saves the result.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const meta = {
  feature: 'syllabus-upload',
  covers: 'Classes -> Add class -> Syllabus Upload (generate-class) -> form auto-filled -> Create Class',
  doc: 'docs/features/syllabus-upload.md',
};

const SYLLABUS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/syllabus.txt');

export default async function ({ page, step, expect, signIn, sql, fakeCalls }) {
  await step('sign in as an onboarded user with no classes', () => signIn('pro'));

  await step('open Add class and switch to Syllabus Upload', async () => {
    await page.goto('/classes');
    await page.getByRole('button', { name: 'Add class' }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /Syllabus Upload/ }).click();
    await expect(page.getByText('Auto-fill from syllabus')).toBeVisible();
  });

  await step('upload the syllabus and process it', async () => {
    await page.locator('input[type="file"]').filter({ has: page.locator(':scope') }).first().setInputFiles(SYLLABUS);
    await page.getByRole('button', { name: /Process Syllabus/ }).click();
    await expect(page.getByPlaceholder('e.g. CS 101')).toHaveValue('BIO 101 Cell Biology', { timeout: 60_000 });
    expect(fakeCalls().filter((c) => c.route === 'openai.chat:class.syllabus').length).toBe(1);
  });

  await step('the form shows the extracted professor and assignments', async () => {
    await expect(page.locator('input[value="Dr. Ada Lovelace"]')).toBeVisible();
    await expect(page.getByText('Lab report 1: Microscopy').first()).toBeVisible();
  });

  await step('create the class', async () => {
    await page.getByRole('button', { name: 'Create Class' }).click();
    await expect(page.getByText('BIO 101 Cell Biology').first()).toBeVisible({ timeout: 20_000 });
  });

  await step('class, meeting times and assignments were written', async () => {
    const [cls] = await sql("select c.id, c.professor, c.room from public.classes c join public.users u on u.id = c.user_id where u.email = 'pro@riven.test'");
    expect(cls).toMatchObject({ professor: 'Dr. Ada Lovelace', room: 'Science Hall 204' });
    const slots = await sql('select day_of_week from public.schedule_slots where class_id = $1 order by day_of_week', [cls.id]);
    expect(slots.map((s) => s.day_of_week)).toEqual([1, 3]);
    const assignments = await sql('select title from public.assignments where class_id = $1 order by title', [cls.id]);
    expect(assignments.map((a) => a.title)).toEqual(['Lab report 1: Microscopy', 'Midterm exam']);
  });
}
