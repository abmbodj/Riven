# Findings & Decisions

## Requirements
- Produce a concrete UX spec for Riven
- Improve the app so desktop and mobile flow together
- Make the product feel more productive and coherent, not just more polished
- Implement phase 1 directly in the current codebase

## Research Findings
- The current shell uses one desktop model and a different mobile model: desktop sidebar includes quick links, while mobile uses a FAB overlay for some destinations and hides others behind non-primary affordances
- Current primary mobile nav is `Home`, `Classes`, `Create`, `Decks`, `Account`, while groups, garden, and themes are secondary quick links in the FAB or sidebar
- The dashboard already contains useful work objects like assignments, recent decks, and classes, but the hero still leads with greeting/garden status over task resumption
- The mobile install prompt is currently modal and blocking on first mobile visit, which interrupts first-value acquisition
- Settings contains at least one broken productivity path: `api.syncCanvas(adGranted)` references an undefined local, which suggests LMS sync UX is unstable
- The job-based nav labels can be implemented without route changes by grouping existing paths behind shared primary destinations
- The dashboard can be made more directive without rewriting lower sections by only refactoring the hero and primary action band
- A bottom-sheet install prompt preserves the PWA nudge while removing first-run interruption

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use a shared primary IA of `Today`, `Study`, `Plan`, `Social`, plus `Create` | This unifies desktop and mobile mental models while still fitting the product's main jobs |
| Map routes into destination groups rather than one-route-per-tab logic | Riven spans many related subroutes; grouping reduces nav drift |
| Reframe dashboard quick actions around task resumption | Productivity improves when the home screen answers "what do I do next?" immediately |
| Replace blocking mobile install prompt with a dismissible bottom-sheet style prompt | Mobile onboarding should be supportive, not interruptive |
| Keep social anchored to `/messages` while matching friends/groups/profile routes | It creates a stable top-level destination without restructuring social internals |
| Move account/settings out of primary nav into utility access | They are important but not part of the main daily workflow loop |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Settings page appears to reference undefined state for LMS sync | Capture as follow-up and avoid broad Settings refactor in phase 1 unless needed |
| Initial Vitest command returned no test files because the filters were rooted incorrectly | Re-ran with `src/...` paths from the `client` directory |

## Resources
- `/Users/ab/Desktop/Riven/Riven/client/src/components/Layout.jsx`
- `/Users/ab/Desktop/Riven/Riven/client/src/routes/config.jsx`
- `/Users/ab/Desktop/Riven/Riven/client/src/pages/Home.jsx`
- `/Users/ab/Desktop/Riven/Riven/client/src/pages/CreateDeck.jsx`
- `/Users/ab/Desktop/Riven/Riven/client/src/pages/StudyMode.jsx`
- `/Users/ab/Desktop/Riven/Riven/client/src/components/MobileWarning.jsx`
- `/Users/ab/Desktop/Riven/Riven/client/src/pages/Settings.jsx`
- `/Users/ab/Desktop/Riven/Riven/docs/ux-phase1-spec.md`

## Visual/Browser Findings
- Riven already has a distinctive shell: dark botanical frame plus paper/herbarium cards
- The visual system is memorable, but the product structure still feels like several adjacent tools rather than one integrated workspace
- The dashboard's current first impression is atmospheric and pleasant, but not as directive as a productivity app should be
- The new phase-1 target preserves the existing botanical brand while making the first actions more operational

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
