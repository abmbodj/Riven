# iOS App Store preparation (Riven / Capacitor)

This document tracks product and technical decisions before submitting the Capacitor-wrapped app to App Review.

## Sign in with Apple (Guideline 4.8)

If the native app offers **third-party login** (e.g. Google), Apple generally requires **Sign in with Apple** unless an [exemption](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple) applies.

**Options:**

1. **Implement Sign in with Apple** for the iOS build: enable the Apple provider in Supabase Auth, configure Services ID / redirect URLs, and wire [`react-apple-signin-auth`](https://www.npmjs.com/package/react-apple-signin-auth) (already in `client/package.json`) in [`OAuthButtons.jsx`](../client/src/components/auth/OAuthButtons.jsx) when `Capacitor.isNativePlatform()` is true. Use the same session pattern as Google native (ID token → Supabase).
2. **Product change:** remove social login from the native app only (not ideal for parity).
3. **Legal review:** confirm whether your category qualifies for an exemption.

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

- [ ] Sign in with Apple (or documented exemption path)
- [x] Payments model documented and implemented per Apple rules (RevenueCat IAP)
- [ ] Privacy Nutrition Labels and `Info.plist` usage strings match actual behavior (camera, mic, photos, tracking)
- [ ] `CLIENT_URL` set; test checkout from device → redirect completes in Safari to your HTTPS site
- [ ] Screenshots and description match the native app (not only the PWA)
