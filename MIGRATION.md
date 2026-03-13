# Riven: Render → Supabase Full Migration Guide

**Status:** Phase 1 complete. Core Phase 2 content/data CRUD now runs through Supabase for `classes`, `assignments`, `schedule`, `folders`, `tags`, `themes`, `decks`, `cards`, `study_sessions`, and DM `messages`. Additional Phase 2 profile/social/group/system-message routes still need a separate cleanup pass. Phase 3 Edge Function work and broader Phase 4 socket replacement remain.
**Goal:** Eliminate Render backend, consolidate onto Supabase (Auth, PostgREST, Edge Functions, Realtime, Storage).

---

## Architecture Overview

| Layer | Before | After |
|-------|--------|-------|
| Auth | Custom JWT + bcryptjs (Express) | Supabase Auth |
| Database | Supabase PostgreSQL via `pg` driver | Same DB, direct client queries + RLS |
| API | 137 Express routes on Render | Supabase PostgREST + Edge Functions |
| Real-time | Socket.io on Render | Supabase Realtime |
| File Storage | Already Supabase Storage | No change |

### Critical Architecture Facts
- **Integer user IDs** — entire DB uses integer PKs. Supabase Auth uses UUIDs. Bridge: `supabase_auth_id UUID` column on `users` table.
- **bcrypt passwords cannot be migrated** — Solved via hybrid auth: Express accepts both old JWTs and Supabase JWTs simultaneously.
- **TOTP 2FA secrets** cannot be imported into Supabase MFA — existing 2FA users must re-enroll after transition.
- **Edge Functions run Deno** — `mammoth` (DOCX), `node-ical` (Canvas sync), `speakeasy` (TOTP) must be verified or replaced.

---

## Phase 1: Auth Migration ✅ COMPLETE

Replace custom JWT login with Supabase Auth while keeping Express running.

### What was done

**Database:**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_auth_id UUID UNIQUE;
CREATE INDEX idx_users_supabase_auth_id ON users(supabase_auth_id);
```

**`server/index.js` — `authMiddleware`:**
Supports both Supabase JWT and legacy JWT simultaneously (zero downtime):
1. Decodes token header to detect algorithm
2. Verifies as Supabase JWT first (audience = `authenticated`)
3. Looks up `users` row by `supabase_auth_id`
4. Falls back to legacy JWT verify on failure

**`server/index.js` — Socket.io `register` handler:**
Same dual-JWT logic applied.

**`server/routes/auth.js` — New endpoints:**
- `POST /api/auth/complete-registration` — verifies token via Supabase `/auth/v1/user` API, creates or links `users` row
- `POST /api/auth/link-supabase` — links Supabase account to existing legacy user

**`server/routes/auth.js` — Existing endpoints now bridged to Supabase Auth for linked users:**
- `PUT /api/auth/password`
- `DELETE /api/auth/account`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/send-verification`
- `POST /api/auth/verify-email`

**`client/src/api/authApi.js`:**
- `register()` → `supabase.auth.signUp()` + `completeRegistration()`, falls back to legacy Express register if no session returned (email confirm enabled)
- `login()` → `supabase.auth.signInWithPassword()`, falls back to legacy Express login
- `loginWithGoogle()` → `supabase.auth.signInWithIdToken({ provider: 'google' })`
- `loginWithApple()` → `supabase.auth.signInWithIdToken({ provider: 'apple' })`
- `logout()` → `supabase.auth.signOut()` + legacy Express logout
- Added `refreshSupabaseToken()` helper

**`client/src/context/AuthContext.jsx`:**
- `initAuth` calls `refreshSupabaseToken()` first to restore expired Supabase sessions
- `onAuthStateChange` listener syncs token on `TOKEN_REFRESHED` / `SIGNED_OUT`

### 2FA strategy
- Existing users with `two_fa_enabled = true`: still go through `POST /api/auth/2fa/login` on Express after Supabase login
- New users: offer Supabase-native MFA (`supabase.auth.mfa.enroll()`) in future

### Verification checklist
- [x] New signup creates user in Supabase auth AND `users` table
- [x] Existing email/password login works (Supabase JWT path)
- [x] `supabase_auth_id` populated in `users` table on first login
- [x] Old JWT sessions still work until expiry
- [ ] Google OAuth end-to-end (Supabase Dashboard config required)
- [ ] Apple OAuth end-to-end (Supabase Dashboard config required)
- [x] Password reset email flow
- [x] 2FA challenge still works for existing `two_fa_enabled = true` users

### Supabase Dashboard config needed (Google/Apple OAuth)
1. Go to **Authentication → Providers**
2. Enable Google — add Client ID + Secret from Google Cloud Console
3. Enable Apple — add Client ID + Key from Apple Developer
4. Set **Site URL**: `https://riven-qif1.vercel.app`
5. Add **Redirect URLs**: `https://riven-qif1.vercel.app/account`

---

## Phase 2: Simple CRUD → Supabase Client + RLS

Replace Express CRUD routes with direct Supabase client queries + Row Level Security policies.
**No Edge Functions needed for these — PostgREST handles them.**

Completed in code today:
- `client/src/api/authApi.js` now uses Supabase queries for `folders`, `tags`, `classes`, `assignments`, `schedule_slots`, `themes`, `decks`, `cards`, `study_sessions`, and DM `messages`
- `client/src/pages/Messages.jsx` now consumes Supabase Realtime for DM inserts/updates/deletes while keeping Socket.io only for typing indicators
- Legacy Express handlers for `classes`, `assignments`, `schedule`, `folders`, `tags`, `themes`, `decks`, `cards`, `study_sessions`, and DM CRUD have been removed from `server/index.js`
- `supabase/migrations/phase2_rls_policies.sql` now includes owner/shared deck policies, card/session policies, DM policies, and the `mark_messages_read` RPC

### Migration order (simplest first)

| Priority | Tables | Route files |
|----------|--------|-------------|
| 1 | `classes` | `server/routes/classes.js` |
| 2 | `assignments` | `server/routes/assignments.js` |
| 3 | `schedule` | `server/routes/schedule.js` |
| 4 | `folders`, `tags` | `server/index.js` (inline) |
| 5 | `themes` | `server/index.js` (inline) |
| 6 | `decks`, `cards`, `study_sessions` | `server/index.js` (inline) |
| 7 | `group_files`, `group_folders` | `server/routes/groups.js` (partial) |
| 8 | `messages` (DMs) | `server/index.js` (inline) |

### RLS policy pattern (repeat for each table)

```sql
-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Owner: full access
CREATE POLICY "owner_all" ON classes FOR ALL
    USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
```

For tables with shared access (e.g., group decks), add a secondary SELECT policy:
```sql
-- Members can read decks shared to their groups
CREATE POLICY "group_member_read" ON decks FOR SELECT
    USING (
        id IN (
            SELECT deck_id FROM group_decks gd
            JOIN group_members gm ON gm.group_id = gd.group_id
            JOIN users u ON u.id = gm.user_id
            WHERE u.supabase_auth_id = auth.uid()
        )
    );
```

### Frontend change pattern

**Before:**
```javascript
// client/src/api/authApi.js
export const getClasses = () => authFetch('/classes');
export const createClass = (data) => authFetch('/classes', { method: 'POST', body: JSON.stringify(data) });
```

**After:**
```javascript
// client/src/api/classesApi.js  (new module)
import { supabase } from '../lib/supabaseClient';

export const getClasses = async () => {
    const { data, error } = await supabase.from('classes').select('*').order('name');
    if (error) throw error;
    return data;
};

export const createClass = async (payload) => {
    const { data, error } = await supabase.from('classes').insert(payload).select().single();
    if (error) throw error;
    return data;
};
```

### Per-table SQL + frontend tasks

#### `classes` table
```sql
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON classes FOR ALL
    USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
```
Remove: `server/routes/classes.js` registration in `server/index.js`

#### `assignments` table
```sql
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON assignments FOR ALL
    USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
```
Remove: `server/routes/assignments.js` registration

#### `schedule_slots` table
```sql
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON schedule_slots FOR ALL
    USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
```
Remove: `server/routes/schedule.js` registration

#### `folders` table
```sql
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON folders FOR ALL
    USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
```

#### `tags` table
```sql
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON tags FOR ALL
    USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
```

#### `themes` table
```sql
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON themes FOR ALL
    USING (user_id = (SELECT id FROM users WHERE supabase_auth_id = auth.uid()));
```

#### `decks` + `cards` tables
```sql
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Deck owner can mutate; group members get read-only access to shared decks
CREATE POLICY "decks_select" ON decks FOR SELECT
    USING (
        user_id = public.get_app_user_id()
        OR EXISTS (
            SELECT 1 FROM group_decks gd
            JOIN group_members gm ON gm.group_id = gd.group_id
            WHERE gd.deck_id = decks.id
              AND gm.user_id = public.get_app_user_id()
        )
    );

CREATE POLICY "cards_select" ON cards FOR SELECT
    USING (public.can_read_deck(deck_id));
CREATE POLICY "cards_write" ON cards FOR ALL
    USING (public.owns_deck(deck_id));
```

#### `study_sessions` table
```sql
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "study_sessions_select" ON study_sessions FOR SELECT
    USING (public.can_read_deck(deck_id));
CREATE POLICY "study_sessions_write" ON study_sessions FOR ALL
    USING (public.owns_deck(deck_id));
```

#### DM `messages` table
```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select" ON messages FOR SELECT
    USING (
        (sender_id = public.get_app_user_id() OR receiver_id = public.get_app_user_id())
        AND public.dm_partner_allowed(
            CASE
                WHEN sender_id = public.get_app_user_id() THEN receiver_id
                ELSE sender_id
            END
        )
    );
CREATE POLICY "messages_insert" ON messages FOR INSERT
    WITH CHECK (
        sender_id = public.get_app_user_id()
        AND public.dm_partner_allowed(receiver_id)
    );
```

### Keep on Express (not suitable for PostgREST)
- Hearts (complex game logic)
- LMS/Canvas sync (`node-ical` dependency)
- AI generation (Gemini API + file parsing)
- Stripe (payment webhooks need raw body)
- Admin operations (need service role bypass)
- Referrals (multi-table business logic)
- Groups (partial — complex join/leave/invite logic)
- Social / friends / blocks / reports

### Verification checklist (per table)
- [ ] User can only see their own data (test with 2 accounts)
- [ ] Shared group data visible to members but not outsiders
- [ ] RLS blocks unauthorized writes (test with anon key directly via Supabase Studio)
- [x] Client no longer calls removed Express routes

---

## Phase 3: Complex Logic → Supabase Edge Functions (Deno)

Replace remaining Express routes with Deno serverless functions hosted on Supabase.

### Edge Functions to create

| Function name | Replaces | Deno concern |
|---------------|----------|--------------|
| `generate-deck` | `POST /api/ai/generate-deck` | Verify `mammoth` via `esm.sh` |
| `generate-class` | `POST /api/ai/generate-class` | Same |
| `ai-limits` | `GET /api/ai/limits` | Simple DB query, no concern |
| `create-checkout` | `POST /api/stripe/create-checkout-session` | Use `Stripe.createFetchHttpClient()` |
| `create-portal` | `POST /api/stripe/create-portal-session` | Same |
| `stripe-webhook` | `POST /api/webhooks/stripe` | Raw body: `await req.text()`, remove in-memory idempotency cache — use DB table |
| `hearts` | `/api/users/hearts/*` | Pure business logic, clean Deno port |
| `referrals` | `/api/referrals/*` | Multi-table SQL, clean port |
| `lms-sync` | `/api/lms/*` | **High risk**: `node-ical` may not work in Deno — may need rewrite with native URL parsing |
| `admin-actions` | `/api/admin/*` | Use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS |
| `social` | `/api/friends/*`, `/api/users/search`, `/api/reports/*` | Pure SQL, clean port |
| `groups` | `/api/groups/*` | Largest function — batch or split |
| `send-email` | Internal email util | `resend` npm package works via esm.sh |

### Edge Function structure

```
supabase/functions/
├── generate-deck/
│   └── index.ts
├── stripe-webhook/
│   └── index.ts
├── hearts/
│   └── index.ts
└── ...
```

### Edge Function template

```typescript
// supabase/functions/hearts/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // Get app user ID from bridge column
    const { data: dbUser } = await supabase
        .from('users')
        .select('id')
        .eq('supabase_auth_id', user.id)
        .single()

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    if (req.method === 'GET' && path === 'status') {
        const { data } = await supabase
            .from('users')
            .select('hearts, max_hearts')
            .eq('id', dbUser.id)
            .single()
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
})
```

### Admin Edge Function (uses service role to bypass RLS)

```typescript
// supabase/functions/admin-actions/index.ts
const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // bypasses RLS
)

// Verify caller is admin first using anon client
const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
const { data: { user } } = await callerClient.auth.getUser()
const { data: dbUser } = await supabaseAdmin.from('users').select('is_admin').eq('supabase_auth_id', user.id).single()
if (!dbUser?.is_admin) return new Response('Forbidden', { status: 403 })
```

### Stripe Webhook Edge Function (raw body)

```typescript
// supabase/functions/stripe-webhook/index.ts
serve(async (req) => {
    const rawBody = await req.text()  // Must be raw text for signature verification
    const sig = req.headers.get('stripe-signature')!

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient()  // Deno-compatible
    })

    const event = stripe.webhooks.constructEvent(rawBody, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
    // ... handle event
})
```

### AI Deck Generation (mammoth in Deno)

```typescript
// Check if mammoth works: import from esm.sh
import mammoth from 'https://esm.sh/mammoth@1.7.0'

// If not, alternative: accept plain text only, skip DOCX parsing
// Or: use a separate microservice / Vercel serverless function for DOCX parsing
```

### LMS / Canvas sync (node-ical alternative)

`node-ical` is Node.js specific. Options:
1. Use `https://esm.sh/node-ical` — may work if the package is ESM-compatible
2. Rewrite iCal parsing with native URL fetch + regex (iCal is plain text format)
3. Keep LMS routes on Express until a proper Deno alternative is found

### Frontend: calling Edge Functions

Create a helper in `client/src/api/edgeFetch.js`:
```javascript
import { supabase } from '../lib/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const edgeFetch = async (functionName, body, method = 'POST') => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
        },
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Edge function error');
    }
    return res.json();
};
```

Replace `authFetch('/ai/generate-deck', ...)` with `edgeFetch('generate-deck', ...)` per function.

### Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref <your-project-ref>

# Deploy a function
supabase functions deploy generate-deck

# Set secrets (one time)
supabase secrets set GEMINI_API_KEY=xxx STRIPE_SECRET_KEY=xxx STRIPE_WEBHOOK_SECRET=xxx
```

### Verification checklist
- [ ] AI deck generation works via Edge Function
- [ ] Stripe checkout creates session and redirects
- [ ] Stripe webhook processes subscription events correctly
- [ ] Admin can manage users via Edge Function
- [ ] Hearts system works correctly
- [ ] LMS Canvas sync works (or has acceptable fallback)
- [ ] Referral rewards applied correctly

---

## Phase 4: Real-time → Supabase Realtime (Replace Socket.io)

Replace Socket.io with Supabase Realtime (Postgres CDC) and Presence.

### DM Messages → Postgres CDC

Enable Realtime on the `messages` table in Supabase Dashboard:
**Database → Replication → Tables → messages → enable**

```javascript
// In MessageContext or useMessages hook
import { supabase } from '../lib/supabaseClient';

const subscribeToMessages = (userId, onNewMessage) => {
    const channel = supabase
        .channel(`messages_${userId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${userId}`
        }, (payload) => onNewMessage(payload.new))
        .subscribe();

    return () => supabase.removeChannel(channel);
};
```

### Typing Indicators → Presence

```javascript
const useTypingIndicator = (myUserId, otherUserId) => {
    const channelName = `dm_${Math.min(myUserId, otherUserId)}_${Math.max(myUserId, otherUserId)}`;
    const channel = supabase.channel(channelName);

    const startTyping = () => channel.track({ userId: myUserId, isTyping: true });
    const stopTyping = () => channel.track({ userId: myUserId, isTyping: false });

    const [typingUsers, setTypingUsers] = useState([]);

    useEffect(() => {
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const typing = Object.values(state)
                .flat()
                .filter(p => p.isTyping && p.userId !== myUserId)
                .map(p => p.userId);
            setTypingUsers(typing);
        }).subscribe();

        return () => supabase.removeChannel(channel);
    }, [myUserId, otherUserId]);

    return { typingUsers, startTyping, stopTyping };
};
```

### Online Presence (who's online)

```javascript
// Global presence channel for online status
const useOnlinePresence = (userId) => {
    useEffect(() => {
        const channel = supabase.channel('online_users');
        channel
            .on('presence', { event: 'sync' }, () => {
                const online = Object.values(channel.presenceState()).flat().map(p => p.userId);
                setOnlineUsers(online);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ userId });
                }
            });
        return () => supabase.removeChannel(channel);
    }, [userId]);
};
```

### Group Cram Sessions → Realtime Broadcast

For cram session responses (currently Socket.io `emit` events):
```javascript
// Broadcast to all session members
const channel = supabase.channel(`cram_${sessionId}`);
channel.send({
    type: 'broadcast',
    event: 'response',
    payload: { userId, answer, correct }
});

// Subscribe to responses
channel.on('broadcast', { event: 'response' }, ({ payload }) => {
    handleResponse(payload);
}).subscribe();
```

### Removing Socket.io

Once all real-time features are migrated:

1. Remove from `server/index.js`:
   - `const { Server } = require('socket.io');`
   - `const io = new Server(httpServer, ...)`
   - The `io.on('connection', ...)` block
   - The `register` event handler

2. Remove from `client/src/context/AuthContext.jsx`:
   - `import { io } from 'socket.io-client';`
   - `const [socket, setSocket] = useState(null);`
   - The socket initialization `useEffect`
   - `socket` from context values

3. Uninstall packages:
   ```bash
   # Server
   npm uninstall socket.io

   # Client
   npm uninstall socket.io-client
   ```

### Verification checklist
- [ ] New DM appears in real-time without page refresh
- [ ] Typing indicator appears/disappears correctly
- [ ] Online status updates when user connects/disconnects
- [ ] Cram session responses broadcast to all members
- [ ] No Socket.io connection errors in console
- [ ] No dangling socket connections on page navigation

---

## Phase 5: Decommission Render

Only do this after Phases 2, 3, and 4 are fully complete and verified.

### Pre-decommission checklist
- [ ] All 137 Express routes migrated (PostgREST + Edge Functions)
- [ ] Socket.io fully replaced with Supabase Realtime
- [ ] No `authFetch` calls remaining in client code
- [ ] Stripe webhook URL updated in Stripe Dashboard to Edge Function URL
- [ ] All environment variables moved to Supabase secrets
- [ ] Monitor for 2 weeks with no errors

### Final cleanup
```bash
# Delete server directory
rm -rf server/

# Remove server dependencies from root package.json
npm uninstall express pg bcryptjs jsonwebtoken socket.io cors ...

# Update Vercel environment variables
# Remove VITE_API_BASE — no longer needed
# Keep: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

### Environment variable migration

| Current (Render) | Destination |
|-----------------|-------------|
| `JWT_SECRET` | Remove (no longer needed) |
| `SUPABASE_JWT_SECRET` | Remove (no longer needed) |
| `SUPABASE_URL` | Already in Supabase context |
| `SUPABASE_ANON_KEY` | Already in Supabase context |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secret |
| `GEMINI_API_KEY` | Supabase Edge Function secret |
| `STRIPE_SECRET_KEY` | Supabase Edge Function secret |
| `STRIPE_WEBHOOK_SECRET` | Supabase Edge Function secret |
| `RESEND_API_KEY` | Supabase Edge Function secret |

---

## Route Migration Tracker

### Express routes: 137 total

| Route | Status | Phase | Migrated To |
|-------|--------|-------|-------------|
| `GET /api/classes` | Complete | 2 | PostgREST |
| `POST /api/classes` | Complete | 2 | PostgREST |
| `PUT /api/classes/:id` | Complete | 2 | PostgREST |
| `DELETE /api/classes/:id` | Complete | 2 | PostgREST |
| `GET /api/assignments` | Complete | 2 | PostgREST |
| `POST /api/assignments` | Complete | 2 | PostgREST |
| `PUT /api/assignments/:id` | Complete | 2 | PostgREST |
| `DELETE /api/assignments/:id` | Complete | 2 | PostgREST |
| `GET /api/schedule` | Complete | 2 | PostgREST |
| `POST /api/schedule` | Complete | 2 | PostgREST |
| `DELETE /api/schedule/:id` | Complete | 2 | PostgREST |
| `GET /api/folders` | Complete | 2 | PostgREST |
| `POST /api/folders` | Complete | 2 | PostgREST |
| `PUT /api/folders/:id` | Complete | 2 | PostgREST |
| `DELETE /api/folders/:id` | Complete | 2 | PostgREST |
| `GET /api/tags` | Complete | 2 | PostgREST |
| `POST /api/tags` | Complete | 2 | PostgREST |
| `DELETE /api/tags/:id` | Complete | 2 | PostgREST |
| `GET /api/decks` | Complete | 2 | PostgREST |
| `POST /api/decks` | Complete | 2 | PostgREST |
| `GET /api/decks/:id` | Complete | 2 | PostgREST |
| `PUT /api/decks/:id` | Complete | 2 | PostgREST |
| `PUT /api/decks/:id/move` | Complete | 2 | PostgREST |
| `DELETE /api/decks/:id` | Complete | 2 | PostgREST |
| `POST /api/decks/:id/duplicate` | Complete | 2 | PostgREST |
| `POST /api/decks/:id/cards` | Complete | 2 | PostgREST |
| `PUT /api/cards/:id` | Complete | 2 | PostgREST |
| `DELETE /api/cards/:id` | Complete | 2 | PostgREST |
| `PUT /api/cards/:id/progress` | Complete | 2 | PostgREST |
| `PUT /api/decks/:id/cards/reorder` | Complete | 2 | PostgREST |
| `PUT /api/cards/:id/review` | Complete | 2 | PostgREST |
| `POST /api/study-sessions` | Complete | 2 | PostgREST |
| `GET /api/study-sessions` | Complete | 2 | PostgREST |
| `GET /api/decks/:id/stats` | Complete | 2 | PostgREST |
| `GET /api/themes` | Complete | 2 | PostgREST |
| `POST /api/themes` | Complete | 2 | PostgREST |
| `DELETE /api/themes/:id` | Complete | 2 | PostgREST |
| `PUT /api/themes/:id` | Complete | 2 | PostgREST |
| `PUT /api/themes/:id/activate` | Complete | 2 | PostgREST |
| `GET /api/messages/conversations` | Complete | 2+4 | PostgREST + Realtime |
| `GET /api/messages/:userId` | Complete | 2+4 | PostgREST + Realtime |
| `POST /api/messages` | Complete | 2+4 | PostgREST + Realtime |
| `PUT /api/messages/:id` | Complete | 2 | PostgREST |
| `DELETE /api/messages/:id` | Complete | 2 | PostgREST |
| `GET /api/messages/unread/count` | Complete | 2 | PostgREST |
| `GET /api/auth/register` | Complete ✅ | 1 | Supabase Auth |
| `POST /api/auth/login` | Complete ✅ | 1 | Supabase Auth |
| `POST /api/auth/oauth/google` | Complete ✅ | 1 | Supabase Auth |
| `POST /api/auth/oauth/apple` | Complete ✅ | 1 | Supabase Auth |
| `POST /api/auth/logout` | Complete ✅ | 1 | Supabase Auth |
| `GET /api/auth/me` | Complete ✅ | 1 | Keep (profile data) |
| `POST /api/auth/forgot-password` | Complete | 1 | Supabase Auth |
| `POST /api/auth/reset-password` | Complete | 1 | Supabase Auth |
| `POST /api/auth/send-verification` | Complete | 1 | Supabase Auth |
| `POST /api/auth/2fa/setup` | Pending | 1 | Supabase MFA or Keep |
| `POST /api/auth/2fa/verify` | Pending | 1 | Supabase MFA or Keep |
| `POST /api/auth/2fa/disable` | Pending | 1 | Supabase MFA or Keep |
| `POST /api/auth/2fa/login` | Pending | 1 | Keep (existing users) |
| `PUT /api/auth/profile` | Pending | 2 | PostgREST |
| `PUT /api/auth/password` | Complete | 1 | Supabase Auth |
| `DELETE /api/auth/account` | Complete | 1 | Supabase Auth + Edge Fn |
| `PUT /api/auth/streak` | Pending | 2 | PostgREST |
| `GET /api/auth/streak` | Pending | 2 | PostgREST |
| `GET /api/auth/pet` | Pending | 2 | PostgREST |
| `PUT /api/auth/pet` | Pending | 2 | PostgREST |
| `POST /api/auth/simulate-free` | Pending | 3 | Edge Function |
| `GET /api/users/search` | Pending | 3 | Edge Function |
| `GET /api/users/:id` | Pending | 2 | PostgREST |
| `GET /api/friends` | Pending | 2 | PostgREST |
| `POST /api/friends/request` | Pending | 3 | Edge Function |
| `POST /api/friends/accept` | Pending | 3 | Edge Function |
| `DELETE /api/friends/:userId` | Pending | 2 | PostgREST |
| `GET /api/blocked-users` | Pending | 2 | PostgREST |
| `POST /api/users/:id/block` | Pending | 3 | Edge Function |
| `DELETE /api/users/:id/block` | Pending | 2 | PostgREST |
| `POST /api/reports` | Pending | 3 | Edge Function |
| `GET /api/ai/limits` | Pending | 3 | Edge Function |
| `POST /api/ai/generate-deck` | Pending | 3 | Edge Function |
| `POST /api/ai/generate-class` | Pending | 3 | Edge Function |
| `GET /api/groups` | Pending | 2 | PostgREST |
| `POST /api/groups` | Pending | 3 | Edge Function |
| `GET /api/groups/:id` | Pending | 2 | PostgREST |
| `PUT /api/groups/:id` | Pending | 3 | Edge Function |
| `DELETE /api/groups/:id` | Pending | 3 | Edge Function |
| `POST /api/groups/join` | Pending | 3 | Edge Function |
| `DELETE /api/groups/:id/leave` | Pending | 3 | Edge Function |
| `GET /api/groups/:id/members` | Pending | 2 | PostgREST |
| `DELETE /api/groups/:id/members/:userId` | Pending | 3 | Edge Function |
| `GET /api/groups/:id/decks` | Pending | 2 | PostgREST |
| `POST /api/groups/:id/decks` | Pending | 3 | Edge Function |
| `DELETE /api/groups/:id/decks/:deckId` | Pending | 3 | Edge Function |
| `GET /api/groups/:id/folders` | Pending | 2 | PostgREST |
| `POST /api/groups/:id/folders` | Pending | 3 | Edge Function |
| `PUT /api/groups/:id/folders/:folderId` | Pending | 3 | Edge Function |
| `DELETE /api/groups/:id/folders/:folderId` | Pending | 3 | Edge Function |
| `GET /api/groups/:id/files` | Pending | 2 | PostgREST |
| `POST /api/groups/:id/files` | Pending | 3 | Edge Function |
| `DELETE /api/groups/:id/files/:fileId` | Pending | 3 | Edge Function |
| `GET /api/groups/:id/sessions` | Pending | 2+4 | PostgREST + Realtime |
| `POST /api/groups/:id/sessions` | Pending | 3+4 | Edge Fn + Realtime |
| `POST /api/groups/sessions/:id/join` | Pending | 3+4 | Edge Fn + Realtime |
| `POST /api/groups/sessions/:id/respond` | Pending | 3+4 | Edge Fn + Realtime |
| `GET /api/groups/sessions/:id/results` | Pending | 2 | PostgREST |
| `POST /api/groups/sessions/:id/end` | Pending | 3 | Edge Function |
| `GET /api/users/hearts/status` | Pending | 3 | Edge Function |
| `GET /api/users/hearts/session/:deckId` | Pending | 3 | Edge Function |
| `POST /api/users/hearts/decrement` | Pending | 3 | Edge Function |
| `POST /api/users/hearts/refill` | Pending | 3 | Edge Function |
| `POST /api/users/hearts/practice-refill` | Pending | 3 | Edge Function |
| `POST /api/webhooks/stripe` | Pending | 3 | Edge Function |
| `POST /api/stripe/create-checkout-session` | Pending | 3 | Edge Function |
| `POST /api/stripe/create-portal-session` | Pending | 3 | Edge Function |
| `GET /api/referrals/me` | Pending | 3 | Edge Function |
| `POST /api/referrals/apply` | Pending | 3 | Edge Function |
| `POST /api/referrals/check-qualification` | Pending | 3 | Edge Function |
| `GET /api/admin/users` | Pending | 3 | Edge Function |
| `PUT /api/admin/users/:id/role` | Pending | 3 | Edge Function |
| `PUT /api/admin/users/:id` | Pending | 3 | Edge Function |
| `DELETE /api/admin/users/:id` | Pending | 3 | Edge Function |
| `GET /api/admin/stats` | Pending | 3 | Edge Function |
| `GET /api/admin/messages` | Pending | 3 | Edge Function |
| `POST /api/admin/messages` | Pending | 3 | Edge Function |
| `PUT /api/admin/messages/:id` | Pending | 3 | Edge Function |
| `DELETE /api/admin/messages/:id` | Pending | 3 | Edge Function |
| `GET /api/admin/reports` | Pending | 3 | Edge Function |
| `POST /api/admin/reports/:id/resolve` | Pending | 3 | Edge Function |
| `POST /api/admin/reports/:id/close` | Pending | 3 | Edge Function |
| `POST /api/admin/users/:id/ban` | Pending | 3 | Edge Function |
| `POST /api/lms/canvas/connect` | Pending | 3 | Edge Function (risk) |
| `POST /api/lms/canvas/disconnect` | Pending | 3 | Edge Function (risk) |
| `POST /api/lms/sync` | Pending | 3 | Edge Function (risk) |
| `GET /api/lms/settings` | Pending | 2 | PostgREST |
| `POST /api/messages` (global) | Pending | 3 | Edge Function |
| `GET /api/messages` (global) | Pending | 2 | PostgREST |
| `POST /api/messages/:id/dismiss` | Pending | 2 | PostgREST |
| `POST /api/messages/:id/accept-deck` | Pending | 3 | Edge Function |
| `GET /api/health` | Remove | — | Not needed |

---

## Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `node-ical` not Deno-compatible | LMS Canvas sync broken | Test `esm.sh/node-ical` early; fallback: rewrite iCal parser |
| `mammoth` not Deno-compatible | DOCX upload for AI broken | Test `esm.sh/mammoth`; fallback: accept plain text only |
| Existing 2FA users can't login after migration | User lockout | Keep `speakeasy` path on Express until users re-enroll |
| bcrypt passwords | Existing users locked out | Legacy login fallback permanently (or prompt reset) |
| Stripe webhook raw body | Payment failures | Use `req.text()` in Edge Function, NOT `req.json()` |
| In-memory idempotency cache | Duplicate payments on retry | Replace with `processed_stripe_events` DB table |
| Edge Function cold starts | Slow first request | Pre-warm with scheduled ping, or accept latency |
| RLS performance | Slow queries at scale | Add indexes on `user_id`, `supabase_auth_id`; test with 10k rows |

---

## Quick Reference: Key Files

| File | Phase | Status |
|------|-------|--------|
| `server/index.js` | 1, 4 | Modified ✅ |
| `server/routes/auth.js` | 1 | Modified ✅ |
| `client/src/api/authApi.js` | 1, 2, 3 | Modified ✅ |
| `client/src/context/AuthContext.jsx` | 1, 4 | Modified ✅ |
| `client/src/lib/supabaseClient.js` | All | Exists ✅ |
| `client/src/api/edgeFetch.js` | 3 | Create in Phase 3 |
| `supabase/functions/*/index.ts` | 3 | Create in Phase 3 |
