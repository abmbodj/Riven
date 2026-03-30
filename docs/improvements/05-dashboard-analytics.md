# Dashboard Analytics Repositioning

> **Status:** Planned | **Priority:** High | **Effort:** M (3-5 days) | **Alpha-Critical:** No

## Summary

Analytics are currently buried in separate pages (StudyDashboard, ExamAnalytics). The mentor explicitly recommended repositioning analytics to the main dashboard (`/dashboard` via Home.jsx) for daily visibility. Users should see "how am I doing" data without navigating away from their home screen.

## Current State Audit

### What Exists
| Feature | Location | Status |
|---|---|---|
| Streak display | `Home.jsx` — StreakBadge component | Working, links to `/garden` |
| 7-day activity heatmap | `GardenSettings.jsx` — `getLast7Days()` pattern | Working, but buried in Garden page |
| Overdue assignments | `Home.jsx` — red highlighted section | Working |
| Upcoming assignments | `Home.jsx` — `getRelativeDueLabel()` | Working |
| Quick study shortcuts | `Home.jsx` — links to study modules | Working |
| Recently visited | `Home.jsx` — last accessed content | Working |
| Exam analytics | `ExamAnalytics.jsx` — per-exam results | Working, inside ExamView only |
| Study sessions | `study_sessions` table | Populated on every study session |
| FSRS card data | `cards` table with scheduling fields | Full spaced repetition data |

### Current Dashboard Layout (Home.jsx)
```
1. Streak card (compact)
2. Overdue assignments section
3. Upcoming assignments section
4. Quick study shortcuts
5. Recently visited content
```

### What's Missing on Dashboard
- No weekly study summary (cards studied, accuracy, time)
- No activity visualization (heatmap or chart)
- No "performance trend" indicator
- Analytics data exists in DB but never surfaces on home screen

## Proposed Design

### New Dashboard Layout

**Mobile (single column):**
```
┌──────────────────────────────────┐
│  Streak + Weekly Activity        │  <- Widget 1 (compact)
├──────────────────────────────────┤
│  Continue Studying               │  <- Quick resume (from 03-mobile)
├──────────────────────────────────┤
│  Weekly Stats: 47 cards · 82%    │  <- Widget 2
├──────────────────────────────────┤
│  Priority Items (overdue+today)  │  <- Widget 3 (merged)
├──────────────────────────────────┤
│  Quick Study                     │  <- Existing
├──────────────────────────────────┤
│  Recently Visited                │  <- Existing
└──────────────────────────────────┘
```

**Desktop (lg+, 2-column):**
```
┌────────────────────┬─────────────────┐
│  Streak + Activity │  Priority Items │
│  Weekly Stats      │  (overdue +     │
│  Quick Study       │   upcoming)     │
│  Recently Visited  │                 │
└────────────────────┴─────────────────┘
  main column (1fr)    aside (380px)
```

Layout: `lg:grid lg:grid-cols-[1fr_380px] lg:gap-6`

### Widget 1: Streak + Weekly Activity (Enhanced)

Enhance existing streak card with a 7-day dot heatmap:

```
┌──────────────────────────────────┐
│  🌱 7-day streak                 │
│  ○ ● ● ● ● ● ○                 │
│  M  T  W  T  F  S  S            │
└──────────────────────────────────┘
```

- Reuse `getLast7Days()` pattern from `GardenSettings.jsx`
- Dots: `w-3 h-3 rounded-full`
- Active day: `bg-claude-accent` | Inactive: `bg-claude-border/40`
- Today: `ring-1 ring-claude-accent/50`
- Card: existing streak card style, expanded to include heatmap row

### Widget 2: Weekly Study Summary

```
┌──────────────────────────────────┐
│  This Week                       │
│                                  │
│  47          82%         2.3h    │
│  cards       accuracy    studied │
│                                  │
│  ▃ ▅ ██ ▇ ▅ ▃ ░                │
│  M  T  W  T  F  S  S            │
└──────────────────────────────────┘
```

**Stats row:**
- 3 stat tiles in a row: `flex gap-4`
- Each: number (font-display text-2xl) + label (font-mono text-[9px] uppercase tracking-wider)
- Numbers: count-up animation on mount (CSS `@keyframes countUp` or `useSpring` from motion)

**Mini bar chart:**
- 7 bars for Mon-Sun, height proportional to cards studied that day
- Pure CSS: `div` with dynamic `height` as percentage of max day
- Bar: `w-full rounded-t-sm bg-claude-accent/60`
- Active day: `bg-claude-accent`
- Container: `h-12 flex items-end gap-1`
- No chart library — CSS bars only (performance on mobile home screen)

**Data source:**
- Query `study_sessions` table: `WHERE user_id = ? AND created_at >= (now - 7 days)`
- Aggregate: `SUM(cards_studied)`, `AVG(accuracy)`, `SUM(duration_minutes)`
- Group by day for the bar chart

### Widget 3: Priority Items (Merged)

Combine overdue + due-today + due-tomorrow into a single prioritized list:

```
┌──────────────────────────────────┐
│  Priority                        │
│                                  │
│  ● CS HW 3           Overdue 2d │  <- red
│  ● Reading Ch.7       Due today  │  <- accent
│  ● Lab Report        Due tomorrow│  <- secondary
│                                  │
│  Show all (8) →                  │
└──────────────────────────────────┘
```

- Max 5 items visible, "Show all" expands or links to Classes
- Sort: overdue first (by days overdue desc), then by due date asc
- Color coding: overdue = `text-red-400`, today = `text-claude-accent`, tomorrow = `text-claude-secondary`
- Class color dot left of each item

### API Endpoint Needed

```
GET /api/analytics/weekly-summary
Response: {
  cards_studied: number,
  accuracy: number (0-1),
  total_minutes: number,
  daily_breakdown: [
    { day: 'Mon', cards: 12, minutes: 25 },
    ...
  ]
}
```

Cache on server: 15-minute TTL (not real-time, doesn't need to be)

## Animation Spec

| Element | Animation | Duration |
|---|---|---|
| Stat numbers | Count-up from 0 | 600ms ease-out |
| Bar chart bars | Height 0 -> final | 400ms staggered (50ms per bar), ease-out |
| Widget mount | Opacity 0->1, y 12->0 | 300ms stagger per widget |
| Reduced motion | All instant, no count-up | 0ms |

## Performance Notes

- Reserve space for async content with skeleton placeholders (`h-[120px] animate-pulse rounded-2xl`)
- Weekly summary API call: fire on mount, show skeleton while loading
- Cache response in sessionStorage (key: `riven:weekly-summary`, 15-min TTL)
- CSS bar chart instead of Recharts/D3 — zero JS bundle cost
- `useMobileVisualBudget` already exists — respect it (simplify chart on low-end devices)

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/Home.jsx` | Add analytics widgets, 2-column desktop layout, priority items merge |
| `client/src/components/dashboard/WeeklySummary.jsx` | **New** — stats + bar chart widget |
| `client/src/components/dashboard/PriorityItems.jsx` | **New** — merged overdue/today/tomorrow list |
| `server/routes/analytics.js` | **New** — weekly summary endpoint |
| `client/src/api.js` | Add `getWeeklySummary()` API call |

## Acceptance Criteria

- [ ] Dashboard shows 7-day activity dots below streak
- [ ] Weekly summary displays cards studied, accuracy %, time studied
- [ ] Mini bar chart shows daily study volume for the week (CSS-only, no library)
- [ ] Priority items merged from overdue + today + tomorrow, sorted by urgency
- [ ] Desktop: 2-column layout with analytics left, priority items right
- [ ] Mobile: single column, widgets stack vertically
- [ ] Skeleton placeholders shown during data load (no layout shift)
- [ ] Stats count-up animation on mount (respects `prefers-reduced-motion`)
- [ ] Weekly summary cached in sessionStorage (15-min TTL)
- [ ] Screen reader: stat values announced with labels ("47 cards studied this week")

## Phased Rollout

- **Alpha:** 7-day dots on streak card + priority items merge (no new API needed)
- **v1.0:** Full weekly summary widget with bar chart + server endpoint
- **v1.1:** Study trends over time (4-week view), exam performance tracking
