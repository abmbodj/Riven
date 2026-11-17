// Groups: create a study group, then use "or propose a time" in the evening.
// Guards health audit #16: the composer used to default to today 18:00 even after 18:00,
// so every evening proposal failed with "Can't propose a session in the past".
export const meta = {
  feature: 'groups',
  covers: 'Create group -> "or propose a time" in the evening -> meetup proposed for the next 6 PM',
};

export default async function ({ page, step, expect, signIn, sql }) {
  // An evening time (after 18:00) that is not in the future: a clock ahead of real time
  // would make the browser treat fresh Supabase tokens as expired.
  const now = new Date();
  const evening = new Date(now);
  if (now.getHours() < 18) {
    evening.setDate(evening.getDate() - 1);
    evening.setHours(21, 0, 0, 0);
  } else if (now.getHours() >= 21) {
    evening.setHours(21, 0, 0, 0);
  }
  const tomorrowSixPm = new Date(evening);
  tomorrowSixPm.setDate(tomorrowSixPm.getDate() + 1);
  tomorrowSixPm.setHours(18, 0, 0, 0);

  // Browser clock reads that evening time; timers keep running normally.
  await page.clock.setFixedTime(evening);

  await step('sign in as the free student', () => signIn('student'));

  await step('create a study group', async () => {
    await page.goto('/groups');
    await page.getByText('Create Group', { exact: true }).filter({ visible: true }).first().click();
    await page.getByPlaceholder('e.g. Origins of Life').fill('Respiration crew');
    await page.locator('form button[type="submit"]').filter({ visible: true }).first().click();
    await page.waitForURL(/\/groups\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  });

  await step('open "or propose a time" in the evening', async () => {
    await page.getByRole('button', { name: /or propose a time/i }).filter({ visible: true }).first().click();
    await expect(page.getByRole('dialog', { name: /new study session/i })).toBeVisible();
  });

  await step('propose without touching the time', async () => {
    await page.getByPlaceholder(/organic chemistry problem set/i).fill('Chapter 5 review');
    await page.getByRole('button', { name: /^Propose session$/ }).click();
    await expect(page.getByText("Can't propose a session in the past.")).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: /new study session/i })).toHaveCount(0, { timeout: 15_000 });
  });

  await step('the meetup was saved for the next 6 PM', async () => {
    const rows = await sql('select topic, start_at from public.group_meetups');
    expect(rows.length).toBe(1);
    expect(rows[0].topic).toBe('Chapter 5 review');
    expect(new Date(rows[0].start_at).toISOString()).toBe(tomorrowSixPm.toISOString());
  });
}
