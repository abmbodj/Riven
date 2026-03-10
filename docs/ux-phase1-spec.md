# Riven UX Phase 1 Spec

## Objective
Make Riven feel like one workspace across desktop and mobile by aligning navigation, prioritizing productive actions on the dashboard, and reducing mobile onboarding friction.

## Product Thesis
Riven is not just a flashcard app. It is a student workspace built around four recurring jobs:

1. `Today`
2. `Study`
3. `Plan`
4. `Social`

Phase 1 should make these jobs visible and reachable from anywhere.

## Phase 1 Scope

### In Scope
- Shared primary information architecture for desktop and mobile
- New primary nav labels and route grouping
- Dashboard rewrite toward "resume work now"
- Better visibility of social and planning actions
- Non-blocking mobile install prompt

### Out of Scope
- Full redesign of deck, class, message, and settings internals
- Desktop split-preview or list-detail experiments for decks and classes
- New backend endpoints
- Full command palette implementation
- Settings/LMS refactor beyond obvious shell-level issues

## Navigation Model

### Primary Destinations
- `Today`
  - Routes: `/dashboard`, `/`
- `Study`
  - Routes: `/decks`, `/deck/:id`, `/deck/:id/study`, `/deck/:id/test`, `/create`
- `Plan`
  - Routes: `/classes`, `/class/:id`
- `Social`
  - Routes: `/messages`, `/messages/:userId`, `/friends`, `/groups`, `/groups/:id`, `/groups/:groupId/cram/:sessionId`

### Secondary Destinations
- `Garden`
- `Themes`
- `Settings`
- `Account`

These should remain accessible, but not compete with the four primary jobs.

## Shell Rules
- Desktop sidebar and mobile bottom nav must expose the same primary destinations
- `Create` remains a center-emphasis action on mobile and a strong CTA on desktop
- Active state should be computed by route groups, not exact route identity alone
- Study and test routes may hide broader navigation for focus, but the route grouping should still be conceptually consistent

## Dashboard Rules
- Top section must answer "what should I do next?"
- Order of importance:
  1. Resume study / create deck
  2. Due today / this week / overdue
  3. Class workload snapshot
  4. Recent decks and social entry points
  5. Delight/status elements like garden streak
- The garden remains a signature brand element, but not the primary decision driver above the fold

## Mobile Rules
- First-time mobile experience should not be blocked by install instructions
- Install prompt should appear as a lightweight bottom sheet/card near the bottom of the shell
- It must be dismissible, respect standalone mode, and defer details behind a secondary action

## Visual Direction
- Preserve the current botanical-journal identity
- Use the dark shell as the frame and parchment-style cards as work surfaces
- Reduce visual mode-switching between sections by reusing:
  - consistent section headers
  - consistent CTA treatment
  - consistent active nav affordances

## Phase 1 Implementation Plan

### Step 1
Refactor `Layout.jsx` to use grouped nav destinations for both desktop and mobile.

### Step 2
Refactor `Home.jsx` dashboard hero and quick actions around `Today`, `Study`, `Plan`, and `Social`.

### Step 3
Reduce the install prompt in `MobileWarning.jsx` from a blocking overlay to a non-blocking bottom-sheet pattern.

### Step 4
Add targeted tests around shell nav labels and dashboard action visibility.

## Success Criteria
- Desktop and mobile primary navigation expose the same product jobs
- Dashboard above-the-fold better supports immediate action
- Mobile first-run no longer gets blocked by install instructions
- Existing visual identity remains intact
