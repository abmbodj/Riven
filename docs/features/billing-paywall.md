# Billing and paywall

Free: 10 AI generations a month, smaller limits. Premium ("Supporter", monthly or
annual; "Lifetime" legacy) via Stripe Checkout on web and RevenueCat on iOS.

## How to reach it (user)

- Paywall: any AI action when out of generations returns 429 and opens the pricing
  modal (deck, guide, exam, YouTube, notes, Canvas sync limit, themes).
- Upgrade: Settings → **Plan & access** → **Upgrade Riven** → pick plan → **Continue to
  checkout** → Stripe Checkout. Manage: Settings → portal (`create-portal`).

## What runs

- Quota: `getAiLimitStatus` / `consumeAiQuota` (`_shared/aiCore.mjs`); premium check in
  `_shared/premiumAccess.mjs`.
- Web checkout: `create-checkout` (price allow-list from `STRIPE_PRICE_*`) → Stripe
  Checkout Session → browser redirect. Premium is granted only by `stripe-webhook`
  (and the Express `server/routes/stripe.js` legacy path).
- iOS: RevenueCat purchase → `sync-revenuecat` / `revenuecat-webhook`;
  `reconcile-subscriptions` daily. See `.claude/skills/verify-entitlements` for the
  exhaustive webhook-ordering checker.

## Drive it

```bash
node scripts/verify/riven-verify.mjs run billing-paywall
```

Sets the student's `ai_generations_count` to 10, tries to generate a deck: pricing modal
opens, no OpenAI call, no deck. Then Upgrade → Continue to checkout: the browser is sent
to the fake Checkout URL, Stripe was asked for `mode=subscription` with
`price_local_monthly|annual`, and the user is still `free`.

## Not proven here

Webhook → premium, customer portal, RevenueCat. These touch billing and are out of scope
for UI verification; use `verify-entitlements` for RevenueCat.
