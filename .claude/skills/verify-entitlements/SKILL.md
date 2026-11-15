---
name: verify-entitlements
description: Exhaustively checks that RevenueCat (iOS) webhook deliveries, in any order and with retries, leave Riven's premium access correct, by running the real processRevenueCatWebhookEvent and isPremiumActive over every delivery order of realistic subscription timelines. Use before merging any change to revenuecatWebhookCore.mjs, premiumAccess.mjs, revenuecat-webhook/index.ts or reconcile-subscriptions/index.ts, or when asked whether a subscriber can be wrongly locked out or given free Pro.
---

# verify-entitlements

## The promise

**After RevenueCat has delivered every webhook for a subscriber, in whatever order and
however many times, and the daily reconcile has run, the user has premium in Riven
exactly when they are entitled to it.**

If this breaks, paying iOS subscribers lose Pro features, lifetime buyers lose
access they paid for once, or lapsed users keep Pro for free.

## Run it

```bash
node .claude/skills/verify-entitlements/check.mjs              # ~0.3s; compares to baseline.json
node .claude/skills/verify-entitlements/check.mjs --all        # show every counterexample in full
node .claude/skills/verify-entitlements/check.mjs --self-test  # prove the check can still fail
```

The only requirement is Node 18+. It needs no network, no Supabase and no installs.

| Exit | Meaning |
|---|---|
| 0 | failures are exactly the known findings in `baseline.json` |
| 1 | a **new** failure: your change broke a property (it is printed as `NEW` with a counterexample) |
| 2 | a known finding no longer fails, which usually means it was fixed. Confirm, then delete that line from `baseline.json` |

## How it checks

This is explicit-state model checking that runs the **real code**, not a hand-written model:

1. **Scenarios** (`SCENARIOS` in `check.mjs`) are real RevenueCat event timelines for
   one subscriber: new purchase, renewal, lapse then re-buy one hour later,
   cancel then expire, cancel then uncancel, and a billing failure followed by a
   successful retry. Each one records whether RevenueCat considers the user active
   at the check time.
2. **Starting users**: `free`, and `web-lifetime` (bought lifetime on the web via
   Stripe, then subscribes on iOS).
3. **Every delivery order**: each event is delivered once or twice (a retry), in
   every interleaving. That is 14,132 runs.
4. Each run imports the real `supabase/functions/_shared/revenuecatWebhookCore.mjs`
   and feeds it each event through an in-memory persistence layer. The persistence
   mirrors `updateUserTier` in `revenuecat-webhook/index.ts`, which is a blind
   update of tier and expiry. One pass of the reconcile job follows, then
   `premiumAccess.mjs` `isPremiumActive` is evaluated at the scenario's check time.

| Property | Statement |
|---|---|
| `P1-no-wrongful-lockout` | If RevenueCat says the user is paid up, Riven grants premium. |
| `P2-no-free-ride` | A user whose subscription ended, and who never bought lifetime, has no premium. |
| `P3-lifetime-kept` | A lifetime owner keeps tier `lifetime` whatever RevenueCat sends. |
| `P4-retry-idempotent` | The same event delivered twice in a row has the same effect as once. |

## Reading a failure

Each counterexample is the **shortest** failing delivery order, told in steps:

```
1. RevenueCat delivers INITIAL_PURCHASE (sent day 30 +1h, period ends day 60 +1h) -> tier supporter→supporter ...
2. RevenueCat delivers EXPIRATION (sent day 30, ...) -> tier supporter→free ...
3. Daily reconcile leaves the row alone (it only revisits 'supporter' rows ...)
Result: provider says active, Riven says no premium.
```

**Real bug or modeling error?** Ask three questions:

- **Can this order really happen?** The check allows any reordering, but RevenueCat
  only retries a failed delivery for a few hours. A counterexample that needs two
  events days apart to swap is not realistic. In that case tighten the scenario
  times; do not weaken the property.
- **Does the persistence mirror still match `revenuecat-webhook/index.ts`?** The
  same question applies to the reconcile mirror and `reconcile-subscriptions/index.ts`.
  If the real code gained a guard, update `makePersistence` or `reconcile` in
  `check.mjs` to match it, then rerun.
- If both answers hold up, it's a real bug. Report the counterexample in these
  words. Don't edit product code unless the user asked you to.

## Known findings (baseline.json), confirmed at the sync commit

1. **Out-of-order EXPIRATION locks out a re-subscriber** (`P1 | lapse-resubscribe`).
   A user's subscription lapses and they buy again an hour later. If the
   EXPIRATION delivery is retried and lands after the new purchase, the handler
   writes `tier=free` with the old expiry. Reconcile never revisits `free` rows, so
   the paying user stays locked out until their next renewal webhook, roughly a
   month later. Root cause: `processRevenueCatWebhookEvent` applies events without
   comparing `event_timestamp_ms` or `expiration_at_ms` to the stored expiry.
2. **Any RevenueCat event overwrites a lifetime purchase** (`P3 | * | web-lifetime`).
   A web lifetime buyer who subscribes on iOS is rewritten to `supporter`, then to
   `free` when the iOS subscription expires. Root cause: no lifetime or role guard
   in `processRevenueCatWebhookEvent`, nor in `updateUserTier`. The Stripe path
   does have one (`stripeWebhookCore.mjs`, `subscription-delete-skipped-lifetime`).

P2 and P4 hold in every run.

## Scope and limits

- **Covered:** event-to-tier mapping, expiry handling, ordering and retries, the
  premium gate, and the reconcile selection rule.
- **Not covered:** webhook auth, user lookup (`resolveUserLookup`), DB errors and
  partial writes, two deliveries processed *concurrently* (deliveries are
  sequential here), the `sync-revenuecat` restore path, the Stripe webhooks,
  `PRODUCT_CHANGE`, `TRANSFER`, `NON_RENEWING_PURCHASE`, and role-based users
  (owner/admin/friends bypass the gate entirely).
- Bounds: one subscriber, at most 4 distinct events, each delivered at most twice.
  A pass covers exactly these scenarios, not every possible timeline.

## Coverage record

| Check part | Real code it stands for |
|---|---|
| imported directly | `supabase/functions/_shared/revenuecatWebhookCore.mjs` (whole file) |
| imported directly | `supabase/functions/_shared/premiumAccess.mjs` `isPremiumActive` |
| `makePersistence` (mirror) | `supabase/functions/revenuecat-webhook/index.ts` `updateUserTier` (lines 65–83) and `getUserByAppUserId` / `updateUserTierByAppUserId` (148–156) |
| `reconcile` (mirror) | `supabase/functions/reconcile-subscriptions/index.ts`: batch filter `subscription_tier = 'supporter'` (lines 245–254), `reconcileUser` skip-if-future (143) and the provider re-query result (170–190) |

**Sync commit: `a8c5c4e`.** The mirrors were confirmed to match the files above at
this commit, and all four files were last changed in `efa1356`.

Before you trust a result, check whether the covered code has moved:

```bash
git log --oneline a8c5c4e..HEAD -- supabase/functions/_shared/revenuecatWebhookCore.mjs supabase/functions/_shared/premiumAccess.mjs supabase/functions/revenuecat-webhook/index.ts supabase/functions/reconcile-subscriptions/index.ts
```

If that prints commits, reread the changed parts against the mirrors and update
`check.mjs` if needed. Then run `--self-test` and the check. Only after that,
move the sync commit above to the new HEAD. Directly imported files need no
mirror update, but the self-test anchors (`MUTANTS`) may need fixing. The
self-test reports `STALE` when one goes missing.

## Self-test (proof the check can fail)

`--self-test` copies `_shared/` to a temp dir, applies realistic one-line slips,
and requires each to produce a failure the real code doesn't have:

- CANCELLATION revokes immediately: caught by P1 in cancel-uncancel.
- INITIAL_PURCHASE ignored: caught by P1 in new-purchase.
- BILLING_ISSUE revokes immediately: caught by P1 in billing-retry.
- Premium expiry comparison inverted: caught by P1 and P2.

A slip that turns out to be harmless is not counted as caught. One example is
dropping `expiration_at_ms`: a null expiry means "active", and EXPIRATION or
reconcile corrects it later. If you add a property, add a mutant that only
that property catches.
