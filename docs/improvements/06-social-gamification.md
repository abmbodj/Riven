# Social & Gamification Enhancements

> **Status:** Planned | **Priority:** Medium | **Effort:** XL (2-4 weeks) | **Alpha-Critical:** No

## Summary

Enhance existing social features with leaderboards, group progress analytics, garden social sharing, and a "discovery" feature for matching classmates. The foundation is solid — study groups, friends, real-time cram sessions, and the garden all exist. This spec adds competitive/social layers on top.

## Current State Audit

### What Already Exists (Do Not Re-Implement)
| Feature | File | Status |
|---|---|---|
| Study groups (create/join) | `client/src/pages/StudyGroups.jsx` | Working |
| Group file sharing + folders | `client/src/pages/GroupDetails.jsx` | Working |
| Live cram sessions | `client/src/pages/GroupCram.jsx` | Working (real-time) |
| Friends system | `client/src/pages/Friends.jsx` | Working |
| Direct messages | `client/src/pages/Messages.jsx` | Working (real-time) |
| Garden SVG + GSAP | `client/src/components/Garden.jsx` | Working (16 stages) |
| Garden settings + heatmap | `client/src/pages/GardenSettings.jsx` | Working |
| Streak system | `client/src/hooks/useStreak.js` | Working |
| User profiles | `client/src/pages/UserProfile.jsx` | Working |

### GroupDetails.jsx Current Tabs
- Sessions (active cram sessions)
- Decks (shared deck library)
- Files (folder system with upload)

## Enhancement 1: Study Group Leaderboard

### Design

Add a "Leaderboard" tab to GroupDetails:

```
┌──────────────────────────────────┐
│  [Sessions] [Decks] [Files] [🏆] │
├──────────────────────────────────┤
│  This Week's Top Members         │
│                                  │
│  1. ★ Alex        142 cards  🔥7│
│     ████████████████████  94%    │
│                                  │
│  2.   Maya        98 cards   🔥5│
│     █████████████░░░░░░░  87%   │
│                                  │
│  3.   Jordan      67 cards   🔥3│
│     ████████░░░░░░░░░░░░  79%   │
│                                  │
│  ─── You: #4 · 52 cards ────────│
└──────────────────────────────────┘
```

**Component: `GroupLeaderboard.jsx`**
- Scope: within study group only (never global — privacy)
- Metrics: cards studied this week, accuracy %, streak days
- Ranking: sorted by cards studied (primary), accuracy (tiebreaker)
- #1 position: `★` icon + `text-claude-accent` highlight
- Current user: always visible at bottom with "You: #N" if not in top 5
- Progress bar: CSS bar (`h-1.5 rounded-full bg-claude-accent/20` fill)
- Streak flame: inline with streak count

**Data:**
- Query: aggregate `study_sessions` per group member for current week
- Cache: 15-minute server-side TTL
- API: `GET /api/groups/:id/leaderboard?period=week`

**Interaction:**
- Period toggle: "This Week" | "All Time" pills
- Tap member row -> navigate to their profile (`/profile/:userId`)

### Animation
- Mount: staggered list items (`opacity 0->1, x -12->0`, 50ms stagger)
- Rank change: `layoutId` on each row for position animation (spring)
- Progress bar: width animates from 0 to value (400ms ease-out)

## Enhancement 2: Group Progress Analytics

Add a "Stats" section to GroupDetails (below tabs or in a dedicated subtab):

```
┌──────────────────────────────────┐
│  Group Stats · This Week         │
│                                  │
│  347 cards    86% avg    12.5h   │
│  total        accuracy   studied │
│                                  │
│  Most Active: Alex (142 cards)   │
│  Hottest Streak: Maya (5 days)   │
└──────────────────────────────────┘
```

- Aggregate stats across all group members
- "Most Active" and "Hottest Streak" badges with avatar + name
- Same card styling as dashboard widgets: `bg-claude-surface/50 border border-claude-border/40 rounded-2xl p-5`

## Enhancement 3: Garden Social Sharing

### Share Garden Snapshot

Add "Share" button to `GardenSettings.jsx`:

```
[Share Garden] button -> generates image -> share sheet
```

**Implementation:**
1. Use `html-to-image` (`toJpeg` or `toPng`) to capture the Garden SVG + metadata
2. Composite: garden rendering + streak count + stage name + username
3. Output: 1080x1080 PNG (social-friendly square)
4. Share:
   - iOS native: `Capacitor.Share.share({ files: [imageUri] })`
   - PWA: `navigator.share({ files: [file] })` with fallback to download

**Share card layout:**
```
┌──────────────────────────────────┐
│                                  │
│         [Garden SVG]             │
│                                  │
│  🌿 Enchanted Grove · Day 100   │
│  @username · riven.app           │
│                                  │
└──────────────────────────────────┘
```

### Garden Leaderboard (Within Groups)

- "Most Grown Garden" section in group leaderboard
- Shows top 3 members by garden stage + streak days
- Thumbnail: mini garden SVG snapshot per member (static, not animated)

## Enhancement 4: Class Discovery (Classmate Matching)

### Concept

Students can discover others in the same classes, "dating-app style" card swiping to connect for study groups.

### Design

**New route: `/discover`**

```
┌──────────────────────────────────┐
│  Find Study Partners             │
│                                  │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │      [Avatar]              │  │
│  │      Alex M.               │  │
│  │                            │  │
│  │  Classes in common:        │  │
│  │  ● CS 101  ● MATH 240     │  │
│  │                            │  │
│  │  🔥 7-day streak           │  │
│  │  142 cards this week       │  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│     [Skip]          [Connect]    │
│                                  │
└──────────────────────────────────┘
```

**Card Stack Behavior:**
- Cards stack visually (z-depth with scale 0.95/0.9 on cards behind)
- Swipe right = "Connect" (send friend request)
- Swipe left = "Skip" (don't show again)
- Or use buttons below the card
- Swipe: `useSwipeGesture` hook already exists
- Card animates off screen: `translateX(±120%) rotate(±15deg)` 300ms

**Matching Logic (Server):**
- Query users who share at least 1 class with current user
- Exclude: already friends, already skipped, blocked users
- Sort by: number of classes in common (desc), then by study activity
- API: `GET /api/discover?limit=10`

**Privacy:**
- Opt-in: setting in Settings.jsx — "Discoverable in my classes" toggle (default OFF)
- Only shows: avatar, display name (not username), classes in common, streak, weekly cards
- Does NOT show: bio, full profile, messages — that's after connecting

### Data Model
```sql
-- Track skipped/connected discovery interactions
CREATE TABLE discovery_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  target_user_id UUID REFERENCES users(id),
  action TEXT CHECK (action IN ('skip', 'connect')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_user_id)
);

-- Add discoverable flag to users
ALTER TABLE users ADD COLUMN discoverable BOOLEAN DEFAULT FALSE;
```

## Enhancement 5: Garden HTML/CSS Migration

**Mentor suggestion:** Consider HTML/CSS/JS instead of SVG for better AI generation compatibility.

**Recommendation:** Low-priority refactor. Current SVG garden works well and has 16 stages already built with GSAP animations. Migration path:

- **Keep SVG** for stages 1-8 (already polished)
- **New stages 9-16** could use CSS-based approach (CSS `clip-path`, CSS animations, positioned `div` elements)
- This allows A/B testing both rendering approaches
- Long-term: if AI-generated garden variations are desired, CSS/HTML is easier to generate than SVG path data

**Flag for post-alpha consideration.**

## Files to Create / Modify

| File | Change |
|------|--------|
| `client/src/components/groups/GroupLeaderboard.jsx` | **New** — leaderboard tab component |
| `client/src/components/groups/GroupStats.jsx` | **New** — aggregate group stats |
| `client/src/pages/GroupDetails.jsx` | Add Leaderboard tab + Stats section |
| `client/src/pages/GardenSettings.jsx` | Add Share button + image generation |
| `client/src/pages/Discover.jsx` | **New** — classmate discovery page |
| `client/src/components/discover/DiscoveryCard.jsx` | **New** — swipeable user card |
| `client/src/routes/config.jsx` | Add `/discover` route |
| `client/src/pages/Settings.jsx` | Add "Discoverable" toggle |
| `server/routes/groups.js` | Add leaderboard + stats endpoints |
| `server/routes/social.js` | Add discover + interaction endpoints |
| `supabase/migrations/` | Add `discovery_interactions` table, `discoverable` column |

## Acceptance Criteria

- [ ] Leaderboard tab in GroupDetails shows ranked members by cards studied
- [ ] Leaderboard updates weekly, cached 15 minutes
- [ ] Group stats show aggregate cards, accuracy, time, most active member
- [ ] Garden share generates 1080x1080 image and opens native share sheet
- [ ] Discovery shows card stack of classmates with classes in common
- [ ] Swipe right sends friend request, swipe left skips
- [ ] Discovery is opt-in via Settings toggle (default OFF)
- [ ] Skipped users don't reappear
- [ ] All cards have minimum 44x44px touch targets
- [ ] Swipe gesture works on mobile (reuses `useSwipeGesture`)
- [ ] `prefers-reduced-motion` disables card stack animations

## Phased Rollout

- **Alpha:** Group leaderboard tab only (simplest, highest engagement value)
- **v1.0:** Group stats, garden sharing
- **v1.1:** Discovery feature (requires opt-in, DB migration, matching algorithm)
- **v2.0:** Garden HTML/CSS migration for new stages
