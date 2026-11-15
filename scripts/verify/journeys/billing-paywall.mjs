// Billing / paywall (web): a free user out of AI generations is shown the paywall
// instead of an AI call, and Upgrade -> Continue to checkout creates a Stripe
// Checkout session for the configured price and sends the browser to Stripe.
// Read-only proof: Stripe is faked; no billing code or data is changed by the journey.
export const meta = {
  feature: 'billing-paywall',
  covers: 'AI quota exhausted -> PricingModal (no AI call); Settings -> Upgrade -> create-checkout -> redirect to Stripe',
  doc: 'docs/features/billing-paywall.md',
};

export default async function ({ page, step, expect, signIn, sql, fakeCalls }) {
  await step('the free student has used all 10 monthly AI generations', async () => {
    await sql("update public.users set ai_generations_count = 10, last_ai_generation_reset = now() where email = 'student@riven.test'");
  });

  await step('sign in as the free student', () => signIn('student'));

  await step('generating a deck opens the paywall and makes no AI call', async () => {
    await page.goto('/create');
    await page.getByRole('button', { name: /Generate from Notes/i }).click();
    await page.getByPlaceholder('Deck name').filter({ visible: true }).first().fill('Over quota');
    await page.getByPlaceholder(/Paste your notes/).fill('Glycolysis happens in the cytoplasm.');
    await page.getByRole('button', { name: /Generate Flashcards/ }).click();
    await expect(page.getByRole('button', { name: 'Close pricing modal' })).toBeVisible({ timeout: 30_000 });
    expect(fakeCalls().filter((c) => c.route.startsWith('openai.')).length).toBe(0);
    const decks = await sql("select count(*)::int as n from public.decks where title = 'Over quota'");
    expect(decks[0].n).toBe(0);
  });

  let checkoutUrl = null;
  await step('Settings -> Plan & Access -> Upgrade Riven -> Continue to checkout', async () => {
    page.on('request', (req) => { if (req.url().startsWith('https://checkout.stripe.com/')) checkoutUrl = req.url(); });
    await page.goto('/settings');
    await page.getByText('Plan & access', { exact: true }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: 'Upgrade Riven' }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /Continue to checkout/ }).filter({ visible: true }).first().click();
    await expect.poll(() => checkoutUrl, { timeout: 30_000 }).toBe('https://checkout.stripe.com/c/pay/cs_fake_local');
  });

  await step('create-checkout asked Stripe for a subscription at the configured price', async () => {
    const session = fakeCalls().find((c) => c.route === 'stripe:POST /v1/checkout/sessions');
    expect(session).toBeTruthy();
    expect(session.body.mode).toBe('subscription');
    expect(session.body['line_items[0][price]']).toMatch(/^price_local_(monthly|annual)$/);
    const [user] = await sql("select subscription_tier from public.users where email = 'student@riven.test'");
    expect(user.subscription_tier).toBe('free'); // nothing is granted until the webhook arrives
  });
}
