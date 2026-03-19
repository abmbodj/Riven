# Onboarding verification (timed walkthrough)

Run after applying migration [`20260319130000_user_onboarding.sql`](../../supabase/migrations/20260319130000_user_onboarding.sql) and deploying server + client.

## Preconditions

- New test account (or user row with `onboarding_completed_at IS NULL`).
- Mobile viewport (~390px) and desktop (~1280px).

## Script (target &lt; 2 minutes)

1. Sign up or log in → should land on `/onboarding` (or `/account` → auto-redirect to `/onboarding`).
2. Step 1: tap **Continue** (&lt;15s).
3. Step 2: pick one study style → **Continue** (&lt;20s).
4. Step 3: optional **Skip this step** or **Open note + mic** → confirms navigation to `/note/new` when chosen (&lt;30s).
5. Step 4: optional skip or **Bring my materials** → `/create?focus=syllabus` opens **Generate from Notes** (&lt;30s).
6. Step 5: **Open my decks** → `/decks/library`; user row gets `onboarding_completed_at` set.
7. Reload app → should **not** return to `/onboarding`.
8. **Skip for now** from step 1 → `/dashboard` and completed flag set.

## Analytics (optional)

In devtools console:

```js
window.addEventListener('riven:onboarding', (e) => console.log(e.detail));
```

Confirm events fire for screen views, continue, skip, and complete.
