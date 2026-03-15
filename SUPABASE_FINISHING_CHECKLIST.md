# Supabase Finishing Checklist

This is the exact Supabase-side work still needed to finish the migration for the current Riven codebase.

Project referenced from the dashboard screenshot:
- Project ref: `ghmnsmjipdbpnrohjyrg`
- Project URL shown: `https://ghmnsmjipdbpnrohjyrg.supabase.co`

Important warning:
- On March 15, 2026, the dashboard screenshot showed `0 Total Requests` and `Last migration: No migrations`.
- That strongly suggests this Supabase project is still empty or not yet wired into production traffic.
- Do not cut over production until the schema, config, functions, and live-flow testing are done.

## 1. Confirm This Is The Correct Project

Before doing anything else, confirm:
- This is the project your frontend will point to.
- This is the project you want to use for production.
- You are not supposed to be using an older Supabase project.

## 2. Get API Values

In the Supabase dashboard:
- Go to `Settings -> API`

Copy and verify:
- Project URL
- `anon` key
- `service_role` key

Current app variables expected by the codebase:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Rules:
- `anon` is safe for the client
- `service_role` must never be exposed to the browser

## 3. Configure Auth URL Settings

In the Supabase dashboard:
- Go to `Authentication -> URL Configuration`

Set:
- `Site URL` = your production frontend origin
- `Redirect URLs` = every auth/reset/verify callback origin you actually use

Minimum examples:
- `https://your-production-domain.com/**`
- `http://localhost:3000/**` or your actual local dev origin
- preview URL patterns if you use preview deployments

This matters for:
- signup email confirmation
- password reset
- email verification
- OAuth flows

## 4. Check Email Templates

In the Supabase dashboard:
- Go to `Authentication -> Email Templates`

Verify:
- your reset and verification emails work with redirects
- templates use `{{ .RedirectTo }}` where needed

If they only rely on `{{ .SiteURL }}`, reset/verify flows can send users to the wrong place.

## 5. Configure Auth Providers

In the Supabase dashboard:
- Go to `Authentication -> Providers`

Enable and configure only the providers you actually use:
- Email
- Google
- Apple

Make sure provider callback settings match your production and local URLs.

## 6. Deploy Database Schema

The dashboard showed `No migrations`, so the DB schema still needs to be pushed.

From the repo root:

```bash
supabase login
supabase link --project-ref ghmnsmjipdbpnrohjyrg
supabase db push --dry-run
supabase db push
```

After this, verify in the dashboard:
- tables exist
- auth-linked columns exist
- RLS policies are present

## 7. Set Edge Function Secrets

Use CLI for production secrets.

From the repo root:

```bash
supabase secrets set \
  FRONTEND_URL=https://your-production-domain.com \
  RESEND_API_KEY=your_resend_key \
  EMAIL_FROM='Riven <your@domain.com>' \
  --project-ref ghmnsmjipdbpnrohjyrg
```

Do not manually add these as custom secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Supabase provides those automatically in Edge Functions.

## 8. Deploy The Auth-Critical Edge Functions

From the repo root:

```bash
supabase functions deploy forgot-password --no-verify-jwt --project-ref ghmnsmjipdbpnrohjyrg
supabase functions deploy reset-password --no-verify-jwt --project-ref ghmnsmjipdbpnrohjyrg
supabase functions deploy verify-email --no-verify-jwt --project-ref ghmnsmjipdbpnrohjyrg
supabase functions deploy account-actions --project-ref ghmnsmjipdbpnrohjyrg
```

Why:
- `forgot-password`, `reset-password`, and `verify-email` are public email-link flows
- `account-actions` requires an authenticated bearer token

## 9. Deploy The Other Existing App Functions

If this project is meant to back the full app, also deploy the other functions already present in `supabase/functions/` and used by the client.

Existing function directories in this repo include:
- `accept-shared-deck`
- `admin-actions`
- `ai-limits`
- `canvas-lms`
- `create-checkout`
- `create-portal`
- `forgot-password`
- `generate-class`
- `generate-deck`
- `group-actions`
- `group-sessions`
- `hearts`
- `referrals`
- `reset-password`
- `verify-email`

If you want to deploy all of them, do it intentionally and verify which ones your production frontend actually calls.

## 10. Verify Functions In The Dashboard

In the Supabase dashboard:
- Go to `Edge Functions`

For each deployed function:
- confirm it appears
- confirm latest deploy succeeded
- use `Logs`
- use `Test` where practical

Pay special attention to:
- `forgot-password`
- `reset-password`
- `verify-email`
- `account-actions`

## 11. Update Your App Environment

In your frontend deployment environment, make sure:
- `VITE_SUPABASE_URL` points to this project
- `VITE_SUPABASE_ANON_KEY` matches this project

If the frontend still points to an old Supabase project, none of the dashboard work matters.

## 12. Run Live Flow Testing

After deployment, test these flows against the real deployed app:

1. Signup
- email/password signup
- first login
- app user row creation

2. Login/logout
- normal login
- logout
- refresh/session restore

3. Password recovery
- forgot-password email delivery
- reset via a fresh Supabase `token_hash` link
- reset via an old legacy hex link if you still have one

4. Email verification
- resend verification
- verify via a fresh Supabase link
- verify via an old legacy token if still supported

5. Account deletion
- delete account from an active Supabase session

6. 2FA
- Supabase MFA for newly enrolled users
- legacy 2FA login path for any old users that still depend on it

7. Function-backed app flows
- Stripe checkout portal
- group flows
- admin flows
- AI flows
- referrals
- hearts

## 13. What Still Remains After Supabase Setup

Even after Supabase is fully configured, the codebase still has some intentional compatibility surface:
- legacy 2FA compatibility
- rollout fallback branches for older deployments

That means:
- auth is mostly migrated to Supabase
- the old Express backend is reduced, but not fully removable yet

## 14. Recommended Order

Use this order exactly:

1. Confirm project
2. Set API/env values
3. Configure Auth URL settings
4. Configure providers
5. Push DB schema
6. Set secrets
7. Deploy auth Edge Functions
8. Deploy remaining app Edge Functions
9. Verify in dashboard
10. Test live flows
11. Only then cut production traffic fully over

## Official Supabase Docs Used

- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Auth Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [API Keys](https://supabase.com/docs/guides/api/api-keys)
- [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Edge Functions Overview](https://supabase.com/docs/guides/functions)
- [Deploy Edge Functions](https://supabase.com/docs/guides/functions/deploy)
- [Edge Functions Dashboard Quickstart](https://supabase.com/docs/guides/functions/quickstart-dashboard)
- [TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp)
