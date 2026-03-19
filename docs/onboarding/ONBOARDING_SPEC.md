# Onboarding interaction, resilience, and analytics

## Transitions

- Step changes: horizontal slide + fade (Motion), ~220ms, `easeOut`; respect `prefers-reduced-motion` (instant swap).
- Primary CTA: brief scale tap feedback (existing `tap-action` / haptics where available).

## Loading and errors

- Saving step / completion: CTA shows inline spinner; disable double submit.
- Supabase/update failure: toast error + single retry action on the same screen; never advance step on failed persist.
- If `updateOnboardingProgress` fails on skip, still allow local navigate to `/dashboard` and show toast—user can retry from Settings later (optional future).

## Resume and drop-off

- `onboarding_step` updated after each successful “Continue” (0-based index of **last completed** step, or **next** step—implementation: store **next** step index to resume).
- **Decision:** persist `onboarding_step` as **the step the user should see next** (0–4). On load, read from `user.onboardingStep` clamped to 0–4.
- Completing or skipping sets `onboarding_completed_at` and clears need for gate.

## Analytics events (client)

Dispatched on `window` as `CustomEvent('riven:onboarding', { detail })` for optional listeners (product analytics, PostHog, etc.). Shape: `detail = { name, payload, ts }` (see [`client/src/utils/onboardingAnalytics.js`](../../client/src/utils/onboardingAnalytics.js)).

| `detail.name` | `detail.payload` |
|-----------------|------------------|
| `onboarding_screen_view` | `{ step: number }` |
| `onboarding_continue` | `{ fromStep: number }` |
| `onboarding_skip_step` | `{ step: number }` |
| `onboarding_skip_all` | `{ step: number }` |
| `onboarding_complete` | `{ path: string }` |
| `onboarding_cta` | `{ step: number, cta: string }` |

**First study action** (separate funnel): reuse existing product events when user hits `/note/new`, `/create`, `/decks/library` study—no duplicate schema here.

## Mobile vs desktop

- **Mobile:** single column, sticky bottom primary CTA, skip as text link above CTA, progress dots top.
- **Desktop:** `lg:grid-cols-2` — left narrative/visual, right card with CTA; max width `max-w-5xl`.
