# Stripe webhook rejected every event (2026-06-15 → fix in be773c0)

## What happened

`supabase/functions/stripe-webhook` verified signatures with the synchronous
`stripe.webhooks.constructEvent`. Deno's Stripe build only supports async (SubtleCrypto)
verification, so the call always threw and the function answered **400** to every
delivery since `efa1356` (2026-06-15). Fixed by `constructEventAsync` (`be773c0`);
`supabase/config.toml` now also declares `verify_jwt = false` for the function.

Effects while broken, for web (Stripe) purchases only — iOS/RevenueCat is separate:

- `checkout.session.completed` never ran → buyers stayed `free` (no tier, no
  `stripe_customer_id`, no expiry).
- `customer.subscription.deleted` never ran → cancellations not applied.
- `invoice.paid` never ran → renewals not extended. The daily `reconcile-subscriptions`
  job heals renewals and expiries **only for users already marked `supporter`**, so it
  could not fix unfulfilled purchases.

## After deploying the fix

1. Deploy: `npx supabase functions deploy stripe-webhook` (config.toml now keeps the JWT
   check off).
2. Stripe Dashboard → Developers → Webhooks → the `…/functions/v1/stripe-webhook`
   endpoint. If Stripe **disabled** it after repeated failures, re-enable it.
3. Failed deliveries from the last 3 days can be resent from that page. Older events are
   no longer retried by Stripe; use the reconciliation below.

## Reconciliation (read-only)

`create-checkout` does not store the customer id, so the database cannot tell who paid.
Start from Stripe: export **paid** Checkout Sessions created since 2026-06-15 with their
`client_reference_id` (that is `users.id`) and `mode` (`subscription` → supporter,
`payment` → lifetime). With the Stripe CLI:

```bash
stripe checkout sessions list -d "created[gte]=1781481600" --limit 100 \
  | jq -r '.data[] | select(.payment_status=="paid") | [.client_reference_id, .mode, .customer, .subscription, .id] | @csv'
```

(1781481600 = 2026-06-15T00:00:00Z; page with `--starting-after` if `has_more`.)

Paste the rows into the `paid` list and run this in the Supabase SQL editor. It changes
nothing; it lists users whose stored plan does not match what they paid for.

```sql
with paid(user_id, mode, stripe_customer_id, stripe_subscription_id, session_id) as (
  values
    -- (123, 'subscription', 'cus_...', 'sub_...', 'cs_...'),
    (0, 'subscription', '', '', '')  -- placeholder row, remove
)
select * from (
select
  p.user_id,
  p.mode,
  u.email,
  u.subscription_tier,
  u.subscription_expires_at,
  u.stripe_customer_id as stored_customer,
  p.stripe_customer_id as paid_customer,
  p.session_id,
  case
    when u.id is null then 'no such user'
    when p.mode = 'payment' and u.subscription_tier <> 'lifetime' then 'paid lifetime, not lifetime'
    when p.mode = 'subscription' and u.subscription_tier not in ('supporter', 'lifetime') then 'paid subscription, not premium'
    when p.mode = 'subscription' and u.stripe_subscription_id is distinct from p.stripe_subscription_id then 'subscription id not stored'
    else 'ok'
  end as status
from paid p
left join public.users u on u.id = p.user_id
where p.user_id <> 0
) checked
order by status = 'ok', user_id;  -- mismatches first
```

Also review users who are premium through Stripe but may have cancelled while the webhook
was down. Their subscriptions should be checked in Stripe (`status` of `stripe_subscription_id`):

```sql
select id, email, subscription_tier, subscription_expires_at, stripe_customer_id, stripe_subscription_id
from public.users
where subscription_tier = 'supporter' and stripe_subscription_id is not null
order by subscription_expires_at nulls first;
```

Fixing mismatches (granting or removing premium) is a billing decision; do it per user
after checking Stripe, or resend the user's original `checkout.session.completed` event
from the dashboard if it is still within Stripe's resend window.
