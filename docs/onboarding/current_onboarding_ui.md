# Current onboarding UI (baseline)

## Before this work

- No dedicated multi-step onboarding route.
- [`client/src/components/OnboardingArt.jsx`](../../client/src/components/OnboardingArt.jsx) is decorative logo art in [`client/src/components/Layout.jsx`](../../client/src/components/Layout.jsx).
- Post-auth entry: [`client/src/pages/Account.jsx`](../../client/src/pages/Account.jsx) shows [`ProfileView`](../../client/src/components/auth/ProfileView.jsx); other protected routes use [`ProtectedRoute`](../../client/src/components/auth/ProtectedRoute.jsx) with no onboarding gate.

## After implementation

- New protected route: `/onboarding` — full-screen wizard.
- [`ProtectedRoute`](../../client/src/components/auth/ProtectedRoute.jsx) redirects incomplete users to `/onboarding` (except when already on that route).
- Completion persisted on `users.onboarding_completed_at` (see migration); optional `onboarding_step` for resume.
