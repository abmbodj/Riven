# Riven — Expansion Plan

### From Flashcard App → Student OS

-----

## Overview

Riven already has a strong foundation: auth, offline support, a beautiful design language, and a working deck/card system. This document outlines the planned navigation changes and feature additions to evolve Riven into a full student productivity app without disrupting what already works.

**The backend (Express + PostgreSQL) stays untouched for Phase 1–3. All changes begin on the frontend.**

-----

## Navigation Bar Redesign

### Current Nav

```
Library · Garden · [FAB] · Themes · Account
```

### New Nav

```
Home · Classes · [FAB] · Decks · Account
```

|Tab        |Icon    |Purpose                                  |
|-----------|--------|-----------------------------------------|
|**Home**   |house   |Dashboard — today at a glance            |
|**Classes**|calendar|Classes, Schedule, Assignments           |
|**[FAB]**  |+       |Quick add anything                       |
|**Decks**  |stack   |Existing Library (unchanged)             |
|**Account**|person  |Profile, Streak, Garden, Themes, Settings|

### What Moves

- **Garden** → inside Account tab (delight feature, not primary nav)
- **Themes** → inside Account → Settings (set once, not daily use)
- **Library** → renamed **Decks**, same page, nothing else changes

-----

## Feature Build Order

### Phase 1 — Classes (Foundation)

> Everything else depends on this existing first.

**New database table:**

```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  color TEXT,
  professor TEXT,
  room TEXT,
  zoom_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**New screen:** `app/(tabs)/classes.tsx`

- List of the user’s courses
- Each class has a color, name, professor, room, Zoom link
- Tap a class → see its linked decks and assignments

**New API routes:**

```
GET    /api/classes
POST   /api/classes
PUT    /api/classes/:id
DELETE /api/classes/:id
```

-----

### Phase 2 — Assignments Tracker

> Immediately useful. No other phases need to be complete first.

**New database table:**

```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  class_id UUID REFERENCES classes(id),
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  weight NUMERIC,
  status TEXT DEFAULT 'pending', -- pending, in_progress, done
  notes TEXT
);
```

**UI — inside Classes tab, segmented control:**

```
[ Schedule ]  [ Assignments ]  [ Classes ]
```

**Assignment card shows:**

- Title
- Class name + class color dot
- Due date (highlighted red if < 48hrs)
- Status toggle (pending → done)

**New API routes:**

```
GET  /api/assignments
GET  /api/assignments/upcoming   ← next 7 days
POST /api/assignments
PUT  /api/assignments/:id
```

-----

### Phase 3 — Link Decks to Classes

> One database column. Unlocks the smart study planner.

**Migration:**

```sql
ALTER TABLE decks ADD COLUMN class_id UUID REFERENCES classes(id);
```

**UI changes:**

- When creating or editing a deck, show a “Link to Class” dropdown
- On the Decks page, existing class tags (like the current “VOCAB” tag) get a matching class color
- No other visual changes needed — the design language already supports this

-----

### Phase 4 — Dashboard (Home Tab)

> Now that Classes, Assignments, and linked Decks exist, the Dashboard has real data to display.

**New screen:** `app/(tabs)/index.tsx` (replaces current home)

**Layout:**

```
Good morning 👋
─────────────────────────────
TODAY'S CLASSES
  9:00 AM  Biology       Room 204
  2:00 PM  Spanish       Zoom ↗

─────────────────────────────
DUE SOON
  Tomorrow   Bio Lab Report
  Friday     Spanish Essay

─────────────────────────────
STUDY NOW  (smart recommendations)
  📚 LQ 12 Vocab        exam in 3 days
  📚 Preterite SER & IR last studied 4d ago

─────────────────────────────
🐶 Gmail  5 day streak — keep it up!
```

**Smart study recommendation logic:**

```js
// Surfaces decks based on urgency score
// urgency = (proximity of linked assignment due date) + (days since last studied)
// Top 3 decks shown — no AI needed, pure logic
```

The streak widget and Gmail the Pug stay on the Dashboard — it’s the personality of the app, keep it visible and prominent.

-----

### Phase 5 — Schedule

> Nice to have. Add after core loop is solid.

**New database table:**

```sql
CREATE TABLE schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  day_of_week INTEGER,  -- 0=Mon, 6=Sun
  start_time TIME,
  end_time TIME
);
```

**UI:** Weekly timetable view inside the Classes tab (first segment of the segmented control).

- Color-coded by class
- Tap a slot → see class details, Zoom link, linked decks
- Handles irregular schedules (biweekly labs, reading weeks)

**New API routes:**

```
GET  /api/schedule
POST /api/schedule/slots
PUT  /api/schedule/slots/:id
```

-----

### Phase 6 — Canvas LMS Integration

> Big retention driver. Students never have to manually enter assignments again.

Student generates a personal access token from their Canvas account settings and pastes it into Riven once. Riven syncs their courses and assignments automatically.

**New server route:**

```js
POST /api/lms/canvas/sync

// Pulls from Canvas API:
// GET /api/v1/courses?enrollment_state=active
// GET /api/v1/courses/:id/assignments
// Saves to assignments table, matched to classes by name
```

**UI:** Settings → Integrations → Connect Canvas

- Paste Canvas URL + token
- “Sync Now” button
- Auto-sync on login

**Supports:** Canvas (most universities), Google Classroom (high school). Blackboard and Moodle can follow.

-----

### Phase 7 — AI Flashcard Generation from Notes

> Polish feature. The full loop: notes → cards → study → exam.

**Flow:**

1. User types or pastes lecture notes into an assignment’s notes field
1. Taps “Generate Flashcards”
1. AI returns 10 cards as JSON
1. Cards are saved as a new deck, automatically linked to that class

**New server route:**

```js
POST /api/ai/generate-deck
// Body: { notes, deckName, classId }
// Calls Claude API → parses response → creates deck + cards
// Uses existing deck/card creation logic
```

**Model:** Claude — already integrated into the project ecosystem.

-----

## What Stays Exactly the Same

|Feature                |Status                                  |
|-----------------------|----------------------------------------|
|Decks page (Library)   |Unchanged — just renamed                |
|Card flip animations   |Unchanged                               |
|Spaced repetition logic|Unchanged                               |
|Study mode             |Unchanged                               |
|Test mode              |Unchanged                               |
|Offline / guest mode   |Unchanged                               |
|Auth (JWT)             |Unchanged                               |
|Streak system          |Unchanged — moves to Dashboard          |
|Gmail the Pug          |Unchanged — stays prominent on Dashboard|
|Themes                 |Unchanged — moves to Account            |
|Export / Import        |Unchanged                               |

-----

## Design Language Notes

The existing Riven design (dark background, cream cards, serif deck titles, capsule tags) should carry into every new screen. Specifically:

- Class colors should use the same capsule tag style as “VOCAB” tags on deck cards
- Assignment due dates use the same typography scale already in use
- The Dashboard should feel like a natural extension of the Library — same card style, same spacing
- No new component patterns unless absolutely necessary

-----

## Summary Timeline

|Phase|Feature              |Effort  |
|-----|---------------------|--------|
|1    |Classes table + page |2–3 days|
|2    |Assignments tracker  |2–3 days|
|3    |Link decks to classes|1 day   |
|4    |Dashboard            |3–5 days|
|5    |Schedule             |2–3 days|
|6    |Canvas sync          |3–5 days|
|7    |AI deck generation   |2–3 days|

**Total estimated:** 5–6 weeks working consistently, with each phase independently shippable.

-----

*Document prepared for Antigravity development team. Questions? Reference the conversation history for full context on each decision.*