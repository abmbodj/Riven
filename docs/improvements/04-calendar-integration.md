# Calendar Integration

> **Status:** Done | **Priority:** High | **Effort:** XL (2-4 weeks) | **Alpha-Critical:** No

## Summary

A dedicated calendar view that displays assignments color-coded by class, with toggles for class schedules vs all assignments, external calendar import (Gmail/iCal), and smart notifications for upcoming tests and quizzes. Much of the infrastructure already exists — Canvas LMS iCal sync, class colors, assignment due dates, and notification scheduling — this feature surfaces it in a visual calendar UI.

## Current State Audit

### Existing Infrastructure (Do Not Re-Implement)
| What | Where | Status |
|---|---|---|
| Canvas iCal sync | `server/routes/lms.js` + `supabase/functions/canvas-lms` | Working |
| `node-ical` parser | `server/package.json` | Installed |
| Auto-sync (12hr cadence) | Settings.jsx toggle | Working |
| CLASS_COLORS array | `client/src/pages/Classes.jsx` — 12 hex colors | Defined |
| Assignment due dates | `assignments` table: `due_date` column | Populated |
| Schedule slots | `schedule_slots` table: `day_of_week`, `start_time`, `end_time` | Populated |
| Due date display | `Home.jsx`: `getRelativeDueLabel()` | Working |
| Local notifications | `client/src/utils/notifications.js`: `scheduleAssignmentNotifications()` | Working |
| Push notifications | `PushNotificationBridge` (Capacitor) | Working |
| Class CRUD | `client/src/pages/Classes.jsx`, `ClassView.jsx` | Working |

### What's Missing
- No calendar grid view
- No way to see assignments plotted on a timeline
- No external calendar import UI (iCal URL is only for Canvas in Settings)
- Notifications don't differentiate tests/quizzes from regular assignments

## Proposed Design

### New Route: `/calendar`

Add to primary nav as sub-item under Classes, or as standalone nav item.

### Component Tree

```
CalendarPage
├── CalendarHeader
│   ├── MonthNav (← Month Year →, "Today" button)
│   └── ViewToggle ([Month] [Agenda])
├── FilterBar
│   └── FilterPills ([All] [Class 1] [Class 2] ... [Schedule])
├── CalendarGrid (month view)
│   ├── WeekdayHeaders (Mon-Sun)
│   └── DayCell[] (42 cells, 6 weeks)
│       ├── DayNumber
│       ├── AssignmentDots (color-coded, max 4 visible + "+N" overflow)
│       └── ScheduleDots (different shape — lines vs dots)
├── CalendarAgenda (list view)
│   └── AgendaDay[]
│       ├── DateHeader
│       └── AgendaItem[] (assignment card with class color, title, time)
└── DaySheet (slide-up modal when tapping a day)
    ├── DateTitle
    ├── ScheduleSlots (if toggled on)
    └── AssignmentList (sorted by time, color-coded)
```

### Calendar Grid Layout

**Mobile (375px):**
```
┌────────────────────────────────────┐
│  ← March 2026 →          [Today]  │
│  [Month] [Agenda]                  │
│  [All] [CS101] [MATH] [Schedule]  │
├────┬────┬────┬────┬────┬────┬────┤
│ Su │ Mo │ Tu │ We │ Th │ Fr │ Sa │
├────┼────┼────┼────┼────┼────┼────┤
│    │    │  1 │  2 │  3 │  4 │  5 │
│    │    │ ●● │    │ ●  │    │    │
├────┼────┼────┼────┼────┼────┼────┤
│  6 │  7 │  8 │  9 │ 10 │ 11 │ 12 │
│    │ ●  │    │ ●●●│    │ ●  │    │
└────┴────┴────┴────┴────┴────┴────┘
```

- Day cells: square aspect ratio, `aspect-square` on mobile
- Assignment dots: 6px circles, colored by class, max 4 per day + `+N` text
- Schedule indicators: thin 2px horizontal lines (visually distinct from assignment dots)
- Today: `ring-2 ring-claude-accent bg-claude-accent/[0.06]`
- Selected day: `bg-claude-accent/10`
- Outside-month days: `opacity-30`

**Desktop (lg+):**
- Grid cells taller — show first 2 assignment titles truncated + dot overflow
- Cells: `min-h-[100px]` with assignment text previews

### Day Sheet (Bottom Sheet)

Triggered by tapping a day cell on mobile:
```
┌────────────────────────────────────┐
│  ── (drag handle)                  │
│  Tuesday, March 10                 │
│                                    │
│  Schedule                          │
│  ┌─ CS 101 · 9:00-10:15 · Room 4 │
│  └─ MATH 240 · 11:00-12:15       │
│                                    │
│  Assignments                       │
│  ● [red] CS Homework 3 · Due 11pm │
│  ● [blue] Reading Ch.7 · Due 5pm  │
│  ● [green] Lab Report · Due 11:59 │
│                                    │
└────────────────────────────────────┘
```

- Slide up from bottom: `translateY(100% -> 0)` 300ms spring
- Backdrop: `bg-black/40`
- Max height: `70vh`, scrollable if overflows
- Close: swipe down or tap backdrop

### Filter System

**Toggle pills:**
- `[All]` — show everything
- `[Class Name]` per class — color-coded pill with class color dot
- `[Schedule]` — toggle schedule slot visibility

Active: `bg-[classColor]/15 text-[classColor] border-[classColor]/30`
Inactive: `bg-claude-bg/50 text-claude-secondary border-claude-border/50`
Multi-select: user can activate multiple class filters simultaneously

### View Toggle

- `[Month]` — calendar grid (default)
- `[Agenda]` — chronological list grouped by day
- Shared-element pill: `layoutId="calendar-view-pill"` spring animation

### Agenda View

```
── Today, March 28 ──────────────────
● [red] CS Homework 3          11:00 PM
● [blue] Reading Response       5:00 PM

── Tomorrow, March 29 ───────────────
● [green] Lab Report           11:59 PM

── Monday, March 31 ─────────────────
(empty — enjoy your day)
```

- Grouped by day with date separator
- Shows next 14 days by default, infinite scroll for more
- Empty days shown with encouraging message
- Past-due items: `text-red-400` with "Overdue" badge

## Data Model Changes

### New Table: `calendar_sources`
```sql
CREATE TABLE calendar_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('google', 'ical', 'canvas')),
  label TEXT NOT NULL,
  color TEXT, -- hex color for this source's events
  url TEXT, -- iCal URL
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Assignments Table Addition
```sql
ALTER TABLE assignments ADD COLUMN
  assignment_type TEXT DEFAULT 'assignment'
  CHECK (assignment_type IN ('assignment', 'quiz', 'exam', 'project', 'reading'));
```

Auto-detection: when creating/syncing assignments, check title against:
```js
const EXAM_PATTERN = /\b(test|quiz|exam|midterm|final|assessment)\b/i;
```

## Smart Notifications for Tests/Quizzes

Extend `scheduleAssignmentNotifications()` in `client/src/utils/notifications.js`:

```
Regular assignments: 24h + 2h before due
Tests/Quizzes/Exams: 48h + 24h + 2h before due
```

Use existing `PushNotificationBridge` for native iOS. Web uses Notification API (already implemented).

## External Calendar Import

### Add Calendar Source UI (in Settings or Calendar page)
1. "Add Calendar" button -> modal with options:
   - **iCal URL** — text input, validates URL, syncs on save
   - **Google Calendar** — OAuth2 flow (Phase 2, post-alpha)
2. Each source gets a label and color
3. Imported events render as read-only items in calendar (no edit, no delete)
4. Manual "Sync Now" button per source

### API Endpoints
- `POST /api/calendar/sources` — add new source
- `GET /api/calendar/sources` — list user's sources
- `DELETE /api/calendar/sources/:id` — remove source
- `POST /api/calendar/sources/:id/sync` — trigger sync

## Files to Create / Modify

| File | Change |
|------|--------|
| `client/src/pages/Calendar.jsx` | **New** — Calendar page with grid + agenda views |
| `client/src/components/calendar/CalendarGrid.jsx` | **New** — Month grid component |
| `client/src/components/calendar/CalendarAgenda.jsx` | **New** — Agenda list view |
| `client/src/components/calendar/DaySheet.jsx` | **New** — Bottom sheet for day detail |
| `client/src/components/calendar/CalendarHeader.jsx` | **New** — Month nav + view toggle |
| `client/src/routes/config.jsx` | Add `/calendar` route |
| `client/src/components/Layout.jsx` | Add Calendar to nav (under Classes or standalone) |
| `client/src/utils/notifications.js` | Extend with test/quiz detection + 48h reminder |
| `server/routes/calendar.js` | **New** — calendar sources CRUD + sync |
| `supabase/migrations/` | Add `calendar_sources` table, `assignment_type` column |

## Acceptance Criteria

- [ ] `/calendar` route renders monthly grid with correct day layout
- [ ] Assignments appear as color-coded dots on their due dates
- [ ] Tapping a day opens DaySheet with that day's assignments and schedule
- [ ] Filter pills filter by class; multi-select supported
- [ ] Schedule toggle shows/hides class schedule slots
- [ ] Agenda view shows chronological list grouped by day
- [ ] Month navigation: prev/next arrows + "Today" jump button
- [ ] Mobile: grid cells are square aspect ratio with dot indicators
- [ ] Desktop: grid cells show truncated assignment titles
- [ ] Overdue assignments shown in red
- [ ] Exam/quiz/test items get 48h + 24h + 2h notification schedule
- [ ] iCal URL import works (reusing existing `node-ical` parser)
- [ ] `prefers-reduced-motion` disables sheet slide animation
- [ ] Screen reader: grid cells announce date + number of assignments

## Phased Rollout

- **Alpha v1:** Month grid + agenda view with existing Canvas-synced assignments. DaySheet. Basic filter pills
- **v1.0:** External iCal import UI, assignment type auto-detection, smart notifications
- **v2.0:** Google Calendar OAuth import, calendar widget on Dashboard
