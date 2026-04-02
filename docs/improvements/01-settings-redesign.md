# Settings Page Redesign

> **Status:** Done | **Priority:** High | **Alpha-Critical:** Yes | **Effort:** M (3-5 days)

## Summary

The Settings page (`/settings`) has 6-7 content sections that create excessive vertical scroll on mobile (iPhone SE: ~1800px scroll depth). Border and padding treatment is inconsistent across sections — some card borders touch, others have varied gaps. The mentor recommends restructuring around a collapsible sidebar with icon-only mode when minimized, giving users quick section access without scrolling through everything.

## Current State Audit

**File:** `client/src/pages/Settings.jsx`

### Existing Sections (in order)
1. **Subscription / Membership** — tier display, upgrade CTA, referral code copy
2. **AI Capabilities** — remaining/max usage count, capability list, animated progress bar
3. **Canvas LMS Integration** — iCal URL connect/disconnect, sync button, auto-sync toggle
4. **Notifications** — web push toggle, native iOS push toggles (messages, streak, re-engagement)
5. **Security** — change password modal, 2FA modal (badge if enabled)
6. **Danger Zone** — sign out, delete account modal

### Current Component Architecture
- `SectionHeader` — eyebrow label + serif title + description, tone variants (accent, info, success, warning, danger, pink)
- `SectionCard` — `rounded-[1.5rem]`/`[1.9rem]` bordered card with backdrop-blur + texture overlay
- `SettingItem` — individual row: icon, title, description, toggle, badge, chevron, destructive style
- `QuickJumpButton` — taller card with icon, label, meta text
- `StatusNotice` — inline status banner

### Current Spacing Issues
- Sections use `scroll-mt-32 md:scroll-mt-36` for scroll anchoring but no quick-jump nav exists
- `SectionCard` padding varies: some use `p-0` with items handling their own padding, others nest additional padding
- Inter-section gap: inconsistent — some use parent `gap-6`, others have manual `mt-` values
- Border: `SettingItem` uses absolute-positioned bottom border (`inset-x-4 bottom-0 h-px bg-claude-border/60`), but last items in some sections still show it

## Problems Identified

1. **Scroll depth on mobile** — 6 sections at ~250-350px each = ~1800px total scroll on iPhone SE (667px viewport). Users must scroll 2.7x the viewport to see Danger Zone
2. **Inconsistent card boundaries** — Subscription section cards touch edges, while LMS section has inner padding
3. **No section navigation** — `SECTION_ANCHOR_CLASS` exists but nothing links to anchors
4. **Desktop wastes space** — `xl:max-w-7xl` is wider than needed; content is a single narrow column

## Proposed Design

### Layout: Section Sidebar + Content Panel

**Desktop (lg+):**
```
┌──────────┬──────────────────────────────────┐
│ Section  │                                  │
│ Sidebar  │   Active Section Content         │
│          │                                  │
│ [icon] Membership    │   (Full section card rendered    │
│ [icon] AI            │    based on active selection)    │
│ [icon] LMS           │                                  │
│ [icon] Notifications │                                  │
│ [icon] Security      │                                  │
│ [icon] Danger        │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

- Sidebar: 220px expanded, 64px collapsed (icon-only with tooltips)
- Active section: `border-l-2 border-claude-accent` + `bg-claude-accent/[0.06]`
- Toggle: `ChevronLeft`/`ChevronRight` icon at bottom of sidebar rail
- State persisted: `localStorage.getItem('riven:settings-sidebar-expanded')`
- Content panel: single section visible at a time, `AnimatePresence` crossfade between sections

**Tablet (md to lg):**
- Horizontal pill tabs sticky at top (`sticky top-0 z-10`)
- Pills: `rounded-full px-3 py-1.5 text-xs font-mono uppercase tracking-wider`
- Horizontal scroll with `overflow-x-auto scrollbar-hide`
- Content below: single section at a time

**Mobile (< md):**
- Same horizontal pill tabs, sticky below header
- Single section view with AnimatePresence transitions
- No sidebar — too narrow

### Section Icons (Lucide)
| Section | Icon | Import |
|---|---|---|
| Subscription | `CreditCard` | Already imported |
| AI Capabilities | `Sparkles` | Already imported |
| Canvas LMS | `Network` | Already imported |
| Notifications | `Bell` | Already imported |
| Security | `Shield` | Already imported |
| Danger Zone | `Trash2` | Already imported |

### Uniform Padding Spec

```
SectionCard:
  outer:  rounded-[1.5rem] border border-claude-border/50
  inner:  p-0 (items handle own padding)

SettingItem:
  padding: px-5 py-4 (mobile), px-5 py-3.5 (xl)
  gap:     gap-3 (mobile), gap-4 (sm+)
  min-h:   72px (mobile), 68px (xl)
  divider: absolute inset-x-5 bottom-0 h-px bg-claude-border/40
  last:    noBorder={true} — no bottom divider on last item

Inter-section gap (if showing multiple sections): gap-6
Section header: pb-3 mb-0 (no extra bottom margin)
```

### Animation Spec

- **Sidebar collapse:** `width` transition 250ms `ease-out`, icons remain centered
- **Section switch:** `AnimatePresence mode="wait"` with `opacity 0→1` + `y: 8→0`, duration 200ms
- **Pill active indicator:** `layoutId="settings-pill"` shared-element spring animation (stiffness 300, damping 26)
- **Reduced motion:** All transitions become instant (`duration: 0`)

### State Management

```jsx
// Inside Settings.jsx
const [activeSection, setActiveSection] = useState('subscription');
const [sidebarExpanded, setSidebarExpanded] = useState(
  () => localStorage.getItem('riven:settings-sidebar-expanded') !== 'false'
);
```

No new context needed — this is page-local state.

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/Settings.jsx` | Refactor to sidebar/tabs + single-section view |
| `client/src/components/Layout.jsx` | Remove `xl:max-w-7xl` override for settings route (no longer needed) |

## Acceptance Criteria

- [ ] Mobile (375px): horizontal pill tabs sticky at top, one section visible at a time
- [ ] Tablet (768px): same pill tabs behavior, wider content area
- [ ] Desktop (1024px+): sidebar with section icons, content panel, collapsible to icon-only
- [ ] All `SettingItem` rows have uniform `px-5 py-4` padding
- [ ] No border inconsistencies — last item in each section has `noBorder`
- [ ] Active section highlighted in sidebar/tabs with accent color
- [ ] Section switch animates with opacity + y translation (200ms)
- [ ] `prefers-reduced-motion` disables all animations
- [ ] Keyboard navigation: Tab through sidebar items, Enter to select
- [ ] Screen reader: sections announced via `aria-label` on sidebar nav
- [ ] Scroll depth on iPhone SE reduced from ~1800px to ~500px (single section)

## Phased Rollout

- **Alpha:** Horizontal pill tabs on all breakpoints (simpler implementation)
- **v1.0:** Full sidebar on desktop with collapse toggle
