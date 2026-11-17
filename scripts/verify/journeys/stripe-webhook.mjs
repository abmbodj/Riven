// Stripe webhook (edge function stripe-webhook, the endpoint production Stripe calls).
// Characterizes billing state changes from signed events: signature checks, checkout →
// Supporter with expiry, duplicate delivery ignored, cancellation → free, lifetime kept.
// Stripe API reads it makes are answered by the Stripe fake.
import crypto from 'node:crypto';
import { SUPABASE } from '../lib/config.mjs';

export const meta = {
  feature: 'billing-paywall',
  covers: 'Signed Stripe events -> stripe-webhook -> users billing columns; Settings shows the plan',
  doc: 'docs/features/billing-paywall.md',
};

const WEBHOOK_SECRET = 'whsec_local_fake'; // scripts/verify/edge/local.env
const URL_ = `${SUPABASE.url}/functions/v1/stripe-webhook`;

const sign = (payload, secret = WEBHOOK_SECRET) => {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return `t=${t},v1=${v1}`;
};

const deliver = async (event, { signature } = {}) => {
  const payload = JSON.stringify(event);
  const headers = { 'content-type': 'application/json' };
  if (signature !== null) headers['stripe-signature'] = signature ?? sign(payload);
  const res = await fetch(URL_, { method: 'POST', headers, body: payload });
  return { status: res.status, body: await res.text() };
};

export default async function ({ page, step, expect, signIn, sql }) {
  const [{ id: userId }] = await sql("select id from public.users where email = 'student@riven.test'");
  const billing = async () => (await sql(
    "select subscription_tier, stripe_customer_id, stripe_subscription_id, subscription_expires_at from public.users where id = $1",
    [userId],
  ))[0];

  const checkout = {
    id: 'evt_checkout_1', type: 'checkout.session.completed',
    data: { object: { id: 'cs_sub_1', client_reference_id: String(userId), customer: 'cus_fake_local', subscription: 'sub_fake_local', metadata: {} } },
  };

  await step('rejects a missing or wrong signature', async () => {
    expect((await deliver(checkout, { signature: null })).status).toBe(400);
    expect((await deliver(checkout, { signature: sign(JSON.stringify(checkout), 'whsec_wrong') })).status).toBe(400);
    expect((await billing()).subscription_tier).toBe('free');
  });

  await step('checkout.session.completed makes the user a Supporter with an expiry', async () => {
    const res = await deliver(checkout);
    expect(res.status).toBe(200);
    const row = await billing();
    expect(row).toMatchObject({ subscription_tier: 'supporter', stripe_customer_id: 'cus_fake_local', stripe_subscription_id: 'sub_fake_local' });
    const days = (new Date(row.subscription_expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });

  await step('a duplicate delivery is acknowledged and ignored', async () => {
    const res = await deliver(checkout);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ duplicate: true });
    const [{ n }] = await sql("select count(*)::int as n from public.stripe_processed_events where event_id = 'evt_checkout_1'");
    expect(n).toBe(1);
  });

  await step('Settings shows the Supporter plan', async () => {
    await signIn('student');
    await page.goto('/settings#plan');
    await page.getByText('Plan & access', { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText('Premium access active').first()).toBeVisible({ timeout: 20_000 });
  });

  await step('customer.subscription.deleted reverts to free', async () => {
    const res = await deliver({ id: 'evt_deleted_1', type: 'customer.subscription.deleted', data: { object: { id: 'sub_fake_local', customer: 'cus_fake_local' } } });
    expect(res.status).toBe(200);
    expect((await billing()).subscription_tier).toBe('free');
  });

  await step('a lifetime user is not downgraded by a subscription deletion', async () => {
    await sql("update public.users set subscription_tier = 'lifetime' where id = $1", [userId]);
    const res = await deliver({ id: 'evt_deleted_2', type: 'customer.subscription.deleted', data: { object: { id: 'sub_old', customer: 'cus_fake_local' } } });
    expect(res.status).toBe(200);
    expect((await billing()).subscription_tier).toBe('lifetime');
  });
}
