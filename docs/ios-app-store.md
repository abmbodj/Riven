# iOS App Store preparation (Riven / Capacitor)

This document tracks product and technical decisions before submitting the Capacitor-wrapped app to App Review.

## Sign in with Apple (Guideline 4.8)

If the native app offers **third-party login** (e.g. Google), Apple generally requires **Sign in with Apple** unless an [exemption](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple) applies.

**Implementation status:** Native iOS Sign in with Apple is implemented.

- **Native iOS app** → [`@capawesome/capacitor-apple-sign-in`](https://www.npmjs.com/package/@capawesome/capacitor-apple-sign-in) from [`OAuthButtons.jsx`](../client/src/components/auth/OAuthButtons.jsx), then Supabase `signInWithIdToken(...)`.
- **Metadata handling** → Apple only sends the user's name on first authorization, so the client immediately writes `full_name`, `given_name`, and `family_name` into Supabase user metadata before completing registration.
- **Legacy compatibility** → The app still falls back to [`/api/auth/oauth/apple`](../server/routes/auth.js) for existing users who need the legacy 2FA bridge.
- **Xcode capability** → [`App.entitlements`](../client/ios/App/App/App.entitlements) includes the Sign in with Apple entitlement, and the app target should show the capability in **Signing & Capabilities**.

**Required setup outside the repo:**

1. In Apple Developer, enable **Sign in with Apple** for the App ID / bundle ID `com.riven.app`.
2. In the Supabase dashboard, enable the Apple auth provider for the hosted project. Do not rely on `supabase/config.toml` for hosted-project config.
3. In `server/.env`, set `APPLE_CLIENT_ID` so the legacy Express fallback can verify Apple ID tokens for the compatibility bridge.

## Payments: RevenueCat IAP (implemented) ✅

RevenueCat + StoreKit IAP is implemented for native iOS. Web / PWA keeps Stripe.

**Implementation:**

- **Native iOS** → `useRevenueCat` hook + `@revenuecat/purchases-capacitor`. `PricingModal` detects `Capacitor.isNativePlatform()` and calls `Purchases.purchasePackage()` instead of Stripe.
- **Web / PWA** → Stripe Checkout (unchanged).
- **Server sync** → `revenuecat-webhook` Supabase Edge Function updates `users.subscription_tier` from RC server-to-server events.

**RevenueCat dashboard setup (required before TestFlight / App Store):**

1. Create a project and connect iOS app (`com.riven.app`)
2. Create an **Entitlement** (`premium`) — map monthly + annual StoreKit products
3. Create an **Offering** with MONTHLY + ANNUAL packages
4. Copy the **iOS Public API Key** (`appl_xxxxx`) → set `VITE_RC_IOS_API_KEY` in `client/.env`
5. In App Store Connect, create Auto-Renewable Subscriptions and link them to RevenueCat
6. Set `RC_WEBHOOK_SECRET` via `npx supabase secrets set RC_WEBHOOK_SECRET=…` and configure the webhook URL in RC dashboard: `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`

## App Transport Security (ATS)

Release builds should avoid `NSAllowsArbitraryLoads`. The project uses tighter ATS where possible; **local HTTP** (simulator / LAN API) is supported via `NSAllowsLocalNetworking` and localhost exceptions in [`Info.plist`](../client/ios/App/App/Info.plist). Production APIs should use **HTTPS**.

## Advertising (Google AdSense)

AdSense scripts are **not loaded in the Capacitor native shell** (see [`loadAdsForWeb.js`](../client/src/utils/loadAdsForWeb.js)). For App Store review, confirm your app metadata and age rating reflect any ad or monetization strategy if you re-enable ads on native later.

## Stripe return URLs (Supabase Edge Functions)

Native requests may send `Origin: capacitor://localhost`. Edge Functions use the Supabase secret **`CLIENT_URL`** (canonical `https://…` web origin) for Stripe `success_url`, `cancel_url`, and portal `return_url` when that origin is not usable. Set `CLIENT_URL` in:

```bash
npx supabase secrets set CLIENT_URL=https://your-production-domain
```

## Checklist before submission

- [x] Sign in with Apple implemented for the native iOS app; verify Apple Developer + Supabase dashboard config in the release environment
- [x] Payments model documented and implemented per Apple rules (RevenueCat IAP)
- [ ] Privacy Nutrition Labels and `Info.plist` usage strings match actual behavior (camera, mic, photos, tracking)
- [ ] `CLIENT_URL` set; test checkout from device → redirect completes in Safari to your HTTPS site
- [ ] Screenshots and description match the native app (not only the PWA)
