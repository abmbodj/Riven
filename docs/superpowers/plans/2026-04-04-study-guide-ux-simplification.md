# Study Guide UX Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the study guide experience so new users can open a guide and start studying in one tap, without learning all the modes — while preserving every existing power feature.

**Architecture:** Three self-contained changes: (1) `studyGuides.js` gets a `getSessionDelta` helper and a `getRecommendedSession` selector; (2) `UIContext` grows `isStudying` + `studyDockActions` so `GuideView` can signal session state to the global nav; (3) `GuideView`'s entry screen is replaced with a smart-default CTA + first-run hint, the old icon-button bottom bar is removed, post-session lands on a new lightweight summary screen, and `MobileBottomNav` morphs between default and study states via `AnimatePresence`.

**Tech Stack:** React 19, motion/react (AnimatePresence + motion.div), Tailwind CSS with existing `guide-*` / `claude-*` tokens, Vitest + React Testing Library, localStorage for first-run state.

---

## File Map

| File | Change |
|------|--------|
| `client/src/utils/studyGuides.js` | Add `getRecommendedSession` + `getSessionDelta` exports |
| `client/src/utils/studyGuides.test.js` | Add tests for new helpers |
| `client/src/context/UIContext.jsx` | Add `isStudying`, `studyDockActions`, `setStudyMode`, `clearStudyMode` |
| `client/src/components/MobileBottomNav.jsx` | Accept `studyMode` prop, render morphing dock with `AnimatePresence` |
| `client/src/components/Layout.jsx` | Read `UIContext.studyMode`, pass to `MobileBottomNav` |
| `client/src/pages/GuideView.jsx` | New entry render, remove old bottom bar, add post-session mode, wire UIContext |

---

## Task 1: Add `getRecommendedSession` and `getSessionDelta` to studyGuides.js

**Files:**
- Modify: `client/src/utils/studyGuides.js`
- Test: `client/src/utils/studyGuides.test.js`

### Background
`getRecommendedSession` decides what session to auto-start. `getSessionDelta` computes mastery gain for the post-session screen. Both are pure functions — no UI side effects.

- [ ] **Step 1: Write failing tests**

Add to the bottom of `client/src/utils/studyGuides.test.js`:

```js
import {
    getSessionSections,
    getSectionStatus,
    getWeakSections,
    normalizeGuideStudyState,
    updateSection,
    getRecommendedSession,
    getSessionDelta,
} from './studyGuides.js';

// --- getRecommendedSession ---

describe('getRecommendedSession', () => {
    it('returns type "weak" when weak sections exist', () => {
        const guideData = makeGuideData();
        // sec-2 has need_work → weak
        const studyState = makeStudyState();
        const result = getRecommendedSession(guideData, studyState);
        expect(result.type).toBe('weak');
        expect(result.sections.length).toBeGreaterThan(0);
    });

    it('returns type "continue" when no weak sections but guide incomplete', () => {
        const guideData = makeGuideData();
        const studyState = makeStudyState({
            'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-2': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-3': { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
        });
        const result = getRecommendedSession(guideData, studyState);
        expect(result.type).toBe('continue');
        expect(result.sections.length).toBeGreaterThan(0);
    });

    it('returns type "full" when guide is 100% complete', () => {
        const guideData = makeGuideData();
        const studyState = makeStudyState({
            'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-2': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-3': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        });
        const result = getRecommendedSession(guideData, studyState);
        expect(result.type).toBe('full');
    });
});

// --- getSessionDelta ---

describe('getSessionDelta', () => {
    it('returns mastery delta and weak count delta between two states', () => {
        const guideData = makeGuideData();
        const stateBefore = makeStudyState({
            'sec-1': { revealed: true, confidence: 'need_work', completed: false, note: '', last_reviewed_at: null },
            'sec-2': { revealed: true, confidence: 'need_work', completed: false, note: '', last_reviewed_at: null },
            'sec-3': { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
        });
        const stateAfter = makeStudyState({
            'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-2': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-3': { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
        });
        const delta = getSessionDelta(guideData, stateBefore, stateAfter);
        expect(delta.masteryDeltaPercent).toBeGreaterThan(0);
        expect(delta.weakCountAfter).toBeLessThan(delta.weakCountBefore);
        expect(delta.sectionsReviewed).toBe(2);
    });

    it('returns zeroes when nothing changed', () => {
        const guideData = makeGuideData();
        const state = makeStudyState();
        const delta = getSessionDelta(guideData, state, state);
        expect(delta.masteryDeltaPercent).toBe(0);
        expect(delta.sectionsReviewed).toBe(0);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run client/src/utils/studyGuides.test.js
```

Expected: FAIL — `getRecommendedSession is not a function`, `getSessionDelta is not a function`

- [ ] **Step 3: Implement the two helpers**

Append to the bottom of `client/src/utils/studyGuides.js`:

```js
/**
 * Decides the best session to auto-start.
 * Returns { type: 'weak' | 'continue' | 'full', sections: Section[], label: string, detail: string }
 */
export const getRecommendedSession = (guideData, studyState) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    if (!normalizedGuideData) return { type: 'full', sections: [], label: 'Start Session', detail: '' };

    const weak = getWeakSections(guideData, studyState);
    if (weak.length > 0) {
        const names = weak.slice(0, 2).map((s) => s.title).join(' + ');
        const extra = weak.length > 2 ? ` + ${weak.length - 2} more` : '';
        return {
            type: 'weak',
            sections: weak,
            label: 'Review Weak Sections',
            detail: `${names}${extra} · ~${weak.length * MINUTES_PER_SECTION} min`,
        };
    }

    const incomplete = normalizedGuideData.sections.filter(
        (s) => !normalizedStudyState.section_states[s.id]?.completed
    );
    if (incomplete.length > 0) {
        return {
            type: 'continue',
            sections: incomplete,
            label: 'Continue Session',
            detail: `${incomplete.length} section${incomplete.length !== 1 ? 's' : ''} remaining`,
        };
    }

    return {
        type: 'full',
        sections: normalizedGuideData.sections,
        label: 'Full Review',
        detail: `All ${normalizedGuideData.sections.length} sections`,
    };
};

/**
 * Computes what changed during a session.
 * Returns { masteryDeltaPercent, weakCountBefore, weakCountAfter, sectionsReviewed }
 */
export const getSessionDelta = (guideData, stateBefore, stateAfter) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    if (!normalizedGuideData) return { masteryDeltaPercent: 0, weakCountBefore: 0, weakCountAfter: 0, sectionsReviewed: 0 };

    const sections = normalizedGuideData.sections;
    const total = sections.length;

    const completedBefore = sections.filter((s) => stateBefore?.section_states?.[s.id]?.completed).length;
    const completedAfter = sections.filter((s) => stateAfter?.section_states?.[s.id]?.completed).length;

    const masteryBefore = total > 0 ? Math.round((completedBefore / total) * 100) : 0;
    const masteryAfter = total > 0 ? Math.round((completedAfter / total) * 100) : 0;

    const weakBefore = getWeakSections(guideData, stateBefore).length;
    const weakAfter = getWeakSections(guideData, stateAfter).length;

    const sectionsReviewed = sections.filter((s) => {
        const before = stateBefore?.section_states?.[s.id];
        const after = stateAfter?.section_states?.[s.id];
        return !before?.completed && after?.completed;
    }).length;

    return {
        masteryDeltaPercent: masteryAfter - masteryBefore,
        weakCountBefore: weakBefore,
        weakCountAfter: weakAfter,
        sectionsReviewed,
    };
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run client/src/utils/studyGuides.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/ab/Desktop/Riven/Riven && git add client/src/utils/studyGuides.js client/src/utils/studyGuides.test.js && git commit -m "feat: add getRecommendedSession and getSessionDelta helpers to studyGuides"
```

---

## Task 2: Add study session state to UIContext

**Files:**
- Modify: `client/src/context/UIContext.jsx`

### Background
`GuideView` needs to signal to `MobileBottomNav` (which lives in `Layout`, outside `GuideView`) that a study session is active. UIContext already manages nav state — it's the right home for this.

No tests needed: UIContext is wiring-only (no business logic). The integration will be verified in Task 6.

- [ ] **Step 1: Add study session state to UIContext**

Replace the full contents of `client/src/context/UIContext.jsx`:

```jsx
import { createContext, useState, useCallback, useMemo } from 'react';
export const UIContext = createContext(null);

export function UIProvider({ children }) {
    const [hideBottomNav, setHideBottomNav] = useState(false);
    const [navCollapsed, setNavCollapsed] = useState(
        () => localStorage.getItem('riven:nav-collapsed') === 'true'
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [notifPanelOpen, setNotifPanelOpen] = useState(false);

    // Study session state — set by GuideView, read by MobileBottomNav via Layout
    const [studyMode, setStudyModeState] = useState(null);
    // studyMode shape: {
    //   currentIndex: number,
    //   totalSections: number,
    //   onSections: () => void,
    //   onDetails: () => void,
    //   onNote: () => void,
    //   onPrev: () => void,
    //   onNext: () => void,
    //   canPrev: boolean,
    //   canNext: boolean,
    // } | null

    const showBottomNav = useCallback(() => setHideBottomNav(false), []);
    const hideNav = useCallback(() => setHideBottomNav(true), []);

    const toggleNav = useCallback(() => {
        setNavCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('riven:nav-collapsed', String(next));
            return next;
        });
    }, []);

    const toggleDrawer = useCallback(() => setDrawerOpen(p => !p), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);
    const toggleNotifPanel = useCallback(() => setNotifPanelOpen(p => !p), []);
    const closeNotifPanel = useCallback(() => setNotifPanelOpen(false), []);

    const setStudyMode = useCallback((actions) => setStudyModeState(actions), []);
    const clearStudyMode = useCallback(() => setStudyModeState(null), []);

    const value = useMemo(() => ({
        hideBottomNav, showBottomNav, hideNav,
        navCollapsed, toggleNav,
        drawerOpen, toggleDrawer, closeDrawer,
        notifPanelOpen, toggleNotifPanel, closeNotifPanel,
        studyMode, setStudyMode, clearStudyMode,
    }), [
        hideBottomNav, showBottomNav, hideNav,
        navCollapsed, toggleNav,
        drawerOpen, toggleDrawer, closeDrawer,
        notifPanelOpen, toggleNotifPanel, closeNotifPanel,
        studyMode, setStudyMode, clearStudyMode,
    ]);

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
}
```

- [ ] **Step 2: Verify the app still loads (no runtime errors)**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run client/src/components/Layout.test.jsx
```

Expected: All existing Layout tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/ab/Desktop/Riven/Riven && git add client/src/context/UIContext.jsx && git commit -m "feat: add study session state to UIContext"
```

---

## Task 3: Morph MobileBottomNav into study mode

**Files:**
- Modify: `client/src/components/MobileBottomNav.jsx`
- Test: `client/src/components/MobileBottomNav.test.jsx`

### Background
When `studyMode` prop is provided (non-null), the dock switches from the default nav items to study controls: Sections / Details / Note tabs + Prev/Count/Next navigation. Labels crossfade via `AnimatePresence`. Pill border transitions to study green.

- [ ] **Step 1: Write failing tests**

Open `client/src/components/MobileBottomNav.test.jsx` and add these tests after the existing ones:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav.jsx';

// (keep existing tests unchanged, add below)

describe('MobileBottomNav study mode', () => {
    const mockStudyMode = {
        currentIndex: 1,
        totalSections: 5,
        onSections: vi.fn(),
        onDetails: vi.fn(),
        onNote: vi.fn(),
        onPrev: vi.fn(),
        onNext: vi.fn(),
        canPrev: true,
        canNext: true,
    };

    function renderStudyNav(studyMode = mockStudyMode) {
        return render(
            <MemoryRouter>
                <MobileBottomNav
                    primaryNavItems={[]}
                    onFabPress={vi.fn()}
                    studyMode={studyMode}
                />
            </MemoryRouter>
        );
    }

    it('renders study tabs when studyMode is provided', () => {
        renderStudyNav();
        expect(screen.getByText('Sections')).toBeInTheDocument();
        expect(screen.getByText('Details')).toBeInTheDocument();
        expect(screen.getByText('Note')).toBeInTheDocument();
    });

    it('shows section count in study mode', () => {
        renderStudyNav();
        expect(screen.getByText('2 / 5')).toBeInTheDocument();
    });

    it('calls onSections when Sections tab is tapped', () => {
        renderStudyNav();
        fireEvent.click(screen.getByText('Sections'));
        expect(mockStudyMode.onSections).toHaveBeenCalled();
    });

    it('calls onPrev when prev button is tapped', () => {
        renderStudyNav();
        fireEvent.click(screen.getByLabelText('Previous section'));
        expect(mockStudyMode.onPrev).toHaveBeenCalled();
    });

    it('calls onNext when next button is tapped', () => {
        renderStudyNav();
        fireEvent.click(screen.getByLabelText('Next section'));
        expect(mockStudyMode.onNext).toHaveBeenCalled();
    });

    it('disables prev button when canPrev is false', () => {
        renderStudyNav({ ...mockStudyMode, canPrev: false });
        expect(screen.getByLabelText('Previous section')).toBeDisabled();
    });

    it('does not render study tabs when studyMode is null', () => {
        render(
            <MemoryRouter>
                <MobileBottomNav
                    primaryNavItems={[{ to: '/home', label: 'Home', icon: () => null, matchers: ['/home'] }]}
                    onFabPress={vi.fn()}
                    studyMode={null}
                />
            </MemoryRouter>
        );
        expect(screen.queryByText('Sections')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run client/src/components/MobileBottomNav.test.jsx
```

Expected: FAIL — study mode tests fail because `studyMode` prop not yet handled

- [ ] **Step 3: Implement study mode in MobileBottomNav**

Replace the full contents of `client/src/components/MobileBottomNav.jsx`:

```jsx
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import { prefetchRoute } from '../routes/config.jsx';

const routeMatches = (pathname, matchers = []) =>
    matchers.some((m) => pathname === m || pathname.startsWith(`${m}/`));

const SPRING = { type: 'spring', stiffness: 400, damping: 30 };

export default function MobileBottomNav({ primaryNavItems, onFabPress, studyMode = null }) {
    const location = useLocation();

    return (
        <nav
            aria-label="Main navigation"
            className="fixed bottom-0 left-0 right-0 z-40 pb-safe md:hidden"
        >
            <div className="mx-3 mb-2">
                <motion.div
                    animate={studyMode ? {
                        backgroundColor: 'rgba(20,40,20,0.75)',
                        borderColor: 'rgba(34,197,94,0.2)',
                    } : {
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                    }}
                    transition={SPRING}
                    className="mobile-bottom-nav-shell rounded-[1.75rem] border"
                >
                    <div className="mobile-bottom-nav-shell__clip rounded-[inherit]">
                        <AnimatePresence mode="wait" initial={false}>
                            {studyMode ? (
                                <motion.div
                                    key="study"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={SPRING}
                                    className="flex flex-col px-4 pt-2 pb-1"
                                >
                                    {/* Study tabs row */}
                                    <div className="flex gap-2 mb-2">
                                        {[
                                            { label: 'Sections', handler: studyMode.onSections },
                                            { label: 'Details', handler: studyMode.onDetails },
                                            { label: 'Note', handler: studyMode.onNote },
                                        ].map(({ label, handler }) => (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={handler}
                                                className="flex-1 rounded-[0.85rem] py-1.5 text-[10px] font-mono font-semibold uppercase tracking-[0.1em] text-[#86efac]/60 transition-colors tap-action first:bg-[rgba(34,197,94,0.15)] first:text-[#86efac]"
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Prev / count / Next row */}
                                    <div className="flex items-center justify-between px-1 pb-1">
                                        <button
                                            type="button"
                                            aria-label="Previous section"
                                            disabled={!studyMode.canPrev}
                                            onClick={studyMode.onPrev}
                                            className="tap-action flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-30"
                                        >
                                            <ChevronLeft className="h-5 w-5 text-[#86efac]/70" />
                                        </button>
                                        <span className="text-[12px] font-bold text-[#86efac]">
                                            {studyMode.currentIndex + 1} / {studyMode.totalSections}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label="Next section"
                                            disabled={!studyMode.canNext}
                                            onClick={studyMode.onNext}
                                            className="tap-action flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-30"
                                        >
                                            <ChevronRight className="h-5 w-5 text-[#86efac]" />
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="default"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={SPRING}
                                    className="flex items-stretch h-[68px]"
                                >
                                    {primaryNavItems.map((item) => {
                                        if (item.isFab) {
                                            return (
                                                <button
                                                    key="fab"
                                                    type="button"
                                                    onClick={onFabPress}
                                                    aria-label="Create"
                                                    className="flex-1 flex items-center justify-center tap-action relative cursor-pointer"
                                                >
                                                    <div className="mobile-fab-button w-[52px] h-[52px] -mt-3 rounded-full flex items-center justify-center overflow-visible">
                                                        <motion.div
                                                            whileTap={{ scale: 0.88 }}
                                                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                                            className="mobile-fab-icon h-full w-full"
                                                        >
                                                            <Plus className="w-6 h-6 text-claude-accent" strokeWidth={2.5} />
                                                        </motion.div>
                                                    </div>
                                                </button>
                                            );
                                        }

                                        const isActive = routeMatches(location.pathname, item.matchers);
                                        const Icon = item.icon;

                                        return (
                                            <Link
                                                key={item.to}
                                                to={item.to}
                                                onTouchStart={() => prefetchRoute(item.to)}
                                                onMouseEnter={() => prefetchRoute(item.to)}
                                                className="flex-1 flex flex-col items-center justify-center gap-1 tap-action cursor-pointer group"
                                            >
                                                <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl transition-colors duration-200">
                                                    {isActive && (
                                                        <motion.div
                                                            layoutId="mobile-nav-pill"
                                                            className="absolute inset-0 rounded-2xl bg-claude-accent/12 border border-claude-accent/15"
                                                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                                        />
                                                    )}
                                                    <Icon
                                                        className={`w-[20px] h-[20px] relative z-[1] transition-colors duration-200 ${
                                                            isActive
                                                                ? 'text-claude-accent'
                                                                : 'text-claude-secondary group-hover:text-claude-text'
                                                        }`}
                                                        strokeWidth={isActive ? 2.2 : 1.8}
                                                    />
                                                </div>
                                                <span
                                                    className={`text-[9px] font-mono font-semibold uppercase tracking-[0.1em] transition-colors duration-200 ${
                                                        isActive
                                                            ? 'text-claude-accent'
                                                            : 'text-claude-secondary/70 group-hover:text-claude-secondary'
                                                    }`}
                                                >
                                                    {item.label}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </nav>
    );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run client/src/components/MobileBottomNav.test.jsx
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/ab/Desktop/Riven/Riven && git add client/src/components/MobileBottomNav.jsx client/src/components/MobileBottomNav.test.jsx && git commit -m "feat: morph MobileBottomNav into study mode with spring animation"
```

---

## Task 4: Wire study mode from Layout to MobileBottomNav

**Files:**
- Modify: `client/src/components/Layout.jsx` (find the MobileBottomNav render at line ~401)

### Background
Layout reads `studyMode` from UIContext and passes it down to `MobileBottomNav`. This is the only change to Layout.

- [ ] **Step 1: Read the current UIContext import in Layout.jsx**

Check whether Layout already imports `UIContext`:

```bash
grep -n "UIContext\|useContext" /Users/ab/Desktop/Riven/Riven/client/src/components/Layout.jsx | head -10
```

- [ ] **Step 2: Add studyMode to Layout's UIContext destructure**

Find the line in `Layout.jsx` where UIContext values are destructured (search for `hideBottomNav`). Add `studyMode` to that destructure:

```js
// Before (example):
const { hideBottomNav, showBottomNav, /* ... */ } = useContext(UIContext);

// After:
const { hideBottomNav, showBottomNav, /* ... */, studyMode } = useContext(UIContext);
```

- [ ] **Step 3: Pass studyMode to MobileBottomNav**

Find the `<MobileBottomNav` JSX (around line 401) and add the `studyMode` prop:

```jsx
// Before:
<MobileBottomNav
    primaryNavItems={primaryNavItems}
    onFabPress={() => setCreateSheetOpen(true)}
/>

// After:
<MobileBottomNav
    primaryNavItems={primaryNavItems}
    onFabPress={() => setCreateSheetOpen(true)}
    studyMode={studyMode}
/>
```

- [ ] **Step 4: Run existing Layout tests to confirm no regressions**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run client/src/components/Layout.test.jsx
```

Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/ab/Desktop/Riven/Riven && git add client/src/components/Layout.jsx && git commit -m "feat: pass studyMode from UIContext to MobileBottomNav via Layout"
```

---

## Task 5: Simplify the entry screen in GuideView

**Files:**
- Modify: `client/src/pages/GuideView.jsx`

### Background
Replace `renderSessionEntry()` with a smart-default layout: one `RECOMMENDED` CTA + dismissible first-run hint card + collapsed "Other options" expander. Keep all existing session-start handlers (`startFullSession`, `startWeakSession`, `startQuickSession`, `startQuizMode`) — just change what's visible by default.

The `RIVEN_GUIDE_ONBOARDED` localStorage key tracks whether the hint card has been dismissed.

- [ ] **Step 1: Add hint-card state near the top of GuideView**

Find the block of `useState` calls in `GuideView.jsx` (around line 260). Add:

```js
const [showOnboardingHint, setShowOnboardingHint] = useState(
    () => !localStorage.getItem('riven_guide_onboarded')
);
const [showOtherOptions, setShowOtherOptions] = useState(false);
```

- [ ] **Step 2: Add the `recommendedSession` memo**

Find where `weakSections` is memoized (search for `getWeakSections`). Add directly below it:

```js
const recommendedSession = useMemo(
    () => getRecommendedSession(normalizedGuideData, normalizedStudyState),
    [normalizedGuideData, normalizedStudyState]
);
```

Make sure `getRecommendedSession` is imported at the top of the file alongside the other `studyGuides` imports.

- [ ] **Step 3: Replace `renderSessionEntry` with the simplified version**

Find `const renderSessionEntry = () => (` and replace the entire function body (from the opening `(` to the matching closing `)`) with:

```jsx
const renderSessionEntry = () => (
    <div data-testid="session-entry" className="flex flex-col gap-4">
        <div data-testid="entry-hero-card" className="guide-hero rounded-[2rem] p-5 sm:p-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                            Botanical Observatory
                        </p>
                        <h1 className="mt-3 font-display text-[2.2rem] font-bold italic leading-[0.94] text-claude-text sm:text-[2.8rem]">
                            {title}
                        </h1>
                        <p className="mt-2 text-sm text-claude-secondary">
                            {normalizedStudyState.last_reviewed_at
                                ? `Last studied ${formatLastReviewed(normalizedStudyState.last_reviewed_at)} · ${progress.completionPercent}% complete`
                                : 'Not started yet'}
                        </p>
                    </div>
                </div>

                {/* First-run hint card — only shown once */}
                <AnimatePresence>
                    {showOnboardingHint && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-start gap-3 rounded-[1.4rem] border border-[rgba(147,197,253,0.18)] bg-[#1a1f2e] p-4">
                                <span className="text-base mt-0.5">💡</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-[#93c5fd]">
                                        How this works
                                    </p>
                                    <p className="mt-1.5 text-sm leading-6 text-claude-secondary">
                                        Recall each topic from memory, then reveal the answer and rate your confidence. Riven tracks what to review next.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Dismiss hint"
                                    onClick={() => {
                                        setShowOnboardingHint(false);
                                        localStorage.setItem('riven_guide_onboarded', 'true');
                                    }}
                                    className="shrink-0 text-[#93c5fd]/40 hover:text-[#93c5fd]/70 transition-colors text-sm"
                                >
                                    ✕
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Recommended CTA */}
                <button
                    type="button"
                    data-testid="recommended-cta"
                    onClick={() => {
                        if (recommendedSession.type === 'weak') startWeakSession();
                        else if (recommendedSession.type === 'continue') startStudySession(recommendedSession.sections);
                        else startFullSession();
                    }}
                    className="guide-tone-success guide-focus-ring rounded-[1.6rem] p-5 text-left transition-transform duration-200 hover:-translate-y-0.5"
                >
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#86efac]">
                        Recommended for you
                    </p>
                    <p className="mt-2 font-display text-[1.6rem] font-bold italic leading-none text-claude-text">
                        {recommendedSession.label}
                    </p>
                    <p className="mt-2 text-sm text-claude-secondary">{recommendedSession.detail}</p>
                    <div className="mt-4 flex items-center justify-center rounded-[1rem] bg-[#22c55e] py-3">
                        <span className="text-[13px] font-bold text-black">Start Session →</span>
                    </div>
                </button>

                {/* Other options expander */}
                <button
                    type="button"
                    onClick={() => setShowOtherOptions((v) => !v)}
                    className="text-center text-[12px] text-claude-secondary/60 hover:text-claude-secondary transition-colors"
                >
                    {showOtherOptions ? 'Hide options ↑' : 'Other options: Full session · Quiz me · Custom ›'}
                </button>

                <AnimatePresence>
                    {showOtherOptions && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            className="overflow-hidden"
                        >
                            <div className="flex flex-col gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={startFullSession}
                                    className="guide-shell guide-focus-ring rounded-[1.4rem] p-4 text-left hover:-translate-y-0.5 transition-transform duration-200"
                                >
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">Full Session</p>
                                    <p className="mt-1 text-sm text-claude-secondary">{sessionLabel} · All sections</p>
                                </button>

                                <div className="guide-shell rounded-[1.4rem] p-4">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">Quick Session</p>
                                    <div className="mt-3 flex gap-2">
                                        {[5, 10, 20].map((mins) => (
                                            <button
                                                key={mins}
                                                type="button"
                                                onClick={() => startQuickSession(mins)}
                                                className="guide-cta guide-cta--secondary guide-focus-ring flex-1"
                                            >
                                                {mins} min
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {allQuizQuestions.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={startQuizMode}
                                        className="guide-shell guide-focus-ring rounded-[1.4rem] p-4 text-left hover:-translate-y-0.5 transition-transform duration-200"
                                    >
                                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">Quiz Me</p>
                                        <p className="mt-1 text-sm text-claude-secondary">Rapid-fire · {allQuizQuestions.length} prompts</p>
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Compact weak-section pills (max 2) */}
                {weakSections.length > 0 && (
                    <div className="flex gap-2">
                        {weakSections.slice(0, 2).map((s) => (
                            <div key={s.id} className="guide-tone-danger flex-1 rounded-[0.9rem] px-3 py-2 text-[11px] font-medium text-[#fca5a5]">
                                🔴 {s.title}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
);
```

Also ensure `AnimatePresence` is imported from `motion/react` at the top of the file (check existing imports first — it may already be there).

- [ ] **Step 4: Run the app and manually verify the entry screen**

```bash
cd /Users/ab/Desktop/Riven/Riven && npm run dev
```

Open a v2 guide on mobile viewport. Verify:
- Recommended CTA appears prominently
- "Other options ›" expands inline to reveal Full / Quick / Quiz cards
- Hint card appears, can be dismissed, does not reappear after reload

- [ ] **Step 5: Run existing GuideView tests**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run client/src/pages/GuideView.test.jsx
```

Expected: All existing tests PASS (the `session-entry` and `recommended-cta` test IDs should still be present)

- [ ] **Step 6: Commit**

```bash
cd /Users/ab/Desktop/Riven/Riven && git add client/src/pages/GuideView.jsx && git commit -m "feat: simplify study guide entry screen with smart default CTA and first-run hint"
```

---

## Task 6: Wire GuideView to UIContext study mode + remove old bottom bar

**Files:**
- Modify: `client/src/pages/GuideView.jsx`

### Background
When `sessionMode` becomes `'studying'`, `GuideView` calls `setStudyMode(actions)` on UIContext — this triggers the dock morph in `MobileBottomNav`. When the session ends, it calls `clearStudyMode()`. The old `showWorkbookBottomBar` div is removed (replaced by the dock).

- [ ] **Step 1: Import UIContext in GuideView**

Find existing imports near the top of `GuideView.jsx`. Add:

```js
import { useContext } from 'react';
// (useContext may already be imported — check first)
import { UIContext } from '../context/UIContext.jsx';
```

- [ ] **Step 2: Destructure setStudyMode and clearStudyMode**

Inside the `GuideView` function body, near where other hooks are called, add:

```js
const { setStudyMode, clearStudyMode } = useContext(UIContext);
```

- [ ] **Step 3: Sync study mode to UIContext when sessionMode changes**

Find the existing `useEffect` calls (or add one) to sync `sessionMode` to UIContext. Add this effect after the existing effects:

```js
useEffect(() => {
    if (sessionMode === 'studying') {
        setStudyMode({
            currentIndex: sessionIndex,
            totalSections: sessionSections.length,
            onSections: () => setShowMobileSections(true),
            onDetails: () => setShowMobileMoreDetails(true),
            onNote: () => setShowMobileNoteEditor(true),
            onPrev: canGoPrevious ? handlePreviousSection : undefined,
            onNext: canGoNext ? handleNextSection : undefined,
            canPrev: canGoPrevious,
            canNext: canGoNext,
        });
    } else {
        clearStudyMode();
    }
}, [
    sessionMode, sessionIndex, sessionSections.length,
    canGoPrevious, canGoNext,
    setStudyMode, clearStudyMode,
    handlePreviousSection, handleNextSection,
]);

// Also clear on unmount
useEffect(() => () => clearStudyMode(), [clearStudyMode]);
```

- [ ] **Step 4: Remove the old mobile bottom bar**

Find and delete this block (around line 2015):

```jsx
{showWorkbookBottomBar ? (
    <div data-testid="mobile-bottom-bar" className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
        <div className="mobile-bottom-nav-shell rounded-[1.75rem]">
            <div className="mobile-bottom-nav-shell__clip rounded-[inherit] px-4 py-3">
                <div className="grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => setShowMobileSections(true)}
                        className="guide-cta guide-cta--ghost guide-focus-ring w-full"
                    >
                        <span>Sections</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowMobileMoreDetails(true)}
                        disabled={!hasDisplayDetails}
                        className="guide-cta guide-cta--ghost guide-focus-ring w-full disabled:opacity-35"
                    >
                        <span>Details</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowMobileNoteEditor(true)}
                        className="guide-cta guide-cta--ghost guide-focus-ring w-full"
                    >
                        <span>Notes</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
) : null}
```

Also delete the `showWorkbookBottomBar` variable declaration above it:
```js
const showWorkbookBottomBar = isMobileLayout && sessionMode === 'studying';
```

And update the outer container's `pb-` class that referenced `showWorkbookBottomBar`:
```jsx
// Before:
className={`relative min-h-screen safe-area-bottom ${showWorkbookBottomBar ? 'pb-[calc(env(safe-area-inset-bottom,0px)+8.5rem)]' : 'pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]'}`}

// After:
className="relative min-h-screen safe-area-bottom pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]"
```

- [ ] **Step 5: Run all GuideView tests**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run client/src/pages/GuideView.test.jsx
```

Expected: All tests PASS. (Any test asserting `mobile-bottom-bar` testId will need to be removed — search for it and delete those assertions.)

- [ ] **Step 6: Manual smoke test on mobile viewport**

Open a v2 guide → tap "Start Session" → verify the dock morphs green with Sections/Details/Note → tap Sections → sheet opens → tap ✕ Exit → dock returns to default.

- [ ] **Step 7: Commit**

```bash
cd /Users/ab/Desktop/Riven/Riven && git add client/src/pages/GuideView.jsx && git commit -m "feat: wire GuideView session state to UIContext dock, remove old mobile bottom bar"
```

---

## Task 7: Add post-session summary screen

**Files:**
- Modify: `client/src/pages/GuideView.jsx`

### Background
After `handleSectionComplete` exhausts all session sections, instead of going to `'dashboard'`, we go to a new `'post-session'` mode. The screen shows session stats from `getSessionDelta`, a motivational CTA, and a link to the full dashboard.

- [ ] **Step 1: Snapshot study state at session start**

In the `startStudySession` callback, snapshot the study state before the session begins:

```js
// Find startStudySession (around line 858) and add:
const sessionStartStateRef = useRef(null);

const startStudySession = useCallback((sectionList) => {
    if (!sectionList.length) return;
    sessionStartStateRef.current = normalizedStudyState; // snapshot before session
    setSessionSections(sectionList);
    setSessionIndex(0);
    setSessionMode('studying');
    handleSelectSection(sectionList[0].id);
}, [handleSelectSection, normalizedStudyState]);
```

- [ ] **Step 2: Change session completion destination**

Find `handleSectionComplete` (around line 885). Change `setSessionMode('dashboard')` to `setSessionMode('post-session')`:

```js
// Before:
if (sessionIndex + 1 >= sessionSections.length) {
    setSessionMode('dashboard');
}

// After:
if (sessionIndex + 1 >= sessionSections.length) {
    setSessionMode('post-session');
}
```

Also change `handleQuizComplete`:
```js
// Before:
const handleQuizComplete = useCallback(() => {
    setSessionMode('dashboard');
}, []);

// After:
const handleQuizComplete = useCallback(() => {
    setSessionMode('post-session');
}, []);
```

- [ ] **Step 3: Add `renderPostSession` function**

Add this function just before `renderSessionEntry`:

```jsx
const renderPostSession = () => {
    const delta = getSessionDelta(
        normalizedGuideData,
        sessionStartStateRef.current,
        normalizedStudyState
    );
    const stillWeak = getWeakSections(normalizedGuideData, normalizedStudyState);

    return (
        <div data-testid="post-session" className="flex flex-col gap-4">
            <div className="guide-hero rounded-[2rem] p-5 sm:p-6">
                <div className="flex flex-col items-center gap-4 text-center">
                    <span className="text-4xl">🎉</span>
                    <div>
                        <h2 className="font-display text-[1.8rem] font-bold italic leading-none text-claude-text">
                            Session Complete
                        </h2>
                        <p className="mt-2 text-sm text-claude-secondary">
                            {delta.sectionsReviewed} section{delta.sectionsReviewed !== 1 ? 's' : ''} reviewed
                        </p>
                    </div>

                    {/* Stats row */}
                    <div className="grid w-full grid-cols-3 gap-3">
                        {[
                            { label: 'Mastery', value: `${progress.completionPercent}%`, accent: true },
                            { label: 'Still Weak', value: stillWeak.length },
                            { label: 'This Session', value: delta.masteryDeltaPercent > 0 ? `+${delta.masteryDeltaPercent}%` : '—' },
                        ].map(({ label, value, accent }) => (
                            <div key={label} className="guide-shell rounded-[1.3rem] py-3">
                                <p className={`text-[1.3rem] font-bold ${accent ? 'text-[#86efac]' : 'text-claude-text'}`}>
                                    {value}
                                </p>
                                <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.1em] text-claude-secondary">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Primary CTA */}
                    <div className="guide-tone-success w-full rounded-[1.4rem] p-4">
                        <p className="font-semibold text-claude-text">
                            {stillWeak.length > 0 ? 'Keep Going — Weak Sections Remain' : 'Study Again Tomorrow'}
                        </p>
                        <p className="mt-1 text-sm text-claude-secondary">
                            {stillWeak.length > 0
                                ? `${stillWeak.length} section${stillWeak.length !== 1 ? 's' : ''} still need review`
                                : 'Riven will remind you when sections are due'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Secondary actions */}
            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={() => setSessionMode('entry')}
                    className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                >
                    Back to Guide
                </button>
                <button
                    type="button"
                    onClick={() => setSessionMode('dashboard')}
                    className="text-center text-[12px] text-claude-secondary/60 hover:text-claude-secondary transition-colors py-2"
                >
                    View full progress dashboard ›
                </button>
            </div>
        </div>
    );
};
```

Ensure `getSessionDelta` is imported at the top alongside the other `studyGuides` imports.

- [ ] **Step 4: Add post-session mode to the render switch**

Find the render switch block (around line 1779):

```jsx
{sessionMode === 'entry' && renderSessionEntry()}
{sessionMode === 'studying' && renderStudying()}
{sessionMode === 'quiz' && renderQuiz()}
{sessionMode === 'dashboard' && renderDashboard()}
```

Add `post-session` to both the mobile and desktop blocks:

```jsx
{sessionMode === 'entry' && renderSessionEntry()}
{sessionMode === 'studying' && renderStudying()}
{sessionMode === 'quiz' && renderQuiz()}
{sessionMode === 'post-session' && renderPostSession()}
{sessionMode === 'dashboard' && renderDashboard()}
```

(There are two identical blocks — update both.)

- [ ] **Step 5: Run GuideView tests**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run client/src/pages/GuideView.test.jsx
```

Expected: All tests PASS

- [ ] **Step 6: Manual end-to-end test**

Start a quick session on mobile → complete all sections → verify "Session Complete" screen appears → stats show correct numbers → tap "View full progress dashboard ›" → navigates to existing dashboard → tap "Back to Guide" → returns to entry.

- [ ] **Step 7: Commit**

```bash
cd /Users/ab/Desktop/Riven/Riven && git add client/src/pages/GuideView.jsx && git commit -m "feat: add post-session summary screen with mastery delta and weak count"
```

---

## Task 8: Full regression run and cleanup

**Files:** None new — verification only.

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/ab/Desktop/Riven/Riven && npx vitest run
```

Expected: All tests PASS. Fix any failures before continuing.

- [ ] **Step 2: Verify desktop layout has no regressions**

Open a v2 guide in a desktop viewport (> 768px). Verify:
- Sticky rail still shows on the left
- Entry screen shows new simplified layout
- Studying mode works end-to-end
- Post-session screen appears after completing all sections
- `MobileBottomNav` is hidden on desktop (it has `md:hidden` class)

- [ ] **Step 3: Verify first-run hint behavior**

Open an incognito/private window (fresh localStorage). Open a v2 guide → hint card appears → dismiss it → reload the page → hint card does not reappear.

- [ ] **Step 4: Final commit**

```bash
cd /Users/ab/Desktop/Riven/Riven && git add -A && git commit -m "chore: study guide UX simplification — final cleanup pass"
```
