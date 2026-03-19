# Current onboarding UI (baseline)

> **Update:** Onboarding is **mobile-only** now. See **[README.md](./README.md)**. The sections below mix historical and structural notes.

## Before this work

- No dedicated multi-step onboarding route.
- [`client/src/components/OnboardingArt.jsx`](../../client/src/components/OnboardingArt.jsx) is decorative logo art in [`client/src/components/Layout.jsx`](../../client/src/components/Layout.jsx).
- Post-auth entry: [`client/src/pages/Account.jsx`](../../client/src/pages/Account.jsx) shows [`ProfileView`](../../client/src/components/auth/ProfileView.jsx); other protected routes use [`ProtectedRoute`](../../client/src/components/auth/ProtectedRoute.jsx) with no onboarding gate.

## After implementation

- Protected route: `/onboarding` — full-screen **mobile-first** wizard (three steps).
- [`ProtectedRoute`](../../client/src/components/auth/ProtectedRoute.jsx) redirects to `/onboarding` only when [`userNeedsOnboarding`](../../client/src/utils/onboardingGate.js) is true (incomplete **and** mobile-eligible client).
- Non–mobile-eligible users who open `/onboarding` are sent to `/dashboard`.
- Completion persisted on `users.onboarding_completed_at`; `onboarding_step` for resume (steps 0–2).
