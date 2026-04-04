# Study Guide UX Simplification — Design Spec
**Date:** 2026-04-04
**Status:** Approved

---

## Context

The study guide tool (GuideView, StudySection, QuizMeMode, GuideProgressDashboard) is powerful but overwhelming — especially for new users. The entry screen presents three session modes simultaneously, mobile actions are hidden behind unlabelled icons, and the overall flow feels like four separate apps stitched together. The goal is to reduce cognitive load for first-time users and shorten the path from "open guide" to "actively studying," while preserving all existing power features and matching Riven's existing design system.

**Goals:**
1. New users can open a guide and start studying without having to understand all the modes first
2. Fewer taps from guide open → active recall
3. No new navigation chrome that competes with the existing floating dock

**Non-goals:**
- Full component rewrite
- Spaced repetition algorithm changes
- Desktop layout changes (this pass is mobile-first)

---

## Design Decisions

### 1. Entry Screen — Smart Default CTA

**Before:** Three parallel session cards (Full Session / Quick Session with 3 time buttons / Quiz Me) + Study Coach banner + Section Snapshot grid. Users must choose before they can start.

**After:** One primary "Recommended" CTA that the app selects automatically, with all other session types collapsed to a secondary text link.

**Recommendation logic** (reuses existing `getWeakSections` + `getSessionSections` from `studyGuides.js`):
- If weak sections exist → recommend "Review Weak Sections" (Quick Session targeting weak ones)
- If no weak sections but progress < 100% → recommend "Continue Session" (next unreviewed section)
- If 100% complete → recommend "Full Review" (full session)

**First-run hint card:**
- Shows only on first visit to any v2 guide (persisted via `localStorage` key `riven_guide_onboarded`)
- Single dismissible card: "Recall each topic → reveal the answer → rate yourself. Riven tracks what to review next."
- Dismissed permanently on ✕ tap
- Uses `AnimatePresence` for exit animation

**Secondary options:**
- "Other options: Full session · Quiz me · Custom ›" — tappable text link below the primary CTA
- Expands inline (not a new screen) to reveal the existing session type cards
- Uses `motion/react` height animation to expand/collapse

**Weak section pills:**
- Compact 2-column strip at the bottom of the entry screen (max 2 pills shown)
- Purely informational — no interaction required

**Files to change:** `client/src/pages/GuideView.jsx` (entry mode render block)

---

### 2. Mobile Dock — Contextual Morph

**Before:** Three icon-only buttons (≡ / ⚙️ / 📝) rendered as a separate bottom row inside GuideView. These conflict visually with the app's existing floating dock.

**After:** The existing floating dock morphs its content when a study session starts, then restores when the session ends. No new bottom bar is added.

**Dock states:**

| State | Top row (tabs) | Bottom row |
|-------|---------------|------------|
| Default | Rooms · Inspiration · Profiles | Explore · Assistant · Configs |
| Study mode | Sections · Details · Note | ← · 2/6 · → |

**Transition animation:**
- Triggered on `sessionMode` change (`entry` → `studying`, and `studying`/`quiz` → `entry`/`dashboard`)
- Tab labels: `AnimatePresence` with `initial={{ opacity: 0, y: 4 }}` / `exit={{ opacity: 0, y: -4 }}`
- Pill border color: `motion` transition from `rgba(255,255,255,0.1)` → `rgba(34,197,94,0.2)` (study green)
- Pill background: transitions from neutral to `rgba(20,40,20,0.75)`
- All spring physics: `{ type: "spring", stiffness: 400, damping: 30 }` — matches existing Riven sheet animations

**Tab behavior in study mode:**
- **Sections** tab: opens the existing `showMobileSections` sheet (no change to sheet content)
- **Details** tab: opens the existing `showMobileMoreDetails` sheet (no change to sheet content)
- **Note** tab: opens the existing `showMobileNoteEditor` sheet (no change to sheet content)
- Active tab highlighted with `rgba(34,197,94,0.18)` bg + `#86efac` text

**Dock integration point:** The dock is `client/src/components/MobileBottomNav.jsx`, rendered in `client/src/components/Layout.jsx:401`. It receives `primaryNavItems` as a prop. The existing `client/src/context/UIContext.jsx` is the right place to thread study session state — add an `isStudying` boolean + `studyDockActions` object (with `onSections`, `onDetails`, `onNote`, `currentSection`, `totalSections`, `onPrev`, `onNext`) to UIContext. GuideView sets these when a session starts and clears them on exit. Layout.jsx reads them and passes study-mode content to MobileBottomNav when `isStudying` is true.

**Files to change:**
- `client/src/pages/GuideView.jsx` — set UIContext study state on session start/end, remove old icon-button row
- `client/src/context/UIContext.jsx` — add `isStudying` + `studyDockActions` to context value
- `client/src/components/MobileBottomNav.jsx` — accept optional `studyMode` prop, render morphing dock content
- `client/src/components/Layout.jsx` — read UIContext, pass study props to MobileBottomNav

---

### 3. Post-Session Screen — Replace Dashboard as Default Landing

**Before:** After completing all sections, the app transitions to `GuideProgressDashboard` — a full color-coded breakdown of all sections. This is information-dense and doesn't give a clear next action.

**After:** A lightweight "Session Complete" screen appears first, with the dashboard accessible via a secondary link.

**Post-session screen content:**
- Celebration header (emoji + "Session Complete" + sections reviewed + time)
- 3-stat row: Mastery % · Still weak count · Session gain (delta from session start)
- Primary CTA: "Study Again Tomorrow" (or "Keep Going" if weak sections remain) — not interactive, just motivational copy with a subtitle
- Secondary link: "View full progress dashboard ›" — navigates to existing `GuideProgressDashboard`
- Dock restores to default state (spring animation back to neutral)

**Session delta calculation:** Snapshot `weakSectionCount` at session start, compare at session end. Show `+N%` mastery gain based on sections marked "know_it" vs "need_work" this session. Logic lives in `studyGuides.js` — add a `getSessionDelta(stateBefore, stateAfter)` helper.

**Files to change:**
- `client/src/pages/GuideView.jsx` — add `post-session` mode, modify session completion transition
- `client/src/utils/studyGuides.js` — add `getSessionDelta` helper
- `client/src/components/GuideProgressDashboard.jsx` — no changes (still used as full dashboard)

---

## Design System Compliance

All changes use existing Riven tokens and conventions:

| Element | Token / class |
|---------|--------------|
| Surface cards | `guide-shell`, `bg-[#1a1a1a]` |
| Recommended CTA | `guide-tone-success` border + `#22c55e` button |
| Hint card | `bg-[#1a1f2e]` + `border-[rgba(147,197,253,0.2)]` |
| Weak pills | `guide-tone-danger` |
| Study dock active tab | `rgba(34,197,94,0.18)` bg + `#86efac` text |
| Animations | `motion/react` spring, `AnimatePresence` — matches existing sheet pattern |
| Border radius | `rounded-[1.2rem]` cards, `rounded-[2rem]` dock pill |
| Safe area | `pb-safe` on dock, `safe-area-bottom` on post-session CTA |

---

## What Does NOT Change

- Desktop layout (sticky rail + main stage) — untouched
- `StudySection.jsx` recall → reveal → confidence flow — untouched
- `QuizMeMode.jsx` — untouched
- `SectionEditor.jsx` inline edit — untouched
- All existing session type logic (`getSessionSections`, `getWeakSections`) — reused as-is
- `GuideProgressDashboard.jsx` — still accessible, just no longer the forced post-session landing
- v1 (legacy rich-text) guide view — untouched

---

## Verification

1. **New user flow:** Open a v2 guide for the first time → see hint card → tap "Start Session" → session starts without choosing a mode → hint card does not reappear on second visit
2. **Returning user:** Open guide → no hint card → smart recommendation matches weakest sections → "Other options ›" expands inline → can still pick Full / Quiz / Custom
3. **Mobile dock:** Start session → dock animates from default to study green with Sections/Details/Note tabs → tap Sections → section sheet opens → tap ✕ Exit → dock animates back to Rooms/Inspiration/Profiles
4. **Post-session:** Complete all session sections → land on Session Complete screen (not dashboard) → stat delta is correct → tap "View full progress dashboard ›" → navigates to existing dashboard
5. **Desktop:** No visual regressions — all changes are behind mobile breakpoint checks or in new render blocks
