export const meta = {
  covers: 'Sign in with email + password as a seeded user and land on the dashboard',
  feature: 'auth',
};

export default async function ({ page, step, expect, signIn, sql }) {
  await step('sign in through the login form', () => signIn('student'));
  await step('dashboard renders for the seeded student', async () => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-dashboard-ready="true"]').first()).toBeVisible({ timeout: 30_000 });
  });
  await step('the account row was linked to the Supabase auth user', async () => {
    const [row] = await sql(`select u.username from public.users u join auth.users a on a.id = u.supabase_auth_id where a.email = $1`, ['student@riven.test']);
    expect(row?.username).toBe('sam_student');
  });
}
