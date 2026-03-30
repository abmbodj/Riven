# Riven Improvement Specs — Mentor Feedback (March 2026)

## Context

These improvement specs were generated from a mentorship session reviewing Riven's current state. The feedback covers UI/UX polish, missing features, and growth opportunities ahead of the alpha trial with CS students.

**Alpha timeline:** 2-3 weeks (targeting CS students + friends)
**Fall semester:** broader rollout target
**Collaboration:** Connect with Javan (NorthPlan app creator)
**Capstone:** Consider as capstone project foundation

---

## Priority Matrix

| # | Doc | Type | Alpha-Critical | Effort | Sprint |
|---|-----|------|:-:|---|---|
| 01 | [Settings Redesign](./01-settings-redesign.md) | UX Polish | Yes | M | 1 |
| 02 | [Navigation Overhaul](./02-navigation-overhaul.md) | UX Refactor | No | L | 2 |
| 03 | [Mobile Experience](./03-mobile-experience.md) | UX Polish | Yes | M | 1 |
| 04 | [Calendar Integration](./04-calendar-integration.md) | New Feature | No | XL | 2 |
| 05 | [Dashboard Analytics](./05-dashboard-analytics.md) | UX Refactor | No | M | 2 |
| 06 | [Social & Gamification](./06-social-gamification.md) | New Feature | No | XL | 3 |
| 07 | [Skills Tracking](./07-skills-tracking.md) | New Feature | No | XL | Fall |
| 08 | [Theme/Dark Mode Fixes](./08-theme-dark-mode-fixes.md) | Bug Fix | Yes | S | 1 |
| 09 | [Integrations](./09-integrations.md) | New Feature | No | L | 3 |
| 10 | [Archive & Rewards](./10-archive-rewards.md) | New Feature | No | M | 3 |

**Effort key:** S = 1-2 days, M = 3-5 days, L = 1-2 weeks, XL = 2-4 weeks

---

## Sprint Plan

### Sprint 1 — Alpha Blockers (before CS trial)
- `01` Settings Redesign — clutter fix, high visibility page
- `03` Mobile Experience — CS students are on phones
- `08` Theme/Dark Mode Fixes — trust-breaking bugs

### Sprint 2 — High-Value Features (during alpha)
- `02` Navigation Overhaul — affects every page
- `05` Dashboard Analytics — mentor explicitly requested
- `04` Calendar Integration — Canvas LMS already integrated

### Sprint 3 — Growth Features (post-alpha)
- `06` Social & Gamification — engagement loops
- `10` Archive & Rewards — retention and motivation
- `09` Integrations — PowerPoint easy; Discord is larger

### Separate Track — Strategic (Fall Semester)
- `07` Skills Tracking — LinkedIn/resume angle, capstone narrative

---

## Design Constraints (All Work)

These constraints apply to every improvement spec:

- **Theme system:** Use CSS custom properties via `ThemeContext` — never hardcode colors
- **Colors:** `bg-claude-*`, `text-claude-*`, `border-claude-*` Tailwind aliases
- **Icons:** Lucide React only — no emoji as UI icons
- **Animation:** Motion/React (`motion/react`) for transitions, GSAP for complex scroll/path animations
- **Timing:** 150-300ms for micro-interactions, spring physics for modals/sheets
- **Touch targets:** 44x44px minimum (`touch-target` class)
- **Breakpoints:** Mobile-first — 375px base, then `sm:` 640, `md:` 768, `lg:` 1024, `xl:` 1440
- **Reduced motion:** All animations must respect `prefers-reduced-motion`
- **Safe areas:** Use `env(safe-area-inset-*)` for iOS notch/home indicator
- **Typography:** `font-display` (Instrument Serif), `font-sans` (Space Grotesk), `font-mono` (JetBrains Mono)
- **Contrast:** Minimum 4.5:1 for body text, 3:1 for secondary text (WCAG AA)
- **Skeleton screens:** Use `animate-pulse` skeletons, not spinners, for content loading
