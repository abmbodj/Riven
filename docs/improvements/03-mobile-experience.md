# Mobile Experience Optimization

> **Status:** Planned | **Priority:** High | **Alpha-Critical:** Yes | **Effort:** M (3-5 days)

## Summary

Study features need better mobile optimization: jump-to functionality with search for faster topic navigation instead of endless scrolling. The `GlobalCommandPalette` (Cmd+K) exists but search is buried behind 2 taps on mobile (FAB -> Search). Long pages like Dashboard and ClassView need section anchors and collapsible content to reduce scroll depth.

## Current State Audit

### Search Access
- **Desktop:** `Cmd+K` or `/` keyboard shortcut, sidebar search button
- **Mobile:** FAB overlay -> Search hero row -> opens `GlobalCommandPalette`
- **Problem:** 2 taps to reach search on mobile. Most users won't discover it

### Long-Scroll Pages
- **Home.jsx (Dashboard):** streak card + overdue section + upcoming section + quick study + recently visited = ~1000-1400px on mobile
- **ClassView.jsx:** class info + schedule + assignments (kanban: Todo/Doing/Done/Archived) + linked decks/notes = ~1200-2000px
- **DeckLibrary.jsx:** full deck list with folders, tags, sort/filter — virtualized but no section jump
- **StudyDashboard.jsx:** module cards grid — ok on mobile but no quick-filter

### What Already Works
- `GlobalCommandPalette.jsx` — full search/nav palette, well-built
- `PullToRefresh.jsx` — mobile pull gesture exists
- `useSwipeGesture` hook — swipe navigation in study modes
- `prefetchRoute()` — route prefetching on hover/touch

## Problems Identified

1. **Search buried** — 2 taps vs should be 1 tap or always visible
2. **No section jump-to** — ClassView and Home have no anchor navigation
3. **Dashboard scroll depth** — 1000-1400px with no way to skip sections
4. **Study libraries lack quick filters** — DeckLibrary, NotesLibrary, etc. require scrolling to find items
5. **No "continue where you left off"** — users must navigate back to their last study session manually

## Proposed Changes

### 1. Elevate Search Access

**Option A (recommended):** Persistent search bar at top of key pages
- Dashboard, DeckLibrary, Classes: thin search bar (`h-10 rounded-xl bg-claude-bg/60 border border-claude-border/40`)
- Tap opens `GlobalCommandPalette` — zero overhead, reuses existing component
- Placeholder: "Search decks, notes, classes..." with `Search` icon left

**Option B:** Replace one bottom nav item with search
- Replace FAB center button with Search icon
- Move create action to a page-level CTA button
- Risk: losing the prominent create entry point

### 2. Jump-To Navigation for Long Pages

**Home.jsx — Section Jump Row:**
```
┌──────────────────────────────────────┐
│  [Overdue 3]  [Today 2]  [Study]    │  <- Horizontal pill row
└──────────────────────────────────────┘
```
- Placed below the streak card
- Pills: `rounded-full px-3 py-1.5 text-xs font-mono uppercase tracking-wider`
- Active pill shows count badge (number of items in that section)
- Tap scrolls to section with `scrollIntoView({ behavior: 'smooth', block: 'start' })`
- Active pill tracks scroll position via `IntersectionObserver` on section headings
- Horizontal scroll with `overflow-x-auto scrollbar-hide gap-2`

**ClassView.jsx — Sticky Section Tabs:**
```
┌──────────────────────────────────────┐
│  [Assignments]  [Decks]  [Notes]     │  <- Sticky below header
└──────────────────────────────────────┘
```
- `sticky top-0 z-10 bg-claude-surface/90 backdrop-blur-sm`
- Same pill style as Home jump row
- `IntersectionObserver` highlights active tab as user scrolls
- Tab tap scrolls to corresponding section

### 3. Collapsible Sections to Reduce Scroll

**Home.jsx:**
- Overdue section: show max 3 items, "Show all X" expandable
- Upcoming section: show max 5 items, "Show all X" expandable
- Recently visited: show max 3, "See all" links to library
- Use `AnimatePresence` for expand/collapse (`height: auto` via `motion.div`)

**DeckLibrary.jsx / NotesLibrary.jsx:**
- Already uses virtualized list — good
- Add: collapsed folder groups with item count badges

### 4. Quick-Filter Pills for Study Content

Add to DeckLibrary, NotesLibrary, GuidesLibrary, ExamsLibrary:
```
┌──────────────────────────────────────┐
│  [All]  [Recent]  [By Class ▾]       │  <- Filter pills
└──────────────────────────────────────┘
```
- Pills: `rounded-full h-8 px-3 text-xs font-mono uppercase tracking-wider`
- Active: `bg-claude-accent/15 text-claude-accent border-claude-accent/30`
- Inactive: `bg-claude-bg/50 text-claude-secondary border-claude-border/50`
- "By Class" opens dropdown of user's classes for filtering
- Horizontal scroll: `overflow-x-auto scrollbar-hide flex gap-2`
- Filter state: URL search params (`?filter=recent&class=cs101`) for shareability

### 5. "Continue Studying" Quick Entry

Add to Dashboard (Home.jsx) as top-priority card:
```
┌──────────────────────────────────────┐
│  Continue: Data Structures Deck      │
│  ████████░░░░ 67% · 12 cards left    │
│                          [Resume →]  │
└──────────────────────────────────────┘
```
- Shows if user has an in-progress study session (check `study_sessions` table for incomplete sessions)
- Card: `bg-claude-accent/[0.06] border border-claude-accent/20 rounded-2xl p-4`
- Progress bar: `h-1.5 rounded-full bg-claude-accent/20` with `bg-claude-accent` fill
- Tap anywhere navigates to `/deck/:id/study`
- Dismiss: small X that marks session as abandoned

## Touch Performance Rules

- All tap targets: minimum 44x44px (`touch-target` class already in CSS)
- Transitions: 150-300ms, use `transform`/`opacity` — never animate `height`/`width` directly
- Loading states: skeleton screens (`animate-pulse`) not spinners for content lists
- `scrollIntoView` with `behavior: 'smooth'` for jump-to (respects `prefers-reduced-motion`)
- Avoid `IntersectionObserver` threshold arrays larger than 3 values (performance)

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/Home.jsx` | Add jump-to row, collapsible sections, "Continue Studying" card |
| `client/src/pages/ClassView.jsx` | Add sticky section tabs (Assignments / Decks / Notes) |
| `client/src/pages/DeckLibrary.jsx` | Add quick-filter pills row |
| `client/src/pages/NotesLibrary.jsx` | Add quick-filter pills row |
| `client/src/pages/GuidesLibrary.jsx` | Add quick-filter pills row |
| `client/src/pages/ExamsLibrary.jsx` | Add quick-filter pills row |
| `client/src/components/MobileBottomNav.jsx` | (If Option B) Replace FAB with search |

## Acceptance Criteria

- [ ] Search accessible in 1 tap from Dashboard, Library, and Classes pages
- [ ] Home.jsx: jump-to pills scroll to correct section
- [ ] Home.jsx: sections collapse to 3-5 items with "Show all" expander
- [ ] ClassView: sticky section tabs highlight active section on scroll
- [ ] Library pages: filter pills filter content by recency and class
- [ ] "Continue Studying" card appears when user has an in-progress session
- [ ] All new interactive elements are minimum 44x44px
- [ ] Scroll depth on Home.jsx reduced by ~40% with collapsed sections
- [ ] `prefers-reduced-motion`: smooth scroll becomes instant, expand/collapse has no animation
- [ ] No layout shift when sections expand/collapse (reserve space or use `transform`)

## Phased Rollout

- **Alpha:** Search bar on Dashboard + jump-to pills on Home.jsx + collapsible sections
- **v1.0:** Sticky tabs on ClassView, filter pills on all libraries, "Continue Studying" card
