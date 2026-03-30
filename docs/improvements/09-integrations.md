# Integrations: Discord, PowerPoint, Subject-Specific AI

> **Status:** Planned | **Priority:** Medium | **Effort:** L (1-2 weeks) | **Alpha-Critical:** No

## Summary

Three integration opportunities: a Discord bot for study reminders and flashcard quizzing in Discord servers, PowerPoint upload support for deck generation (DOCX already works), and subject-specific AI context that tailors Gemini responses based on class/subject metadata.

## Integration 1: PowerPoint Upload Support

### Current State
- DOCX parsing: `Mammoth` library in `server/routes/ai.js` — extracts text from uploaded .docx files
- File upload flow: `CreateDeck.jsx` has "Generate from Notes" with document upload
- Accepted formats: `.docx`, `.pdf`, `.txt`
- Missing: `.pptx` support

### Implementation

**Approach:** Use `pptx-parser` or `officegen` to extract slide text content, then pass to Gemini using the same pipeline as DOCX.

**Server-side (`server/routes/ai.js`):**
```js
// Add to file processing logic
if (fileExt === '.pptx') {
  const slides = await parsePptx(fileBuffer); // extract text from all slides
  const content = slides.map((s, i) => `Slide ${i+1}: ${s.text}`).join('\n\n');
  // Pass content to Gemini prompt (same as DOCX path)
}
```

**Extraction targets per slide:**
- Title text
- Body text
- Speaker notes (valuable for study context)
- Table text content
- Ignore: images, charts, animations (text extraction only)

**Client-side (`client/src/pages/CreateDeck.jsx`):**
- Add `.pptx` to file input `accept` attribute
- Show slide count in processing feedback: "Processing 24 slides..."
- File size limit: 10MB (same as current DOCX limit)
- Icon: `Presentation` from Lucide

**NPM package:** `pptx-parser` (lightweight, extracts text + notes)

### Files to Modify

| File | Change |
|------|--------|
| `server/routes/ai.js` | Add PPTX parsing logic alongside DOCX |
| `server/package.json` | Add `pptx-parser` dependency |
| `client/src/pages/CreateDeck.jsx` | Add `.pptx` to accepted file types, slide count feedback |

### Acceptance Criteria
- [ ] `.pptx` files accepted in CreateDeck upload
- [ ] Slide text + speaker notes extracted correctly
- [ ] Generated flashcards are as quality as DOCX-generated ones
- [ ] Processing feedback shows slide count
- [ ] 10MB file size limit enforced

---

## Integration 2: Subject-Specific AI Context

### Current State
- AI generation prompts in `server/routes/ai.js` are generic
- When generating from ClassView, the class name is available but not passed as context
- Example: generating flashcards from a CS lecture transcript gets the same prompt template as a history lecture

### Implementation

**Per-class context field:**
```sql
ALTER TABLE classes ADD COLUMN ai_context TEXT;
-- Example value: "Upper division computer science, assumes Python and Java knowledge"
```

**UI: ClassView.jsx**
- New field in class settings: "AI Context" textarea
- Placeholder: "e.g., 'Upper division CS course, Python-focused, theoretical emphasis'"
- Max 500 characters
- Persisted to `classes.ai_context`

**Server: Prompt Enhancement**

When generating content from a class context, prepend to all Gemini prompts:

```
Context: This content is for a "{class_name}" course.
{ai_context if set}
Tailor terminology, depth, and examples to this academic level and subject.
```

**Impact areas:**
- `generate-deck` edge function
- `generate-guide` edge function
- `generate-exam` edge function
- `generate-class` edge function
- Any AI generation triggered from ClassView

### Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/ClassView.jsx` | Add AI Context textarea in class settings section |
| `server/routes/ai.js` | Inject class context into Gemini prompts |
| `supabase/functions/generate-deck/index.ts` | Accept + use `ai_context` parameter |
| `supabase/functions/generate-guide/index.ts` | Accept + use `ai_context` parameter |
| `supabase/functions/generate-exam/index.ts` | Accept + use `ai_context` parameter |
| `supabase/migrations/` | Add `ai_context` column to classes table |

### Acceptance Criteria
- [ ] ClassView has "AI Context" textarea in settings
- [ ] Context persisted to database
- [ ] Gemini prompts include class name and context when generating from a class
- [ ] Generated content shows subject-appropriate terminology
- [ ] Context is optional — generation works fine without it

---

## Integration 3: Discord Bot

### Concept

A Discord bot that students add to their study servers for reminders, quick quizzing, and streak tracking without leaving Discord.

### Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌────────────┐
│  Discord Server │────→│  Discord Bot │────→│  Riven API │
│  (Student)      │←────│  (Railway)   │←────│  (Vercel)  │
└─────────────────┘     └──────────────┘     └────────────┘
```

**Separate service:** `discord-bot/` at repo root (not inside `server/`)
- Runtime: Node.js + `discord.js` v14
- Hosting: Railway or Fly.io (Vercel doesn't support long-running WebSocket connections)
- Auth: Bot links to Riven account via link code flow

### Account Linking Flow

1. User runs `/link` in Discord
2. Bot DMs a unique 6-character link code (expires 10 min)
3. User visits `riven.app/settings` -> "Link Discord" -> enters code
4. Server associates `discord_user_id` with Riven `user_id`
5. Bot confirms: "Linked to @username on Riven"

### Bot Commands

| Command | Description | API Call |
|---|---|---|
| `/streak` | Show your current study streak | `GET /api/integrations/discord/streak` |
| `/quiz [class]` | Random flashcard from your decks | `GET /api/integrations/discord/quiz?class=` |
| `/remind [time] [task]` | Schedule a DM reminder | Client-side timer (no API) |
| `/stats` | Weekly study summary | `GET /api/integrations/discord/stats` |
| `/ask [question]` | Ask AI with subject context | `POST /api/integrations/discord/ask` |

### Quiz Command Detail

```
/quiz CS 101

📚 CS 101 — Data Structures
━━━━━━━━━━━━━━━━━━━━━━━━━━

Q: What is the time complexity of
   inserting into a balanced BST?

||A: O(log n)||

React with ✅ if you got it right
React with ❌ if you need to review
```

- Answer hidden behind Discord spoiler tags `||..||`
- Reaction tracking: updates card's FSRS state via API
- Pulls random card from user's decks (filtered by class if specified)

### Database Changes

```sql
ALTER TABLE users ADD COLUMN discord_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN discord_linked_at TIMESTAMPTZ;

CREATE TABLE discord_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints (Server)

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/integrations/discord/link` | Store discord_user_id |
| `GET` | `/api/integrations/discord/streak` | Return streak data |
| `GET` | `/api/integrations/discord/quiz` | Random flashcard |
| `GET` | `/api/integrations/discord/stats` | Weekly summary |
| `POST` | `/api/integrations/discord/ask` | AI question (rate limited) |

### Bot Project Structure

```
discord-bot/
├── package.json
├── src/
│   ├── index.js          — Bot setup + event handlers
│   ├── commands/
│   │   ├── link.js
│   │   ├── streak.js
│   │   ├── quiz.js
│   │   ├── remind.js
│   │   ├── stats.js
│   │   └── ask.js
│   └── utils/
│       ├── api.js        — Riven API client
│       └── embeds.js     — Discord embed builders
├── .env.example
└── README.md
```

### Files to Create / Modify

| File | Change |
|------|--------|
| `discord-bot/` | **New directory** — entire bot project |
| `server/routes/integrations.js` | **New** — Discord linking + data endpoints |
| `client/src/pages/Settings.jsx` | Add "Link Discord" section with code input |
| `supabase/migrations/` | Add `discord_user_id`, `discord_linked_at`, `discord_link_codes` |

### Acceptance Criteria
- [ ] Bot responds to `/streak`, `/quiz`, `/stats`, `/ask` commands
- [ ] Account linking flow works via 6-character code
- [ ] Quiz command shows flashcard with spoiler-tagged answer
- [ ] Bot handles unlinked users gracefully ("Link your account first")
- [ ] Rate limiting on `/ask` command (same as app AI limits)
- [ ] Bot deployed on Railway/Fly.io, not on Vercel

---

## Overall Phased Rollout

- **Alpha:** PowerPoint upload + subject-specific AI context (server-side, low risk, high value)
- **v1.0:** Discord bot MVP (streak + quiz commands, account linking)
- **v1.1:** Discord bot full (ask, stats, remind, reaction tracking)
