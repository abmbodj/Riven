# Riven

Riven is a full-stack flashcard and study platform built for students. It combines spaced-repetition study tools with class/assignment management, LMS integration (Canvas, iCal), AI-powered card generation, social features (friends, DMs, study groups), monetization (Stripe subscriptions + hearts system), and a deeply customizable "Botanical Journal" aesthetic.

## Key Features

- **Deck & Card Management** — Folders, tags, image-based cards (front/back), deck sharing via unique codes.
- **Study Modes** — Standard study, test mode, and group cram sessions with real-time Socket.IO sync.
- **Class & Assignment Tracker** — Full class schedule with weekly timetable, assignments with Canvas/iCal sync.
- **AI Flashcard Generation** — Generate cards from text or document uploads via Google Gemini API.
- **Social** — Friend system, direct messaging (text, images, deck sharing), user blocking, and reporting.
- **Study Groups** — Create/join groups with shared decks, file folders, and live cram sessions.
- **Gamification** — Daily streaks, virtual garden/pet system with accessories.
- **Monetization** — Free / Supporter ($5.99/mo) / Lifetime ($29.99) tiers via Stripe. Hearts system for free-tier gating.
- **Referral Program** — Invite friends via referral codes, track qualified signups.
- **Full Theming** — User-defined color palettes, font pairs, and multiple saved themes.
- **Security** — 2FA (TOTP via authenticator apps), email verification, password reset via Resend, XSS sanitization.
- **Role-Based Access** — `user`, `admin`, `owner` roles. Admin panel with user management, analytics, global announcements.
- **PWA + iOS** — Offline-capable PWA with Capacitor wrapper for native iOS builds.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20+ |
| **Frontend** | React 19, Vite 7, React Router 7, Tailwind CSS 3, Motion (Framer), Lucide React |
| **Backend** | Express 5 |
| **Database** | PostgreSQL (via `pg` driver, auto-migrating schema) |
| **Auth** | JWT + Bcrypt, Google OAuth, Apple Sign-In, 2FA (Speakeasy) |
| **AI** | Google Gemini (`@google/genai`) |
| **Payments** | Stripe (subscriptions + one-time purchases + webhooks) |
| **Email** | Resend (password resets, email verification) |
| **Real-time** | Socket.IO (DMs, group cram sessions) |
| **LMS Sync** | Canvas API direct, iCal parsing (`node-ical`), Edlink OAuth |
| **Testing** | Vitest + Testing Library (client), Vitest + Supertest (server) |
| **Mobile** | Capacitor (iOS native wrapper) |
| **Deployment** | Vercel (monorepo: `@vercel/node` for API, `@vercel/static-build` for client) |

---

## Prerequisites

- **Node.js** 20+ (see `client/.nvmrc`)
- **PostgreSQL** 15+ — local install, Docker, or cloud (Supabase, Railway, Neon, etc.)
- **npm** (ships with Node)

---

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd riven

# Root (concurrently)
npm install

# Server
cd server && npm install && cd ..

# Client
cd client && npm install && cd ..
```

### 2. Environment Setup

#### Server (`server/.env`)

Copy the example and fill in your values:

```bash
cp server/.env.example server/.env
```

| Variable | Required | Description | Example / How to Get |
|----------|:--------:|-------------|---------------------|
| `DATABASE_URL` | **Yes** | Postgres connection string | `postgresql://user:pass@localhost:5432/riven` |
| `JWT_SECRET` | **Yes** | Token signing key | `openssl rand -base64 32` |
| `GEMINI_API_KEY` | No | Google Gemini for AI card generation | [Google AI Studio](https://aistudio.google.com/) |
| `EDLINK_CLIENT_ID` | No | Edlink LMS OAuth (universal sync) | Edlink dashboard |
| `EDLINK_SECRET` | No | Edlink LMS OAuth secret | Edlink dashboard |
| `FRONTEND_URL` | No | Used for OAuth redirects | `http://localhost:5173` |
| `NODE_ENV` | No | `development` or `production` | `development` |
| `PORT` | No | API port | `3000` |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) | `http://localhost:5173,http://localhost:3000` |
| `STRIPE_SECRET_KEY` | No | Stripe server key | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret | Stripe CLI / dashboard |
| `RESEND_API_KEY` | No | Resend email API key | [Resend](https://resend.com) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID | GCP Console |
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

### 3. Database Setup

The server **auto-creates all tables** on startup via `server/db.js`. No manual migrations needed.

Just make sure the database exists:

```bash
createdb riven
```

Then start the server and it handles the rest (schema creation, column migrations, index creation, role seeding).

### 4. Start Development

```bash
# From the project root — runs both client + server concurrently
npm start
```

This launches:
- **Server**: `http://localhost:3000` (Express, nodemon auto-reload)
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
├── client/                    # React Frontend (Vite)
│   ├── src/
│   │   ├── api/               # API client (fetch wrappers) + Stripe helpers
│   │   ├── api.js             # Main API module (all endpoint calls)
│   │   ├── components/        # Reusable UI components
│   │   │   ├── auth/          # Login, Register, ForgotPassword, AppleSignIn, etc.
│   │   │   ├── layout/        # Sidebar sub-components
│   │   │   ├── ui/            # GardenLanding, HeartsDisplay, PricingModal, PageLoader, etc.
│   │   │   ├── Garden.jsx     # Streak garden / virtual pet renderer
│   │   │   ├── Layout.jsx     # App shell (sidebar, mobile nav, global providers)
│   │   │   └── ...            # Toast, Modals, ErrorBoundary, PullToRefresh, etc.
│   │   ├── context/           # React contexts (Auth, Socket, Theme, Offline, Hearts, etc.)
│   │   ├── hooks/             # Custom hooks (useAuth, useStreak, useSocket, useToast, etc.)
│   │   ├── pages/             # Route-level page components
│   │   │   ├── Home.jsx       # Landing page (unauthenticated) + Dashboard (authenticated)
│   │   │   ├── Decks.jsx      # Deck list with folder/tag filtering
│   │   │   ├── DeckView.jsx   # Single deck view, card editor
│   │   │   ├── CreateDeck.jsx # New deck: manual, AI generate, document import
│   │   │   ├── StudyMode.jsx  # Flashcard study session
│   │   │   ├── TestMode.jsx   # Quiz/test mode
│   │   │   ├── Classes.jsx    # Class management + schedule
│   │   │   ├── ClassView.jsx  # Single class: assignments, linked decks
│   │   │   ├── StudyGroups.jsx # Group list + creation
│   │   │   ├── GroupDetails.jsx# Group deck sharing, files, members
│   │   │   ├── GroupCram.jsx  # Live collaborative cram session
│   │   │   ├── Friends.jsx    # Friend list + requests
│   │   │   ├── Messages.jsx   # Direct messaging
│   │   │   ├── Settings.jsx   # App settings, integrations (Canvas, Edlink)
│   │   │   ├── ThemeSettings.jsx # Theme editor + saved themes
│   │   │   ├── AdminPanel.jsx # Admin: user management, analytics, announcements
│   │   │   └── ...            # Account, EditProfile, UserProfile, GardenSettings, etc.
│   │   ├── routes/            # React Router route definitions
│   │   ├── db/                # IndexedDB helpers (offline storage)
│   │   ├── utils/             # Utility functions
│   │   ├── App.jsx            # Root app component
│   │   ├── main.jsx           # Entry point
│   │   └── index.css          # Global styles + Tailwind base
│   ├── public/                # Static assets (icons, manifest, sounds)
│   ├── ios/                   # Capacitor iOS project
│   ├── capacitor.config.json  # Capacitor config
│   ├── vite.config.js         # Vite config (proxy, PWA plugin)
│   ├── tailwind.config.js     # Tailwind config (custom theme tokens)
│   └── vitest.config.js       # Frontend test config
│
├── server/                    # Express Backend
│   ├── index.js               # Main entry: Express app setup, middleware, all route registration
│   ├── db.js                  # Database connection pool + full schema auto-init
│   ├── routes/                # Modular route files
│   │   ├── auth.js            # Register, login, logout, OAuth (Google/Apple), 2FA, password reset, email verify
│   │   ├── admin.js           # Admin panel endpoints (user mgmt, analytics, announcements, bans)
│   │   ├── ai.js              # AI card generation (Gemini), document parsing (Mammoth)
│   │   ├── classes.js         # CRUD for classes
│   │   ├── assignments.js     # CRUD for assignments
│   │   ├── schedule.js        # Week schedule slots
│   │   ├── groups.js          # Study groups, members, shared decks, files, cram sessions
│   │   ├── social.js          # Friends, DMs, blocking, reporting
│   │   ├── hearts.js          # Hearts system (free-tier gating, refills, practice rewards)
│   │   ├── lms.js             # Canvas direct integration + iCal sync
│   │   ├── stripe.js          # Checkout sessions, portal, subscription management
│   │   ├── webhooks.js        # Stripe webhook handler (subscription lifecycle, idempotent)
│   │   ├── referrals.js       # Referral code generation, tracking, qualification
│   │   └── health.js          # Health check endpoint
│   ├── utils/
│   │   └── email.js           # Resend email helper
│   ├── test/                  # Backend tests
│   └── vitest.config.js       # Backend test config
│
├── riven-social/              # Standalone social landing page (separate Vite/TS app)
│
├── package.json               # Root scripts (concurrently runs client + server)
├── vercel.json                # Vercel monorepo deployment config
└── .gitignore
```

### Request Lifecycle

1. **Client** — User interacts with React UI.
2. **API Call** — `api.js` sends a fetch to `/api/*` (proxied by Vite in dev, routed by Vercel in prod).
3. **Express Middleware** — `helmet`, `cors`, `cookie-parser`, `express-rate-limit`, `express-slow-down`, JWT auth extraction.
4. **Route Handler** — Route files in `server/routes/` process the request.
5. **Database** — `db.js` executes parameterized SQL via `pg` pool (`query`, `queryOne`, `execute`).
6. **Response** — JSON response sent back to client.

### Authentication Flow

- **Register / Login** → Server issues JWT stored in an HttpOnly cookie + returns user object.
- **Google/Apple OAuth** → Verified server-side via `google-auth-library` / `apple-signin-auth`, then same JWT flow.
- **2FA** → TOTP setup via `speakeasy`, QR code via `qrcode`. Enforced on login if enabled.
- **Protected Routes** → `authMiddleware` extracts JWT from cookie, attaches `req.user`.

### Database Schema (Key Tables)

The full schema is defined in `server/db.js` and auto-creates on startup. Key tables:

| Table | Purpose |
|-------|---------|
| `users` | Profiles, auth, subscription tier, streak data, pet customization, 2FA, Stripe IDs, LMS tokens, referral codes |
| `decks` | Flashcard decks, linked to folders and classes |
| `cards` | Individual cards with text/image front+back, spaced repetition fields (difficulty, next_review) |
| `folders` | Organizational folders for decks |
| `tags` / `deck_tags` | Tagging system for decks |
| `study_sessions` | Study/test session analytics (cards studied, accuracy, duration) |
| `classes` | User classes with color, professor, room, zoom link, Canvas/Edlink integration |
| `assignments` | Assignments linked to classes with due dates, status, type, Canvas sync |
| `schedule_slots` | Weekly class schedule (day_of_week, start/end time) |
| `study_groups` | Groups with join codes, linked classes |
| `group_members` | Group membership (admin/member roles) |
| `group_decks` | Decks shared into groups |
| `group_folders` / `group_files` | File sharing within groups |
| `cram_sessions` / `cram_responses` | Live collaborative study sessions |
| `themes` | User-created color themes with font pair customization |
| `shared_decks` | Publicly shared deck snapshots |
| `friendships` | Friend requests and connections |
| `messages` | Direct messages (text, images, deck shares, edit tracking) |
| `global_messages` / `user_dismissed_messages` | Admin announcements + dismiss tracking |
| `referrals` | Referral tracking with qualification logic |
| `user_blocks` / `reports` | Safety: blocking and content reporting |
| `password_reset_tokens` / `email_verification_tokens` | Auth token lifecycle |
| `stripe_processed_events` | Webhook idempotency |

---

## Available Scripts

### Root

| Command | Description |
|---------|-------------|
| `npm start` | Run client + server concurrently (dev mode) |
| `npm run server` | Run server only (`nodemon`) |
| `npm run client` | Run client only (`vite`) |

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
# Server tests (with Supertest for HTTP assertions)
cd server && npm test

# Client tests (with Testing Library + jsdom)
cd client && npm test
```

Server tests live in `server/test/`. Client tests live in `client/src/test/`.

---

## Deployment

### Vercel (Current Setup)

The project is configured as a Vercel monorepo. `vercel.json` at the root handles routing:

- `/api/*` → `server/index.js` (deployed as a serverless function via `@vercel/node`)
- `/*` → `client/` (built via `@vercel/static-build`, serves from `dist/`)

**Steps:**

1. Push to GitHub.
2. Import project in Vercel dashboard.
3. Set **Root Directory** to `./`.
4. Add all environment variables from `server/.env` and `client/.env` to Vercel project settings.
   - For `VITE_API_URL`, use the full backend URL (e.g., `https://your-api.railway.app/api`) if the API is hosted separately, or leave blank if co-located.
5. Deploy. Vercel will auto-build on each push.

**`vercel.json`:**
```json
{
  "builds": [
    { "src": "server/index.js", "use": "@vercel/node" },
    { "src": "client/package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/server/index.js" },
    { "src": "/(.*)", "dest": "/client/$1" }
  ]
}
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
**Fix:** Ensure Postgres is running. Check `DATABASE_URL` format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`.

### JWT Invalid Signature
**Error:** `JsonWebTokenError: invalid signature`
**Fix:** `JWT_SECRET` changed? Users need to log out and back in (or clear cookies). The secret must stay consistent.

### Client Can't Reach API
**Error:** Network errors or CORS issues in dev.
**Fix:** Ensure the server is running on port 3000. Vite proxies `/api` requests automatically in dev. Check `ALLOWED_ORIGINS` includes your frontend URL.

### Vite Build Failures
**Error:** `Command not found: vite`
**Fix:** Run `npm install` inside `client/`.

### Database Schema Issues
The server auto-migrates columns on every startup. If you see column-not-found errors, just restart the server and it will run the `ALTER TABLE ADD COLUMN IF NOT EXISTS` migrations in `db.js`.

### Stripe Webhooks Not Processing
**Fix:** Ensure `STRIPE_WEBHOOK_SECRET` matches your Stripe dashboard. For local dev, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
