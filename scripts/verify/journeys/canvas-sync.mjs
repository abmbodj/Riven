// Canvas sync: connect a Canvas calendar feed (web flow: paste the .ics link) and
// import its courses and assignments. Proves canvas-lms validates the feed URL,
// fetches and parses the iCal (Canvas fake), and writes classes + assignments.
export const meta = {
  feature: 'canvas-sync',
  covers: 'Classes -> Add class -> Canvas Sync -> paste calendar feed -> canvas-lms import',
  doc: 'docs/features/canvas-sync.md',
};

const FEED = 'https://riven-test.instructure.com/feeds/calendars/user_verify123.ics';

export default async function ({ page, step, expect, signIn, sql, fakeCalls }) {
  await step('sign in as an onboarded user with no classes', () => signIn('pro'));

  await step('open Add class and switch to Canvas Sync', async () => {
    await page.goto('/classes');
    await page.getByRole('button', { name: 'Add class' }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /Canvas Sync/ }).click();
  });

  await step('paste the calendar feed link', async () => {
    await page.getByRole('button', { name: /Connect Calendar Feed/ }).filter({ visible: true }).first().click();
    await page.getByPlaceholder('Canvas Calendar Link (Ends in .ics)').fill(FEED);
    await page.getByRole('button', { name: /Connect Calendar Feed/ }).filter({ visible: true }).last().click();
  });

  await step('the Canvas course and its assignments are imported', async () => {
    await expect.poll(async () => (await sql("select count(*)::int as n from public.assignments a join public.users u on u.id = a.user_id where u.email = 'pro@riven.test'"))[0].n, { timeout: 60_000 }).toBe(2);
    expect(fakeCalls().filter((c) => c.route === 'canvas.ical').length).toBeGreaterThan(0);
    const [user] = await sql("select canvas_ical_url from public.users where email = 'pro@riven.test'");
    expect(user.canvas_ical_url).toBe(FEED);
  });

  await step('the class shows up in Classes', async () => {
    await page.goto('/classes');
    await expect(page.getByText(/BIO 101 Cell Biology/).first()).toBeVisible({ timeout: 20_000 });
  });
}
