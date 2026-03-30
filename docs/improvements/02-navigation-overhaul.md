# Navigation Overhaul

> **Status:** Planned | **Priority:** High | **Effort:** L (1-2 weeks) | **Alpha-Critical:** No

## Summary

The current navigation splits between a fixed 256px desktop sidebar and a mobile bottom pill nav with a FAB overlay grid. The mentor recommends unifying these with a combined top bar + collapsible sidebar on desktop, and a hidden drawer with arrow/swipe toggle on mobile to prevent "giant scrolling blocks." The utility links (Garden, Themes, Account, Settings) are currently buried in the FAB grid on mobile — they need more direct access.

## Current State Audit

### Desktop Sidebar (`client/src/components/Layout.jsx`)
- Fixed left, 256px wide, visible `lg:` and above
- Primary nav: Today, Study, [FAB slot], Classes, Groups
- Utility section: Garden (accent), Themes (accent), Account, Settings
- "Create Deck" CTA at bottom
- Active state: 2px left accent bar + `bg-white/[0.09]`
- Hidden on: unauthenticated pages, fullscreen study/test modes

### Mobile Bottom Nav (`client/src/components/MobileBottomNav.jsx`)
- Fixed bottom pill bar, `rounded-[1.75rem]`, 68px height, hidden `lg:`+
- 5 slots: Today, Study, FAB (+), Classes, Groups
- FAB opens overlay: Search (hero row) + 2x2 grid (Garden, Themes, Settings, Profile)
- Active pill: `layoutId="mobile-nav-pill"` shared-element spring animation

### Problems
- Utility links require 2 taps on mobile (open FAB -> tap item)
- No top bar exists — page titles are handled per-page, inconsistently
- Desktop sidebar is always 256px — wastes space on medium screens
- No breadcrumb or location indicator beyond nav highlight

## Proposed Design

### Desktop (lg+): Collapsible Sidebar + Subtle Top Bar

```
┌─────────────────────────────────────────────────┐
│ [=] Riven          Page Title         [bell] [A] │  <- Top bar (48px)
├──────┬──────────────────────────────────────────┤
│      │                                          │
│  Nav │         Page Content                     │
│ Rail │                                          │
│      │                                          │
│ [T]  │                                          │
│ [S]  │                                          │
│ [C]  │                                          │
│ [G]  │                                          │
│ ---  │                                          │
│ [g]  │                                          │
│ [t]  │                                          │
│ [a]  │                                          │
│ [s]  │                                          │
│      │                                          │
│ [+]  │                                          │
└──────┴──────────────────────────────────────────┘
```

**Sidebar:**
- Expanded: 220px with labels (default)
- Collapsed: 64px icon-only with native `title` attribute tooltips
- Toggle: `[=]` hamburger in top bar OR `ChevronLeft` at bottom of rail
- State: `localStorage.getItem('riven:nav-collapsed')`, also add to `UIContext`
- Collapse animation: `width` 250ms ease-out via `transition-[width]`

**Top Bar (48px):**
- Left: sidebar toggle button + "Riven" logo (collapsed) or just toggle (expanded)
- Center: page title from route metadata (font-display, text-sm, tracking-wide)
- Right: notification bell (link to existing `UserNotificationsRail`) + avatar (link to `/account`)
- Background: `bg-claude-surface/80 backdrop-blur-sm border-b border-claude-border/30`
- Sticky: `sticky top-0 z-30`

### Mobile (< lg): Bottom Nav + Left Edge Drawer

**Bottom nav stays** — the mentor confirmed it works well. Changes:

1. **Replace FAB grid with left-edge drawer** for utility items
2. **FAB becomes "Create" only** — single action, opens `/create`
3. **Search moves to top bar** — thin 40px top bar with search icon + page title

**Mobile Drawer:**
- Slides from left edge, 280px wide
- Trigger: hamburger icon top-left OR swipe from left edge (20px hit zone)
- Content: Garden, Themes, Account, Settings, Friends, Messages
- Backdrop: `bg-black/50 backdrop-blur-sm`
- Animation: `translateX(-100% -> 0)` 300ms spring (stiffness 280, damping 26)
- Close: tap backdrop, swipe left, or tap X

**Mobile Top Bar (40px):**
- Left: hamburger `Menu` icon (opens drawer)
- Center: page title (`font-display text-sm`)
- Right: search `Search` icon (opens `GlobalCommandPalette`)
- Background: `bg-claude-surface/80 backdrop-blur-sm`
- Safe area: `pt-[env(safe-area-inset-top)]`

### Breakpoint Behavior

| Breakpoint | Sidebar | Top Bar | Bottom Nav | Drawer |
|---|---|---|---|---|
| 375px | Hidden | 40px mobile | Yes (5 items) | Left-edge |
| 768px | Hidden | 40px mobile | Yes (5 items) | Left-edge |
| 1024px (lg) | 64px collapsed | 48px desktop | Hidden | Hidden |
| 1440px (xl) | 220px expanded | 48px desktop | Hidden | Hidden |

## State Management

```jsx
// UIContext additions
const [navCollapsed, setNavCollapsed] = useState(
  () => localStorage.getItem('riven:nav-collapsed') === 'true'
);
const [drawerOpen, setDrawerOpen] = useState(false);

const toggleNav = () => {
  setNavCollapsed(prev => {
    localStorage.setItem('riven:nav-collapsed', String(!prev));
    return !prev;
  });
};
```

## Animation Spec

| Element | Animation | Duration | Easing |
|---|---|---|---|
| Sidebar collapse | `width` 220px <-> 64px | 250ms | ease-out |
| Sidebar labels | `opacity` 1 <-> 0 | 150ms | ease-out |
| Mobile drawer open | `translateX` -100% -> 0 | 300ms | spring(280, 26) |
| Drawer backdrop | `opacity` 0 -> 1 | 200ms | ease-out |
| Top bar mount | `opacity` 0 -> 1, `y` -8 -> 0 | 200ms | ease-out |
| Reduced motion | All become instant | 0ms | — |

## Files to Modify

| File | Change |
|------|--------|
| `client/src/components/Layout.jsx` | Add top bar, refactor sidebar to collapsible rail, integrate drawer |
| `client/src/components/MobileBottomNav.jsx` | Remove FAB grid, FAB becomes direct `/create` link |
| `client/src/context/UIContext.jsx` | Add `navCollapsed`, `drawerOpen`, `toggleNav`, `toggleDrawer` |
| `client/src/components/MobileDrawer.jsx` | **New file** — left-edge drawer component |

## Acceptance Criteria

- [ ] Desktop (lg+): sidebar collapses to 64px icon rail, expands to 220px with labels
- [ ] Desktop: 48px top bar shows page title, notification bell, avatar
- [ ] Mobile: 40px top bar with hamburger (drawer), title, search icon
- [ ] Mobile: left-edge drawer opens with utility nav items
- [ ] Mobile: FAB button navigates directly to `/create`
- [ ] Sidebar collapse state persists in localStorage
- [ ] All nav items have `cursor-pointer` and visible hover/active states
- [ ] Keyboard: Tab navigates sidebar items, Escape closes drawer
- [ ] Screen reader: sidebar nav has `role="navigation" aria-label="Main"`
- [ ] Drawer has focus trap when open
- [ ] `prefers-reduced-motion` disables all transition animations
- [ ] No horizontal scroll at any breakpoint
- [ ] Content offset adjusts for sidebar width changes (`ml-[64px]` vs `ml-[220px]`)

## Phased Rollout

- **Alpha:** Add mobile top bar with search shortcut only (keep FAB as-is)
- **v1.0:** Full collapsible sidebar + drawer implementation
- **v1.1:** Swipe-from-edge gesture for drawer
