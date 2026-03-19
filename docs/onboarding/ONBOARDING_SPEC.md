> **Current product behavior:** First-run onboarding is **mobile-only** (Capacitor or mobile-class browser). See **[README.md](./README.md)** for the authoritative gate rules and code map. Below: interaction and analytics details that still apply.

# Onboarding interaction, resilience, and analytics

## Transitions

- Step changes: vertical fade/slide (Motion), ~200ms; respect `prefers-reduced-motion` (instant swap).
- Primary CTA: disabled while saving; loading state with spinner.

## Loading and errors

- Saving step / completion: CTA shows inline spinner; disable double submit.
- Supabase/update failure: toast error; do not advance step on failed persist.
- Skip sets `onboarding_completed_at` and navigates to `/dashboard` after successful persist.

## Resume and drop-off

- `onboarding_step` stores the **next** step index to show (0-based).
- Clamp to **0–2** for the three-screen mobile flow in `client/src/pages/Onboarding.jsx`.
- Completing or skipping sets `onboarding_completed_at` and clears the gate (plus client hint in `onboardingGate`).

## Analytics events (client)

Dispatched on `window` as `CustomEvent('riven:onboarding', { detail })` for optional listeners (product analytics, PostHog, etc.). Shape: `detail = { name, payload, ts }` (see [`client/src/utils/onboardingAnalytics.js`](../../client/src/utils/onboardingAnalytics.js)).

| `detail.name` | `detail.payload` |
|-----------------|------------------|
| `onboarding_screen_view` | `{ step: number }` |
| `onboarding_continue` | `{ fromStep: number }` |
| `onboarding_skip_all` | `{ step: number }` |
| `onboarding_complete` | `{ path: string }` (e.g. `/dashboard`) |
| `onboarding_cta` | `{ step: number, cta: string }` |

## Layout

- **Mobile-eligible only:** single column, compact header with Skip, progress segments, hero art, single primary CTA per step.
- **Non–mobile-eligible:** `/onboarding` redirects to `/dashboard`; no desktop two-column wizard.
