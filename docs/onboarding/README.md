# First-run onboarding (mobile-only)

## When it runs

Onboarding is shown only on **mobile-eligible** clients:

- **Capacitor** native shell (`Capacitor.isNativePlatform()`), or
- **Mobile-class web**: `getMobileVisualBudget()` (`max-width: 767px` or primary `pointer: coarse`), or
- **Touch phones/tablets** where Safari reports a “fine” pointer: `max-width: 1023px` plus `(any-pointer: coarse)` or `navigator.maxTouchPoints > 0` (see `isMobileOnboardingEligible` in `client/src/utils/onboardingGate.js`).

Desktop sessions with a fine pointer and wide viewport **never** see `/onboarding`, even if `users.onboarding_completed_at` is still `NULL`. If the user later opens the app on a phone or in the native app, the gate applies and they complete the flow then.

## Data model

- `users.onboarding_completed_at` — `NULL` means not finished; set when the user completes or skips.
- `users.onboarding_step` — resume index for the in-app steps.

See migration `supabase/migrations/20260319130000_user_onboarding.sql`.

## Code map

| Piece | Location |
|--------|-----------|
| Eligibility + gate | `client/src/utils/onboardingGate.js` (`isMobileOnboardingEligible`, `userNeedsOnboarding`) |
| Redirect after login | `client/src/components/auth/ProtectedRoute.jsx` |
| Profile guard | `client/src/components/auth/ProfileView.jsx` |
| UI | `client/src/pages/Onboarding.jsx` |
| Persist | `AuthContext.saveOnboardingProgress` → `authApi.updateOnboardingProgress` |

## Analytics

Optional hook: `window` event `riven:onboarding` via `client/src/utils/onboardingAnalytics.js`.

## Historical docs

Other files in this folder describe earlier **web-wide** onboarding designs; treat them as background unless they explicitly match the mobile-only behavior above.
