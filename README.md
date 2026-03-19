# Riven

A full-stack flashcard and study platform built for students. Riven combines spaced-repetition study tools with class management, LMS integration, AI-powered card generation, social features, and a deeply customizable botanical aesthetic — all wrapped in a PWA with native iOS support.

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Supabase Edge Functions](#supabase-edge-functions)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Key Features

- **Deck & Card Management** — Folders, tags, image-based cards (front/back), deck sharing via unique codes.
- **Study Modes** — Standard study, test mode, and group cram sessions with real-time sync.
- **Class & Assignment Tracker** — Weekly timetable, assignments with Canvas/iCal sync.
- **AI Flashcard Generation** — Generate cards from text or document uploads via Google Gemini.
- **Social** — Friend system, direct messaging (text, images, deck sharing), blocking, and reporting.
- **Study Groups** — Shared decks, file folders, and live collaborative cram sessions.
- **Gamification** — Daily streaks, virtual garden/pet system with accessories.
- **Monetization** — Free / Supporter ($5.99/mo) / Lifetime ($29.99) tiers via Stripe. Hearts system for free-tier gating.
- **Referral Program** — Invite friends via referral codes, track qualified signups.
- **Full Theming** — User-defined color palettes, font pairs, and multiple saved themes.
- **Security** — 2FA (TOTP), email verification, password reset, XSS sanitization.
- **Role-Based Access** — `user`, `admin`, `owner` roles with admin panel for user management, analytics, and announcements.
- **PWA + iOS** — Offline-capable PWA with Capacitor wrapper for native iOS builds.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20+ |
| **Frontend** | React 19, Vite 7, React Router 7, Tailwind CSS 3, Motion (Framer), GSAP, Lucide React |
| **Backend** | Express 5 (API server) + Supabase Edge Functions (Deno) |
| **Database** | PostgreSQL via Supabase |
| **Auth** | Supabase Auth + JWT, Google OAuth, Apple Sign-In, 2FA (Speakeasy TOTP) |
| **AI** | Google Gemini (`@google/genai`) |
| **Payments** | Stripe (subscriptions + one-time purchases + webhooks) |
| **Email** | Resend (password resets, email verification) |
| **Real-time** | Socket.IO (DMs, group cram sessions) |
| **LMS Sync** | Canvas API, iCal parsing (`node-ical`) |
| **File Handling** | Mammoth (DOCX), react-pdf, docx-preview |
| **Offline** | IndexedDB (`idb`), Vite PWA Plugin |
| **Testing** | Vitest + Testing Library (client), Vitest + Supertest (server) |
| **Mobile** | Capacitor 8 (iOS native wrapper) |
| **Deployment** | Vercel (monorepo) + Supabase (DB + edge functions) |

---

## Prerequisites

- **Node.js** 20+
- **npm** (ships with Node)
- **Supabase CLI** — for local edge function development and deployment
  ```bash
  npm install -g supabase
  ```
- **PostgreSQL** 15+ — via Supabase (cloud) or local install for development

---

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd riven

# Root dependencies (concurrently)
npm install

# Server dependencies
cd server && npm install && cd ..

# Client dependencies
cd client && npm install && cd ..
```

### 2. Environment Setup

#### Server (`server/.env`)

```bash
cp server/.env.example server/.env
```

| Variable | Required | Description | Example / How to Get |
|----------|:--------:|-------------|---------------------|
| `DATABASE_URL` | **Yes** | Supabase PostgreSQL connection string | `postgresql://postgres.[ref]:[password]@aws-0-us-west-2.pooler.supabase.com:6543/postgres` |
| `JWT_SECRET` | **Yes** | Token signing key | `openssl rand -base64 32` |
| `SUPABASE_URL` | No | Supabase project URL | `https://[ref].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Service role key for privileged operations | Supabase dashboard → Settings → API |
| `GEMINI_API_KEY` | No | Google Gemini for AI card generation | [Google AI Studio](https://aistudio.google.com/) |
| `FRONTEND_URL` | No | Used for OAuth redirects | `http://localhost:5173` |
| `NODE_ENV` | No | `development` or `production` | `development` |
| `PORT` | No | API port | `3000` |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) | `http://localhost:5173,http://localhost:3000` |
| `STRIPE_SECRET_KEY` | No | Stripe server key | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret | Stripe CLI / dashboard |
| `RESEND_API_KEY` | No | Resend email API key | [Resend](https://resend.com) |
| `GOOGLE_CLIENT_ID` | No | Legacy Google ID-token verification for the compatibility bridge | GCP Console |
| `APPLE_CLIENT_ID` | No | Apple Sign-In service ID | Apple Developer |
| `APPLE_TEAM_ID` | No | Apple team identifier | Apple Developer |
| `APPLE_KEY_ID` | No | Apple private key ID | Apple Developer |
| `APPLE_PRIVATE_KEY` | No | Apple private key (PEM) | Apple Developer |

#### Client (`client/.env`)

```bash
cp client/.env.example client/.env
```

| Variable | Required | Description | Default (Dev) |
|----------|:--------:|-------------|:-------------:|
| `VITE_API_URL` | No | Backend API URL. Leave blank for local dev (Vite proxies `/api`). | — |
| `VITE_STRIPE_PRICE_MONTHLY` | No | Stripe Price ID for Supporter tier | — |
| `VITE_STRIPE_PRICE_LIFETIME` | No | Stripe Price ID for Lifetime tier | — |

Google Sign-In for web/PWA is configured in **Supabase Auth**, not in `client/.env`.

Configure it in two places:

1. **Google Cloud Console → OAuth client → Authorized redirect URIs**
   - `https://ghmnsmjjpdbpnrohjyrg.supabase.co/auth/v1/callback`
   - This must match the active Supabase project ref exactly. If the project ref changes, update this callback URI in Google Cloud before testing sign-in.
   - Do **not** add app routes like `/account` to Google Cloud redirect URIs.

2. **Supabase Auth → URL Configuration / Redirect allowlist**
   - Canonical Site URL: `https://riven.rocks`
   - Allowed redirect URLs:
     - `https://riven.rocks/account`
     - `http://localhost:5173/account`
     - `http://localhost:3000/account`
   - App return URLs such as `/account` belong in Supabase Auth, not in Google Cloud.

For local/self-hosted Supabase, mirror the commented Google provider block in [`supabase/config.toml`](/Users/ab/Desktop/Riven/Riven/supabase/config.toml) and provide `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` as environment variables.

### 3. Database Setup

Riven uses **Supabase-hosted PostgreSQL**. The server auto-creates all tables on startup via `server/db.js` — no manual migrations needed for initial setup.

For a fresh Supabase project:

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the connection string from **Settings → Database → Connection string (URI)**
3. Set it as `DATABASE_URL` in `server/.env`
4. Start the server — it handles schema creation, column migrations, index creation, and role seeding automatically

SQL migrations in `supabase/migrations/` handle additional schema changes (RLS policies, realtime config, deduplication).

### 4. Start Development

```bash
# From the project root — runs both client + server concurrently
npm start
```

This launches:
- **Server**: `http://localhost:3000` (Express with nodemon auto-reload)
- **Client**: `http://localhost:5173` (Vite dev server, proxies `/api` to server)

Or run them individually:

```bash
npm run server   # server only (nodemon)
npm run client   # client only (vite)
```

---

## Architecture

### Directory Structure

```
riven/
├── client/                        # React Frontend (Vite)
│   ├── src/
│   │   ├── api.js                 # Hybrid API module (server + IndexedDB offline fallback)
│   │   ├── api/                   # API client sub-modules (authApi, etc.)
│   │   ├── components/            # Reusable UI components
│   │   │   ├── auth/              # Login, Register, OAuth, 2FA modals
│   │   │   ├── layout/            # Sidebar, RootLayout
│   │   │   └── ui/                # Garden, Hearts, Pricing, PageLoader, etc.
│   │   ├── context/               # React contexts (Auth, Garden, Streak, Theme, UI)
│   │   ├── hooks/                 # Custom hooks (useAuth, useStreak, useTheme, etc.)
│   │   ├── pages/                 # Route-level page components
│   │   │   ├── Home.jsx           # Landing (unauth) / Dashboard (auth)
│   │   │   ├── Decks.jsx          # Deck list with folder/tag filtering
│   │   │   ├── DeckView.jsx       # Single deck view + card editor
│   │   │   ├── CreateDeck.jsx     # Manual, AI generate, or document import
│   │   │   ├── StudyMode.jsx      # Flashcard study session
│   │   │   ├── TestMode.jsx       # Quiz/test mode
│   │   │   ├── Classes.jsx        # Class management + schedule
│   │   │   ├── ClassView.jsx      # Single class: assignments, linked decks
│   │   │   ├── StudyGroups.jsx    # Group list + creation
│   │   │   ├── GroupDetails.jsx   # Group decks, files, members
│   │   │   ├── GroupCram.jsx      # Live collaborative cram session
│   │   │   ├── Friends.jsx        # Friend list + requests
│   │   │   ├── Messages.jsx       # Direct messaging
│   │   │   ├── Settings.jsx       # App settings, LMS integrations
│   │   │   ├── ThemeSettings.jsx  # Theme editor + saved themes
│   │   │   ├── AdminPanel.jsx     # Admin: user mgmt, analytics, announcements
│   │   │   └── ...                # Account, EditProfile, UserProfile, GardenSettings, etc.
│   │   ├── routes/                # React Router route definitions
│   │   ├── db/                    # IndexedDB helpers (offline storage)
│   │   ├── utils/                 # Utility functions + animation helpers
│   │   ├── App.jsx                # Root app component
│   │   ├── main.jsx               # Entry point
│   │   └── index.css              # Global styles + Tailwind base
│   ├── public/                    # Static assets (icons, manifest, sounds)
│   ├── ios/                       # Capacitor iOS project
│   ├── capacitor.config.json      # Capacitor config
│   ├── vite.config.js             # Vite config (proxy, PWA plugin)
│   └── tailwind.config.js         # Tailwind config (custom theme tokens)
│
├── server/                        # Express Backend
│   ├── index.js                   # Main entry: middleware, rate limiting, all route registration
│   ├── db.js                      # PostgreSQL pool + auto-schema init
│   ├── routes/                    # Modular route files
│   │   ├── auth.js                # Register, login, OAuth, 2FA, password reset, email verify
│   │   ├── admin.js               # Admin panel (user mgmt, analytics, announcements, bans)
│   │   ├── ai.js                  # AI card generation (Gemini), document parsing (Mammoth)
│   │   ├── classes.js             # CRUD for classes
│   │   ├── assignments.js         # CRUD for assignments
│   │   ├── schedule.js            # Weekly schedule slots
│   │   ├── groups.js              # Study groups, members, shared decks, files, cram sessions
│   │   ├── social.js              # Friends, DMs, blocking, reporting
│   │   ├── hearts.js              # Hearts system (free-tier gating, refills, rewards)
│   │   ├── lms.js                 # Canvas API + iCal sync
│   │   ├── stripe.js              # Checkout sessions, portal, subscription management
│   │   ├── webhooks.js            # Stripe webhook handler (idempotent)
│   │   ├── referrals.js           # Referral code generation, tracking, qualification
│   │   └── health.js              # Health check endpoint
│   ├── utils/
│   │   └── email.js               # Resend email helper
│   └── test/                      # Backend tests (Vitest + Supertest)
│
├── supabase/                      # Supabase Configuration
│   ├── config.toml                # Supabase project config
│   ├── functions/                 # Deno edge functions (18 functions + shared helpers)
│   │   ├── _shared/               # Shared helpers (auth, stripe, email, http)
│   │   ├── complete-registration/ # Post-signup user creation
│   │   ├── stripe-webhook/        # Stripe payment events
│   │   ├── forgot-password/       # Password reset initiation
│   │   ├── verify-email/          # Email verification
│   │   ├── reset-password/        # Complete password reset
│   │   ├── create-checkout/       # Stripe checkout session creation
│   │   ├── create-portal/         # Stripe billing portal
│   │   ├── canvas-lms/            # Canvas LMS integration
│   │   ├── generate-deck/         # AI deck generation
│   │   ├── generate-class/        # AI class generation
│   │   ├── ai-limits/             # AI generation rate limits
│   │   ├── hearts/                # Hearts system logic
│   │   ├── group-actions/         # Study group CRUD
│   │   ├── group-sessions/        # Group cram sessions
│   │   ├── account-actions/       # Account management
│   │   ├── admin-actions/         # Admin operations
│   │   ├── referrals/             # Referral tracking
│   │   └── accept-shared-deck/    # Shared deck acceptance
│   └── migrations/                # SQL migrations (RLS policies, realtime, deduplication)
│
├── riven-social/                  # Standalone social landing page (separate Vite/TS app)
├── package.json                   # Root scripts (concurrently runs client + server)
├── vercel.json                    # Vercel monorepo deployment config
└── .gitignore
```

### Request Lifecycle

Riven uses a **hybrid backend** — requests are handled by either the Express server or Supabase edge functions depending on the operation:

**Express Server Path** (traditional API):
```
User Action → React UI → api.js fetch → /api/* → Express Middleware → Route Handler → PostgreSQL → JSON Response
```

**Edge Function Path** (auth, payments, AI, groups):
```
User Action → React UI → Supabase client → Edge Function → PostgreSQL / Stripe / Gemini → JSON Response
```

**Offline Path** (PWA fallback):
```
User Action → React UI → api.js → IndexedDB (local) → Cached Response
```

### Authentication Flow

1. **Register / Login** → Supabase Auth handles email/password or OAuth (Google/Apple)
2. **Post-Signup** → `complete-registration` edge function creates the user record in the `users` table and links `supabase_auth_id`
3. **JWT** → Supabase issues JWT stored in session; server validates via `authMiddleware`
4. **2FA** → TOTP setup via Speakeasy, QR code via `qrcode` library. Enforced on login if enabled.
5. **Protected Routes** → `ProtectedRoute` component checks auth context on the client; `authMiddleware` validates JWT on the server

### State Management

React Context API for global state:

| Context | Purpose |
|---------|---------|
| `AuthContext` | User auth state, login/logout |
| `GardenContext` | Pet/streak garden state |
| `StreakContext` | Daily streak tracking |
| `ThemeContext` | User-defined theme (colors, fonts) |
| `UIContext` | Global UI state (modals, sidebar) |
| `ToastContext` | Toast notifications |

### Database Schema (Key Tables)

The full schema is defined in `server/db.js` and auto-creates on startup. Additional migrations live in `supabase/migrations/`.

| Table | Purpose |
|-------|---------|
| `users` | Profiles, auth, subscription tier, streak data, pet customization, 2FA, Stripe IDs, LMS tokens, referral codes, `supabase_auth_id` |
| `decks` / `cards` | Flashcard decks and cards with spaced repetition fields (difficulty, next_review) |
| `folders` / `tags` / `deck_tags` | Organizational folders and tagging system |
| `study_sessions` | Study/test session analytics (cards studied, accuracy, duration) |
| `classes` / `assignments` / `schedule_slots` | Course management with LMS sync |
| `study_groups` / `group_members` / `group_decks` | Study groups with shared content |
| `group_folders` / `group_files` | File sharing within groups |
| `cram_sessions` / `cram_responses` | Live collaborative study sessions |
| `themes` | User-created color themes with font pair customization |
| `shared_decks` | Publicly shared deck snapshots |
| `friendships` / `messages` | Social features (friends, DMs) |
| `user_blocks` / `reports` | Safety: blocking and content reporting |
| `referrals` | Referral tracking with qualification logic |
| `stripe_processed_events` | Webhook idempotency |

---

## Supabase Edge Functions

All edge functions are Deno-based and located in `supabase/functions/`. They share common helpers from `_shared/` (auth resolution, Stripe client, email utilities, HTTP response formatting).

### Auth & Account

| Function | Purpose |
|----------|---------|
| `complete-registration` | Creates user record in PostgreSQL after Supabase Auth signup |
| `verify-email` | Email verification flow |
| `forgot-password` | Initiate password reset (sends email via Resend) |
| `reset-password` | Complete password reset |
| `account-actions` | Account management (update profile, delete account, etc.) |

### Payments

| Function | Purpose |
|----------|---------|
| `create-checkout` | Create Stripe checkout session for subscription |
| `create-portal` | Generate Stripe billing portal link |
| `stripe-webhook` | Process Stripe events (subscription lifecycle, idempotent) |
| `hearts` | Hearts system logic (check balance, spend, refill) |

### AI & LMS

| Function | Purpose |
|----------|---------|
| `generate-deck` | AI flashcard generation from text/documents via Gemini |
| `generate-class` | AI class generation from notes |
| `ai-limits` | Check and enforce AI generation rate limits |
| `canvas-lms` | Canvas LMS integration (course/assignment sync) |

### Groups & Social

| Function | Purpose |
|----------|---------|
| `group-actions` | Create, join, manage study groups |
| `group-sessions` | Real-time cram session management |
| `accept-shared-deck` | Accept a shared deck into user's library |

### Admin & Referrals

| Function | Purpose |
|----------|---------|
| `admin-actions` | Admin panel operations (user management, announcements) |
| `referrals` | Referral code tracking and qualification |

### Deploying Edge Functions

```bash
# Deploy a specific function
npx supabase functions deploy <function-name>

# Example
npx supabase functions deploy complete-registration

# Deploy all functions
npx supabase functions deploy
```

---

## Environment Variables

### Server (`server/.env`)

**Required:**

| Variable | Description | How to Get |
|----------|-------------|------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string | Supabase dashboard → Settings → Database |
| `JWT_SECRET` | Token signing key | `openssl rand -base64 32` |

**Optional:**

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for privileged ops | — |
| `GEMINI_API_KEY` | Google Gemini API key | — |
| `STRIPE_SECRET_KEY` | Stripe server key | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |
| `RESEND_API_KEY` | Resend email API key | — |
| `GOOGLE_CLIENT_ID` | Legacy Google ID-token verification for the compatibility bridge | — |
| `APPLE_CLIENT_ID` | Apple Sign-In service ID | — |
| `APPLE_TEAM_ID` | Apple team identifier | — |
| `APPLE_KEY_ID` | Apple private key ID | — |
| `APPLE_PRIVATE_KEY` | Apple private key (PEM) | — |
| `FRONTEND_URL` | Frontend URL for redirects | `http://localhost:5173` |
| `PORT` | API server port | `3000` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | — |
| `NODE_ENV` | Environment | `development` |

### Client (`client/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL (blank for local dev) | — |
| `VITE_STRIPE_PRICE_MONTHLY` | Stripe Price ID for Supporter | — |
| `VITE_STRIPE_PRICE_LIFETIME` | Stripe Price ID for Lifetime | — |

Web/PWA Google Sign-In uses the Supabase-hosted redirect flow, so there is no `VITE_GOOGLE_CLIENT_ID` client variable in this setup. Configure the Supabase callback URI in Google Cloud and the `/account` return URLs in Supabase Auth as documented in the setup section above.

### Edge Functions

Edge function secrets are set via the Supabase dashboard or CLI:

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_...
npx supabase secrets set RESEND_API_KEY=re_...
npx supabase secrets set GEMINI_API_KEY=...
```

---

## Available Scripts

### Root

| Command | Description |
|---------|-------------|
| `npm start` | Run client + server concurrently (dev mode) |
| `npm run server` | Run server only (nodemon) |
| `npm run client` | Run client only (Vite) |

### Server (`cd server`)

| Command | Description |
|---------|-------------|
| `npm start` | Start server (`node index.js`) |
| `npm run dev` | Start server with auto-reload (`nodemon`) |
| `npm test` | Run backend tests (`vitest`) |

### Client (`cd client`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run frontend tests (`vitest`) |

---

## Testing

Both client and server use **Vitest**.

```bash
# Server tests (Vitest + Supertest for HTTP assertions)
cd server && npm test

# Client tests (Vitest + Testing Library + jsdom)
cd client && npm test
```

### Test Structure

```
server/test/          # Backend integration tests
client/src/test/      # Frontend component tests
```

---

## Deployment

Riven is deployed across three services:

### Vercel (Frontend + Express API)

The project is configured as a Vercel monorepo via `vercel.json`:

- `/api/*` → `server/index.js` (deployed as a serverless function via `@vercel/node`)
- `/*` → `client/` (built via `@vercel/static-build`, serves from `dist/`)

**Steps:**

1. Push to GitHub
2. Import project in Vercel dashboard
3. Set **Root Directory** to `./`
4. Add all environment variables from `server/.env` and `client/.env` to Vercel project settings
5. Deploy — Vercel auto-builds on each push

### Supabase (Database + Edge Functions)

- **Database**: PostgreSQL hosted on Supabase with connection pooling
- **Edge Functions**: Deno-based serverless functions deployed via Supabase CLI
- **Auth**: Supabase Auth handles signup/login flows

```bash
# Deploy a single edge function
npx supabase functions deploy <function-name>

# Run migrations
npx supabase db push
```

### iOS (Capacitor)

The client includes a Capacitor config for native iOS builds:

```bash
cd client
npx cap sync ios
npx cap open ios   # Opens in Xcode
```

---

## Troubleshooting

### PostgreSQL Connection Refused

**Error:** `connect ECONNREFUSED 127.0.0.1:5432`
**Fix:** Check `DATABASE_URL` format. For Supabase, use the pooler connection string from **Settings → Database → Connection string (URI)**.

### JWT Invalid Signature

**Error:** `JsonWebTokenError: invalid signature`
**Fix:** `JWT_SECRET` must stay consistent. Users need to log out and back in if the secret changes.

### Client Can't Reach API

**Error:** Network errors or CORS issues in dev
**Fix:** Ensure the server is running on port 3000. Vite proxies `/api` requests automatically in dev. Check `ALLOWED_ORIGINS` includes your frontend URL.

### Database Schema Issues

The server auto-migrates columns on every startup. If you see column-not-found errors, restart the server — it runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` migrations in `db.js`.

### Stripe Webhooks Not Processing

**Fix:** Ensure `STRIPE_WEBHOOK_SECRET` matches your Stripe dashboard. For local dev:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Edge Function Errors

**Fix:** Check edge function logs:
```bash
npx supabase functions logs <function-name>
```

Ensure all required secrets are set:
```bash
npx supabase secrets list
```

### Vite Build Failures

**Error:** `Command not found: vite`
**Fix:** Run `npm install` inside `client/`.
