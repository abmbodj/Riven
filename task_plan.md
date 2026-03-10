# Task Plan: Riven UX Phase 1

## Goal
Align Riven's desktop and mobile UX around a single navigation and productivity model, document that target state, and implement the first shell/dashboard refactor.

## Current Phase
Phase 5

## Phases

### Phase 1: Discovery & UX Definition
- [x] Review current shell, routes, dashboard, and mobile onboarding behavior
- [x] Identify primary UX drift across desktop and mobile
- [x] Document findings in `findings.md`
- **Status:** complete

### Phase 2: Spec & Test Planning
- [x] Write a concrete phase-1 UX spec tied to the existing codebase
- [x] Define regression tests for nav/dashboard behavior changes
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Refactor primary navigation for consistent desktop/mobile IA
- [x] Refactor dashboard into a clearer productivity hub
- [x] Reduce first-run mobile interruption
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted client tests for changed behavior
- [x] Run client build or equivalent verification
- [x] Fix any regressions found
- **Status:** complete

### Phase 5: Delivery
- [ ] Summarize implemented UX changes
- [ ] Call out remaining phase-2 follow-ups
- [ ] Deliver with verification evidence
- **Status:** in_progress

## Key Questions
1. Which destinations deserve primary navigation on both desktop and mobile?
2. What should the dashboard lead with so it feels productive rather than decorative?
3. Which current mobile interruptions should be deferred instead of shown immediately?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Treat UX phase 1 as a shell + dashboard refactor | This is the highest leverage way to improve flow across the whole product without rewriting every page |
| Keep Riven's visual identity but unify IA first | The core issue is navigational/product structure drift, not lack of aesthetics |
| Document the target UX in-repo before editing | The user asked for a concrete UX spec, and it reduces ad hoc implementation drift |
| Use shared job-based nav labels (`Today`, `Study`, `Plan`, `Social`) | These labels describe user intent better than feature silos and can map cleanly across desktop and mobile |
| Keep create as a center-emphasis mobile utility menu and desktop CTA | This improves production flow without forcing a wider shell rewrite |
| Shift the dashboard top area toward next-action guidance | The home screen should prioritize task resumption over ornamental status |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Incorrect Vitest file filter path | 1 | Re-ran tests with paths relative to `client/` |

## Notes
- Verify behavior with tests/build before claiming phase 1 is complete
- Keep the scope focused on navigation, dashboard prioritization, and mobile interruption reduction
- Repo-wide lint is still noisy due pre-existing client issues and generated iOS artifacts; use targeted lint for phase-1 files
