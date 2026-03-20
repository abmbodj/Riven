# What Is Riven?

Riven is a **full-stack flashcard and study platform** built for students. It combines spaced-repetition learning with class management, LMS integration, AI-powered content generation, real-time collaborative study, social features, gamification, and a subscription monetization layer — all delivered as a PWA with a native iOS wrapper.

---

## Core Purpose

Riven helps students:

1. **Create and study flashcard decks** using spaced-repetition algorithms.
2. **Organize their academic life** through class tracking, assignment management, and weekly schedules, with optional Canvas/iCal sync.
3. **Collaborate with peers** in real-time cram sessions and shared study groups.
4. **Generate content with AI** — turn raw text or uploaded documents into ready-to-study flashcard decks instantly via Google Gemini.
5. **Stay motivated** through daily streaks, a virtual garden/pet system, and a friends + messaging social layer.

---

## Feature Breakdown

### 📚 Flashcards & Decks
- Create decks with front/back cards (text + images).
- Organize decks into **folders** and tag them for filtering.
- **Share decks** via unique codes; other users can accept and add them to their own library.
- **Spaced repetition** fields track card difficulty and next review date.

### 🧠 Study Modes
- **Standard Study Mode** — flip cards, mark as known/unknown, track progress.
- **Test Mode** — quiz yourself and track accuracy per session.
- **Group Cram Sessions** — live, real-time collaborative study powered by Socket.IO, where all group members study the same deck together in sync.

### 🤖 AI Generation
- Generate flashcard decks from pasted **text prompts** or **document uploads** (DOCX via Mammoth).
- Generate class notes via AI.
- Rate-limited per user (free vs. Supporter tier) and enforced at the edge function level (`ai-limits`).
- Powered by **Google Gemini** (`@google/genai`).

### 🏫 Class & Assignment Tracker
- Add classes with color coding, room details, and a weekly schedule.
- Track assignments per class with due dates and completion status.
- Sync assignments from **Canvas LMS** (via Canvas API token) or an **iCal URL** for any compatible LMS or calendar system.
- Link flashcard decks directly to a class for organized study.

### 👥 Study Groups
- Create or join groups with a shared invite code.
- Groups have their own **shared deck library** and a **file folder system** (upload/preview files inside the group).
- Members can launch live **group cram sessions** that all participants join and study together in real time.

### 💬 Social Layer
- **Friend system** — send, accept, and manage friend requests.
- **Direct messaging** — text, images, and deck sharing inside DMs.
- **Blocking and reporting** — safety tools to block users and report content.
- **User profiles** with customizable display and pet/garden showcase.

### 🌱 Gamification
- **Daily streaks** — study every day to keep your streak alive.
- **Virtual garden/pet system** — earn and equip accessories for your pet; the garden reflects your study activity.
- **Hearts system** — free-tier users have a limited number of hearts; losing all hearts gates certain actions, incentivizing consistent use or upgrading.

### 💳 Monetization
- **Free tier** with hearts-based gating on advanced features.
- **Supporter** subscription:
  - Monthly: $5.99/mo
  - Annual: $74.99/yr
- **Lifetime access** — awarded via referrals, admin grants, or promotional campaigns.
- Payments processed via **Stripe** (subscriptions, one-time, webhooks with idempotency).
- Billing portal and checkout session creation handled via Supabase edge functions.

### 🎁 Referral Program
- Every user gets a unique referral code.
- Referred signups are tracked; once a referred user qualifies (meets activity thresholds), the referrer is rewarded.
- Full referral tracking and qualification logic in `server/routes/referrals.js` and the `referrals` edge function.

### 🎨 Theming
- Full user-defined **color palettes** and **font pair** selection.
- Create and save multiple named themes; switch at any time.
- Botanical / nature aesthetic as the foundational design language.

### 🔐 Security & Auth
- **Email/password** registration and login via Supabase Auth.
- **Google OAuth** and **Apple Sign-In** (web/PWA and native iOS).
- **Two-factor authentication (2FA)** — TOTP via Speakeasy, QR code enrollment.
- **Email verification** and **password reset** flows via Resend.
- **JWT** sessions issued by Supabase; validated on every protected API request.
- XSS sanitization on user-generated content.
- Row-Level Security (RLS) policies on all Supabase tables.
- Rate limiting on all Express API endpoints.

### 🛡️ Role-Based Access
- Three roles: `user`, `admin`, `owner`.
- **Admin panel** — manage users, view analytics, post announcements, handle bans.
- Admin operations available both in the Express server (`server/routes/admin.js`) and as a Supabase edge function (`admin-actions`).

### 📱 PWA + iOS
- **Progressive Web App** — installable, offline-capable with IndexedDB caching via the `idb` library.
- **Native iOS** — Capacitor 8 wraps the web app into a native Xcode project.
- Features native **Google Sign-In**, `HashRouter` for deep-link compatibility, and Capacitor-aware Stripe checkout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 20+ |
| **Frontend** | React 19, Vite 7, React Router 7, Tailwind CSS 3, Motion (Framer), GSAP, Lucide React |
| **Backend** | Express 5 (API server) + Supabase Edge Functions (Deno) |
| **Database** | PostgreSQL via Supabase |
| **Auth** | Supabase Auth, Google OAuth, Apple Sign-In, 2FA (Speakeasy TOTP), JWT |
| **AI** | Google Gemini (`@google/genai`) |
| **Payments** | Stripe (subscriptions, one-time, webhooks) |
| **Email** | Resend |
| **Real-time** | Socket.IO (DMs + group cram) |
| **LMS Sync** | Canvas API, iCal (`node-ical`) |
| **File Handling** | Mammoth (DOCX), react-pdf, docx-preview |
| **Offline** | IndexedDB (`idb`), Vite PWA Plugin |
| **Testing** | Vitest + Testing Library (client), Vitest + Supertest (server) |
| **Mobile** | Capacitor 8 (iOS) |
| **Deployment** | Vercel (frontend + Express API) + Supabase (DB + edge functions) |

---

## Architecture Overview

Riven is a **monorepo** with three main layers:

```
riven/
├── client/       # React SPA (Vite, Tailwind, Capacitor)
├── server/       # Express 5 REST API (Node.js)
└── supabase/     # Supabase config, edge functions (Deno), SQL migrations
```

### Request Routing

| Path | Handler |
|---|---|
| UI rendering | React SPA (client) |
| `/api/*` general | Express server (`server/index.js`) |
| Auth, payments, AI, groups | Supabase edge functions (`supabase/functions/`) |
| Offline fallback | IndexedDB via `api.js` |

### Backend: Express Server (`server/`)

The Express server handles:

| Route Module | Responsibility |
|---|---|
| `auth.js` | Register, login, OAuth, 2FA, password reset, email verify |
| `admin.js` | User management, analytics, announcements, bans |
| `ai.js` | AI card/deck generation, document parsing |
| `classes.js` / `assignments.js` / `schedule.js` | Class/assignment/schedule CRUD |
| `groups.js` | Study groups, members, shared decks, files, cram sessions |
| `social.js` | Friends, DMs, blocking, reporting |
| `hearts.js` | Hearts system (free-tier gating) |
| `lms.js` | Canvas API + iCal sync |
| `stripe.js` / `webhooks.js` | Stripe checkout, portal, idempotent webhook processing |
| `referrals.js` | Referral generation, tracking, qualification |
| `health.js` | Health check endpoint |

The database schema (all tables) is auto-created and auto-migrated on server startup via `server/db.js`.

### Backend: Supabase Edge Functions (`supabase/functions/`)

18 Deno-based serverless functions handling auth-sensitive, payment, and AI workloads:

| Category | Functions |
|---|---|
| Auth & Account | `complete-registration`, `verify-email`, `forgot-password`, `reset-password`, `account-actions` |
| Payments | `create-checkout`, `create-portal`, `stripe-webhook`, `hearts` |
| AI & LMS | `generate-deck`, `generate-class`, `ai-limits`, `canvas-lms` |
| Groups & Social | `group-actions`, `group-sessions`, `accept-shared-deck` |
| Admin & Referrals | `admin-actions`, `referrals` |

Shared helpers in `supabase/functions/_shared/` handle auth resolution, Stripe client initialization, email utilities, and HTTP response formatting.

### Frontend: React SPA (`client/src/`)

State is managed with React Context API:

| Context | Purpose |
|---|---|
| `AuthContext` | Auth state, login/logout |
| `GardenContext` | Pet/garden state |
| `StreakContext` | Daily streak tracking |
| `ThemeContext` | User theme (colors, fonts) |
| `UIContext` | Modals, sidebar state |
| `ToastContext` | Toast notifications |

Key page components: `Decks`, `DeckView`, `StudyMode`, `TestMode`, `Classes`, `StudyGroups`, `GroupCram`, `Messages`, `Friends`, `Settings`, `ThemeSettings`, `AdminPanel`.

### Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `users` | Profiles, auth IDs, subscription tiers, streaks, pet state, 2FA, Stripe IDs, LMS tokens, referral codes |
| `decks` / `cards` | Flashcard decks + spaced-repetition card fields |
| `folders` / `tags` / `deck_tags` | Deck organization layer |
| `study_sessions` | Session analytics (cards studied, accuracy, duration) |
| `classes` / `assignments` / `schedule_slots` | LMS-synced class and assignment management |
| `study_groups` / `group_members` / `group_decks` | Group study collaboration |
| `group_folders` / `group_files` | File sharing within groups |
| `cram_sessions` / `cram_responses` | Live collaborative study sessions |
| `themes` | Saved user-defined color/font themes |
| `shared_decks` | Publicly shared deck snapshots |
| `friendships` / `messages` | Social: friends + DMs |
| `user_blocks` / `reports` | Safety: blocking + reporting |
| `referrals` | Referral code tracking and qualification |
| `stripe_processed_events` | Stripe webhook idempotency |

---

## Deployment

| Service | What It Hosts |
|---|---|
| **Vercel** | React SPA (static) + Express API (serverless via `@vercel/node`) |
| **Supabase** | PostgreSQL database + Deno edge functions + Auth |
| **Apple App Store** | Native iOS app (via Capacitor + Xcode) |

The `vercel.json` at the project root configures the monorepo: `/api/*` routes to `server/index.js` and everything else to the `client/dist/` build output.

---

## Summary

Riven is a **production-grade student study platform** that competes with tools like Quizlet, Anki, and Notion. Its differentiators are:

- **AI-native** deck generation from any text or document.
- **Real-time collaboration** — group cram sessions are live and synchronized.
- **Deep LMS integration** — Canvas and iCal sync manage your academic schedule automatically.
- **Gamified motivation** — streaks, hearts, and a virtual garden keep users engaged daily.
- **Full monetization stack** — Stripe subscriptions with a hearts-gated free tier and a referral program.
- **Cross-platform** — works as a PWA in any browser and as a native iOS app.
