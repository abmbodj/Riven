# Study Guide Overhaul — "Ultimate Study Coach" Design

**Date:** 2026-04-03  
**Status:** Approved  
**Scope:** Full overhaul of the study guide experience across content quality, session UX, mobile flow, weakness tracking, and inline editing.

---

## Context

The current study guide feature generates AI-powered active-recall workbooks but falls short in four key areas:

1. **Content quality** — AI output is sometimes vague, misses key concepts, and can't be corrected post-generation
2. **Passive study experience** — students scroll through answers rather than actively recalling
3. **No guidance** — no indication of what to study next or where weaknesses are
4. **Mobile friction** — too many taps, clunky reveal mechanics, no quick-session mode

The goal: transform study guides from a document viewer into a **fool-proof study coach** — one that tells students exactly what to do, forces active engagement, and adapts to their weaknesses.

---

## Architecture Overview

Two-phase delivery:

- **Phase 1** — Session experience + mobile flow (fastest user-felt impact)
  - Smart session entry (3 modes)
  - Forced active recall flow
  - Quick Session (time-limited, auto-selected sections)
  - Quiz Me mode
  - Weakness dashboard

- **Phase 2** — Content quality + hybrid scheduling
  - Improved AI prompt
  - Inline section editor for v2 guides
  - Hybrid spaced repetition scheduling

No new database tables required. All features build on existing `study_guides`, `guide_data`, and `study_state` schemas.

---

## Phase 1: Session Experience + Mobile Flow

### 1.1 Smart Session Entry Screen

**Replaces:** The current "Resume Session" button + flat section list.

**New entry screen for every guide:**

```
┌─────────────────────────────┐
│ Cell Biology Midterm        │
│ Last studied 2 days ago     │
│                             │
│ ┌─ STUDY COACH ────────────┐│
│ │ Weak on: Protein          ││
│ │ Synthesis & Cellular      ││
│ │ Respiration. Start there. ││
│ └──────────────────────────┘│
│                             │
│  ⚡ Quick Session           │
│  [5 min] [10 min] [20 min] │
│                             │
│  📚 Full Session            │
│  All 6 sections · ~35 min  │
│                             │
│  🎯 Quiz Me                 │
│  Rapid-fire · Pure recall  │
└─────────────────────────────┘
```

**Coach banner logic:**
- Reads existing `study_state.section_states[*].confidence` values
- Surfaces sections with `confidence === 'need_work'` or `confidence === null` (unstudied)
- Falls back to "Let's get started" if no sessions yet

**Files to modify:**
- `client/src/pages/GuideView.jsx` — replace current session start UI with new entry component
- `client/src/utils/studyGuides.js` — add `getWeakSections(guideData, studyState)` and `getSessionSections(guideData, studyState, mode, durationMinutes)`

### 1.2 Quick Session Mode

Student picks a time (5 / 10 / 20 min). App auto-selects which sections to study.

**Section selection algorithm (`getSessionSections`):**
1. Priority order: `need_work` → `null` (unstudied) → `okay` → `know_it`
2. Estimate time per section: ~3 min (recall + reveal + confidence tap)
3. Fill the time budget in priority order
4. If mini-quiz enabled: add 1 min per section

**No new backend required** — pure client-side logic in `studyGuides.js`.

### 1.3 Active Recall Flow (3-Step Per Section)

**Replaces:** The current section list where answers are visible by default.

**Step 1 — Recall Prompt:**
- Show `section.recall_prompt` prominently
- Optional free-text input (not saved, just for self-testing)
- Single large "Show Answer" button — no way to skip to the answer without tapping
- "Can't recall? That's okay — just tap." to reduce anxiety

**Step 2 — Answer + Confidence:**
- Reveal `section.answer_points` as bullet list
- Show `section.common_traps` inline as a yellow warning card
- Immediate 3-button confidence rating: Need Work / Okay / Got It
- Confidence tap saves to `study_state.section_states[id].confidence` via existing `updateStudyGuide()`

**Step 3 — Mini Quiz (optional, auto-shown if section has quiz items):**
- Show one `section.mini_quiz` item as a free-recall checkpoint: display `prompt`, student attempts mentally, then taps "Show Answer" to reveal `answer`
- Student marks themselves correct/incorrect with a thumbs up/down tap
- Then "Next Section →"
- If no quiz items: skip directly to next section
- Note: `mini_quiz` stores `{ prompt, answer }` only — no distractors — so true multiple-choice would require generating options at runtime. Free-recall format fits the existing schema perfectly and is actually harder (better learning).

**Mobile swipe:** Sections advance via swipe-right or tap "Next". Back swipe = previous section (no re-saving confidence).

**Files to modify:**
- `client/src/pages/GuideView.jsx` — replace section detail view with 3-step flow component
- New component: `client/src/components/StudySection.jsx` — encapsulates the 3-step flow

### 1.4 Quiz Me Mode

Rapid-fire mode — no reading, just questions.

- Pulls all `mini_quiz` items from all sections (or weak sections only)
- One question at a time: show prompt → student attempts → tap to reveal answer → thumbs up/down
- No section context shown — pure recall under pressure
- At end: score + "These sections need work: X, Y"
- Launches directly from session entry screen

**Files to modify:**
- New component: `client/src/components/QuizMeMode.jsx`
- `client/src/pages/GuideView.jsx` — add Quiz Me mode routing

### 1.5 Weakness Dashboard

Shown after session completes and accessible via a "Progress" tab on the guide.

**Per-section status derived from `study_state`:**

| Confidence | Sessions | Label | Color |
|---|---|---|---|
| `need_work` | any | Review Now | Red |
| `null` | 0 | Not studied | Red |
| `okay` | any | Coming up | Yellow |
| `know_it` | recent | Good | Green |
| `know_it` | >3 days ago | Review Soon | Yellow |

**"Review Weak Sections Now" CTA** — launches a Quick Session pre-filtered to red/yellow sections only.

**Files to modify:**
- New component: `client/src/components/GuideProgressDashboard.jsx`
- `client/src/utils/studyGuides.js` — add `getSectionStatus(sectionState, lastReviewedAt)` helper

---

## Phase 2: Content Quality + Hybrid Scheduling

### 2.1 Improved AI Prompt

**Current issues:** Sections too long, filler content, key concepts missed.

**Changes to `supabase/functions/_shared/aiCore.mjs`:**
- Tighten prompt constraints: max 5 answer points per section (down from 8), require each point to be exam-testable (not definitional)
- Add instruction: "If a concept is commonly confused with another, it MUST appear in common_traps"
- Add instruction: "Sections must map to distinct testable concepts — no overlap"
- Add subject-aware hinting: pass `className` more prominently in system prompt

### 2.2 Inline Section Editor

Students can fix any v2 guide section without regenerating the whole guide.

**Edit surface (slide-up sheet on mobile, side panel on desktop):**
- Section title (text input)
- Recall prompt (textarea)
- Answer points (editable list — add/remove/reorder)
- Common traps (editable list)
- Key terms (editable list)

**Save path:** `updateStudyGuide(id, { guide_data: updatedGuideData })` via existing API — no new endpoint needed.

**Edit icon:** Pencil icon on each section header in the study flow and in the progress dashboard.

**Files to modify:**
- New component: `client/src/components/SectionEditor.jsx`
- `client/src/pages/GuideView.jsx` — wire edit icon to SectionEditor sheet
- `client/src/utils/studyGuides.js` — add `updateSection(guideData, sectionId, updates)` helper

### 2.3 Hybrid Spaced Repetition Scheduling

**Not a full FSRS implementation** (that's Decks). Simpler scheduling based on confidence + recency.

**Scheduling logic (`getSectionStatus`)** — uses per-section `last_reviewed_at`:
```
know_it + section reviewed ≤ 3 days ago  → "Good" (green)
know_it + section reviewed > 3 days ago  → "Review Soon" (yellow)
okay    + any                            → "Coming up" (yellow)
need_work + any                          → "Review Now" (red)
null / unstudied                         → "Not studied" (red)
```

Coach banner on session entry uses this to prioritize sections and suggest order.

Student can always tap any section to study it regardless of scheduled status.

---

## Data Model Changes

**Minimal schema addition required** — one new field per section state, no new tables:

Add `last_reviewed_at: string | null` to each section's entry in `study_state.section_states`. Written when a student taps a confidence button on that section. This enables per-section scheduling ("review section X in 3 days") rather than just guide-level recency.

Migration: `normalizeGuideStudyState()` already fills missing section state fields with defaults — add `last_reviewed_at: null` there and all existing guides get it automatically on next load.

| Field | Used for |
|---|---|
| `study_state.section_states[id].confidence` | Weakness tracking, scheduling |
| `study_state.section_states[id].revealed` | Session resume state |
| `study_state.section_states[id].completed` | Progress % |
| `study_state.section_states[id].last_reviewed_at` | Per-section scheduling recency (new) |
| `study_state.last_reviewed_at` | Guide-level last activity timestamp |
| `guide_data.sections[].recall_prompt` | Step 1 prompt |
| `guide_data.sections[].answer_points` | Step 2 reveal |
| `guide_data.sections[].common_traps` | Step 2 trap card |
| `guide_data.sections[].mini_quiz` | Step 3 quiz |

---

## Key Files

| File | Change |
|---|---|
| `client/src/pages/GuideView.jsx` | Major refactor — session entry, 3-step flow, Quiz Me routing |
| `client/src/utils/studyGuides.js` | Add helpers: `getWeakSections`, `getSessionSections`, `getSectionStatus`, `updateSection` |
| `client/src/components/StudySection.jsx` | New — 3-step active recall flow per section |
| `client/src/components/QuizMeMode.jsx` | New — rapid-fire quiz mode |
| `client/src/components/GuideProgressDashboard.jsx` | New — weakness dashboard |
| `client/src/components/SectionEditor.jsx` | New — inline section editor (Phase 2) |
| `supabase/functions/_shared/aiCore.mjs` | Tighten AI prompt constraints (Phase 2) |

---

## Reused Utilities

- `getGuideProgress(guideData, studyState)` — `client/src/utils/studyGuides.js:getGuideProgress` — already calculates completion %, reuse for dashboard header
- `normalizeGuideStudyState(guideData, studyState)` — `client/src/utils/studyGuides.js` — call after editing sections to fill in new section state defaults
- `updateStudyGuide(id, updates)` — `client/src/api/authApi.js` — used for all confidence saves and section edits, no new API needed
- `isActiveRecallGuide(guide)` — `client/src/utils/studyGuides.js` — gate all new features behind v2 format check

---

## Verification

**Phase 1:**
1. Open a v2 guide → entry screen shows 3 modes + coach banner with weak sections
2. Tap Quick Session → pick 10 min → session starts with ≤3 sections, prioritizing weak ones
3. Study a section → recall prompt shown first, answer hidden → tap "Show Answer" → answer + traps revealed → tap confidence → moves to next section
4. Complete all sections → progress dashboard shown with color-coded breakdown
5. Tap "Review Weak Sections Now" → new Quick Session starts with only red/yellow sections
6. Tap Quiz Me → rapid-fire questions from mini_quiz items → score shown at end

**Phase 2:**
1. Open a v2 guide section → tap pencil icon → SectionEditor opens
2. Edit an answer point → save → guide_data updated in DB → changes reflected immediately in study flow
3. Generate a new guide → sections are tighter (≤5 points), traps present if applicable
4. Strong section after 4 days → shows "Review Soon" (yellow) not "Good" (green)

**Regression:**
- v1 (legacy) guides still load and edit via Tiptap editor unchanged
- Existing study state (confidence, completed) preserved after GuideView refactor
- Generation quota and streaming flow unchanged
