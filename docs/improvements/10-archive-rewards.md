# Archive & Rewards System

> **Status:** Planned | **Priority:** Medium | **Effort:** M (3-5 days) | **Alpha-Critical:** No

## Summary

Completed assignments disappear from the main view with no celebration or history. This spec adds a completed assignments archive, weekly completion rewards (confetti + garden bonus), an assignment completion streak (separate from study streak), and achievement badges on the user profile.

## Current State Audit

### What Exists
| Feature | Location | Status |
|---|---|---|
| Assignment completion toggle | `ClassView.jsx` — marks `completed: true` | Working |
| Dashboard filters out completed | `Home.jsx` — only shows incomplete | Working |
| Study streak | `useStreak.js` — tracks daily study activity | Working |
| Garden growth from streak | `GardenContext.jsx` — streak drives stage | Working |
| Hearts system | `HeartsDisplay.jsx` — limits free tier | Working |
| No completion history | — | Missing |
| No celebration on completion | — | Missing |
| No achievement badges | — | Missing |

### Current Assignment Flow
1. User marks assignment complete in ClassView (kanban: Todo -> Doing -> Done)
2. Assignment stays in "Done" column of kanban, or "Archived" if manually archived
3. Dashboard (`Home.jsx`) filters out completed assignments
4. No reward, no confetti, no record of accomplishment

## Feature Spec

### 1. Completed Assignments Archive

**Location:** New tab in Classes.jsx alongside existing class cards.

**Classes page tabs:**
```
[Active Classes] [Archive]
```

**Archive view:**
```
┌──────────────────────────────────┐
│  Completed Assignments           │
│  This week: 7 · All time: 42    │
│                                  │
│  ── This Week ─────────────────  │
│  ● [red] CS HW 3      Mar 26   │
│  ● [red] CS Lab 4     Mar 25   │
│  ● [blue] Reading 7   Mar 24   │
│                                  │
│  ── Last Week ─────────────────  │
│  ● [green] Lab Report  Mar 18   │
│  ● [blue] Essay Draft  Mar 17   │
│                                  │
│  Load more...                    │
└──────────────────────────────────┘
```

- Grouped by week (This Week, Last Week, 2 Weeks Ago, etc.)
- Each item: class color dot + title + completed date
- Tap: navigate to assignment in ClassView
- Search: filter by class or title text
- Paginated: 20 items per load, "Load more" button

**Data:** Query `assignments WHERE completed = true ORDER BY completed_at DESC`

### 2. Weekly Completion Reward

**Trigger:** All assignments due this week are marked complete.

**Detection logic:**
```js
const weekStart = startOfWeek(new Date());
const weekEnd = endOfWeek(new Date());
const dueThisWeek = assignments.filter(a =>
  a.due_date >= weekStart && a.due_date <= weekEnd
);
const allComplete = dueThisWeek.every(a => a.completed);
```

**Reward sequence (when `allComplete` becomes true):**
1. Confetti burst: `canvas-confetti` package (lightweight, ~4KB)
   - Duration: 2 seconds
   - Particle count: 100
   - Colors: `['#deb96a', '#e4ddd0', '#4a7a6f']` (theme-aligned)
   - Origin: center of viewport
2. Toast: "All done this week! Your garden is thriving."
3. Garden bonus: +1 bonus growth point via `GardenContext`
4. `prefers-reduced-motion`: skip confetti, show toast only

**One-time per week:** Track in `localStorage` key `riven:weekly-reward-{weekId}` to prevent re-triggering.

### 3. Assignment Completion Streak

**Separate from study streak** — tracks consecutive weeks with zero overdue assignments at week's end.

**Logic:**
- Check every Sunday at midnight (or on app open on Monday)
- If no assignments were overdue at week's end: streak increments
- If any assignment was overdue: streak resets to 0
- Grace: overdue but completed within 24h of due date still counts as "on time"

**Display:**
- Small badge in Classes page header: "3-week clean slate"
- Badge: `rounded-full border border-claude-accent/30 bg-claude-accent/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-claude-accent`

**Data:**
```sql
ALTER TABLE users ADD COLUMN assignment_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN assignment_streak_updated_at TIMESTAMPTZ;
```

### 4. Achievement Badges

**Location:** Account.jsx — new "Achievements" section.
**Also visible on:** UserProfile.jsx (public profile).

```
┌──────────────────────────────────┐
│  Achievements                    │
│                                  │
│  [★ First Deck]  [🌱 7-Day]     │  <- Earned (full color)
│  [📚 100 Cards]  [✨ Clean Wk]  │
│                                  │
│  [░ Exam Ace]    [░ Social]      │  <- Locked (dimmed)
│  [░ Mentor]      [░ Veteran]     │
│                                  │
└──────────────────────────────────┘
```

**Badge definitions:**

| Badge | Name | Criteria | Icon (Lucide) |
|---|---|---|---|
| first_deck | First Deck | Create your first deck | `Layers` |
| streak_7 | 7-Day Streak | Reach a 7-day study streak | `Flame` |
| streak_30 | Monthly Warrior | 30-day study streak | `Trophy` |
| cards_100 | Century Studier | Study 100 cards total | `BookOpen` |
| cards_1000 | Knowledge Machine | Study 1000 cards total | `Zap` |
| clean_week | Clean Slate | Complete all weekly assignments on time | `CheckCircle` |
| clean_month | Perfect Month | 4 consecutive clean weeks | `Award` |
| first_group | Social Learner | Join a study group | `Users` |
| exam_90 | Exam Ace | Score 90%+ on a mock exam | `GraduationCap` |
| early_adopter | Early Adopter | Joined during alpha | `Sparkles` |

**Badge UI:**
- Earned: full color, `bg-claude-accent/10 border-claude-accent/30 text-claude-accent`
- Locked: dimmed, `bg-claude-bg/30 border-claude-border/20 text-claude-secondary/40`
- Each: `rounded-xl p-3 flex flex-col items-center gap-1.5`
- Icon: `w-6 h-6`
- Label: `text-[9px] font-mono uppercase tracking-wider`
- Grid: `grid grid-cols-4 gap-2` (mobile), `grid-cols-5` (desktop)

**Animation on unlock:**
- Scale `0.8 -> 1` spring (stiffness 300, damping 20) + `opacity 0 -> 1`
- Subtle glow pulse: `box-shadow: 0 0 20px var(--accent-color)` once, 600ms
- Toast: "Achievement unlocked: First Deck!"

**Data model:**
```sql
-- Add badges JSONB to users table
ALTER TABLE users ADD COLUMN badges JSONB DEFAULT '[]';
-- Example: [{"id": "first_deck", "earned_at": "2026-03-28T..."}]
```

**Badge check triggers:**
- `first_deck`: on deck creation success
- `streak_7`/`streak_30`: in `useStreak.js` when streak updates
- `cards_100`/`cards_1000`: at end of study session
- `clean_week`: on weekly completion reward trigger
- `first_group`: on group join
- `exam_90`: on mock exam submission with score >= 90
- `early_adopter`: auto-granted for users registered before Fall 2026

**Implementation:** Badge checks run client-side after relevant actions. If new badge earned, `POST /api/badges/award` persists to DB + shows unlock animation.

## Files to Create / Modify

| File | Change |
|------|--------|
| `client/src/components/achievements/BadgeGrid.jsx` | **New** — badge display grid |
| `client/src/components/achievements/BadgeCard.jsx` | **New** — individual badge with earned/locked state |
| `client/src/components/achievements/badgeDefinitions.js` | **New** — badge metadata (id, name, criteria, icon) |
| `client/src/hooks/useBadges.js` | **New** — badge check + award logic |
| `client/src/pages/Account.jsx` | Add Achievements section |
| `client/src/pages/UserProfile.jsx` | Add read-only Achievements section |
| `client/src/pages/Classes.jsx` | Add Archive tab, assignment streak badge |
| `client/src/pages/ClassView.jsx` | Trigger confetti on weekly completion |
| `client/src/pages/Home.jsx` | Trigger badge checks on relevant actions |
| `server/routes/badges.js` | **New** — badge CRUD endpoints |
| `supabase/migrations/` | Add `badges` JSONB, `assignment_streak` columns |

## Acceptance Criteria

- [ ] Archive tab in Classes shows completed assignments grouped by week
- [ ] Completing all weekly assignments triggers confetti + toast
- [ ] Confetti respects `prefers-reduced-motion` (skip animation, show toast only)
- [ ] Assignment streak tracks consecutive clean weeks (separate from study streak)
- [ ] Streak badge visible in Classes page header
- [ ] Achievement badges display on profile in earned/locked states
- [ ] Badge unlock shows spring animation + glow + toast
- [ ] Badges visible on public profile (read-only)
- [ ] All 10 badge types trigger correctly on their criteria
- [ ] Early Adopter badge auto-granted for alpha users
- [ ] `canvas-confetti` bundle size < 5KB (verify)

## Phased Rollout

- **Alpha:** Completed archive tab + confetti reward + "Early Adopter" badge
- **v1.0:** Full badge system (all 10 badges) + assignment streak
- **v1.1:** Badge notifications ("Your friend earned Exam Ace!"), badge rarity stats
