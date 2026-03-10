# Remaining UX Checklist

## Goal
Finish the highest-value UX gaps so Riven feels like one coherent student workspace across `Home`, `Study`, `Plan`, and `Social`.

## Tasks
- [ ] Upgrade `TestMode` into a real assessment workspace with clearer session framing, stronger answer hierarchy, and better completion states. → Verify: focused `TestMode` tests pass and desktop/mobile layouts remain usable.
- [ ] Revisit `Home` above-the-fold so it answers "what should I do next?" without repeating the reverted dashboard experiment. → Verify: first viewport surfaces resume, due work, and social/planning entry points in a stable order.
- [ ] Tighten `CreateDeck` into a shorter setup path with less branching and clearer source/class linking. → Verify: core deck creation can be completed with fewer decisions and mobile pickers remain smooth.
- [ ] Polish `Messages` thread workflow with better action density, search/refinement, and clearer composer states. → Verify: desktop messaging flow supports triage and reply without unnecessary scanning.
- [ ] Run a cross-app consistency sweep on headers, empty states, CTA hierarchy, helper copy, and side-rail/workbench patterns. → Verify: the main pages share the same section rhythm and action hierarchy.
- [ ] Review performance-sensitive UX debt, especially the large client chunks and any slow-feeling route transitions. → Verify: bundle warnings are reduced or explicitly deferred with a documented follow-up.

## Done When
- [ ] `Study`, `Test`, `Deck`, `Class`, `Messages`, and `Settings` all feel like parts of the same product system.
- [ ] The next three highest-frequency flows are clear on both desktop and mobile.
- [ ] Remaining UX work is limited to refinement, not structural confusion.
