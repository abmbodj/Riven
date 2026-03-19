# Onboarding verification (timed walkthrough)

> **Update:** Onboarding is **mobile-only**. Desktop sign-in should **not** open `/onboarding`. Use a narrow viewport, coarse-pointer emulation, or Capacitor. See **[README.md](./README.md)**.

Run after applying migration [`20260319130000_user_onboarding.sql`](../../supabase/migrations/20260319130000_user_onboarding.sql) and deploying server + client.

## Preconditions

- New test account (or user row with `onboarding_completed_at IS NULL`).
- **Mobile-eligible** client: ~390px width and/or `pointer: coarse`, or native app.

## Script

1. Sign up or log in on **mobile-eligible** client → should land on `/onboarding` when `onboarding_completed_at` is null.
2. Step 1 → **Continue** (persists step).
3. Step 2 → **Next**.
4. Step 3 → **Go to Today** (or **Skip** anytime) → `/dashboard`, `onboarding_completed_at` set.
5. **Desktop (~1280px, fine pointer):** same account should **not** be redirected to `/onboarding`; visiting `/onboarding` should redirect to `/dashboard`.
6. Reload app on mobile-eligible client → should **not** return to `/onboarding` once completed.

## Analytics (optional)

In devtools console:

```js
window.addEventListener('riven:onboarding', (e) => console.log(e.detail));
```

Confirm events fire for screen views, continue, skip, and complete.
