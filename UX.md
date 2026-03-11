# Riven UX Fix Backlog

Based on the current product surfaces in `client/src` and the `ui-ux-pro-max` skill.

## Direction

- [ ] Keep the botanical, reflective brand language on the landing and auth surfaces, but shift the logged-in product toward a clearer, calmer student dashboard model.
- [ ] Treat accessibility as a release gate: visible focus states, 44x44 minimum touch targets, clear disabled states, informative loading states, and reduced-motion fallbacks.
- [ ] Reduce ornamental density where it slows scanning; keep delight, remove friction.

## P0 Shared Shell and Navigation

- [ ] Increase primary nav label size and reduce extreme uppercase tracking in [client/src/components/Layout.jsx](/Users/ab/Desktop/Riven/Riven/client/src/components/Layout.jsx).
- [ ] Add clearer route context in the desktop sidebar so users know where they are inside `Deck`, `Class`, `Group`, and `Message` subflows.
- [ ] Make the mobile bottom nav feel less cramped by increasing icon-label spacing and active-state clarity.
- [ ] Keep the center FAB, but stop making search a hidden secondary action on mobile; expose search as a first-class action.
- [ ] Add a page-level header pattern for non-home routes so every screen has a visible title, purpose, and primary action.
- [ ] Standardize safe-area behavior so sticky bars, banners, and bottom navigation never crowd content on mobile.
- [ ] Make the offline banner dismissible or collapsible after initial visibility so it does not permanently consume vertical space.
- [ ] Replace tiny utility labels in the sidebar with readable sizes that still preserve the visual style.
- [ ] Add clearer visual grouping between primary navigation, utility links, and create actions.
- [ ] Ensure every interactive control in the shell has an obvious hover, pressed, focus, and disabled state.
- [ ] Audit every shell tap target against the 44x44 minimum from the skill guidance.

## P0 Landing and First-Run UX

- [ ] Rework the public landing in [client/src/components/ui/GardenLanding.jsx](/Users/ab/Desktop/Riven/Riven/client/src/components/ui/GardenLanding.jsx) so the value proposition appears immediately, not after users visually parse the animated scene.
- [ ] Add a concrete hero CTA pair such as `Start studying free` and `See how it works`.
- [ ] Add real product screenshots or structured UI previews so visitors can understand the app before signing up.
- [ ] Add trust elements: student outcomes, testimonials, usage numbers, or campus credibility.
- [ ] Add a concise "How Riven works" section that connects decks, classes, AI generation, and streaks into one mental model.
- [ ] Add pricing clarity on the public journey so users understand hearts, free limits, and paid upgrades before they hit a wall.
- [ ] Keep the botanical hero art as atmosphere, but lower its cognitive load and motion weight on first paint.
- [ ] Add a full reduced-motion variant for the animated landing background and parallax layers.
- [ ] Add a sticky or repeated CTA further down the page so users do not need to scroll back to act.

## P0 Auth Flow

- [ ] Simplify auth copy in [client/src/components/auth/LoginForm.jsx](/Users/ab/Desktop/Riven/Riven/client/src/components/auth/LoginForm.jsx) and [client/src/components/auth/SignupForm.jsx](/Users/ab/Desktop/Riven/Riven/client/src/components/auth/SignupForm.jsx) so the product sounds confident, not cryptic.
- [ ] Add inline validation instead of relying on alert modals for common mistakes such as missing fields and weak passwords.
- [ ] Surface password requirements before submission, not only after failure.
- [ ] Add helper text for username and email expectations to reduce trial-and-error.
- [ ] Improve password visibility toggle affordance with larger hit area and explicit accessible labeling.
- [ ] Make the primary auth CTA labels more explicit than `Enter`.
- [ ] Add state continuity between login, signup, forgot password, and 2FA so users always know where they are in the flow.
- [ ] Add a clearer success path after signup, including what happens next with verification and profile setup.
- [ ] Reduce the amount of decorative space on mobile auth screens so the form stays dominant above the fold.
- [ ] Review contrast and input borders on the auth forms to ensure inactive, hover, focus, and error states are visually distinct.

## P1 Dashboard Home

- [ ] Revisit the `Today Queue` hero in [client/src/pages/Home.jsx](/Users/ab/Desktop/Riven/Riven/client/src/pages/Home.jsx) so the top card communicates one clear priority, one primary next action, and one fallback action.
- [ ] Make the hero summary easier to scan by reducing line length and emphasizing the deadline or next study action.
- [ ] Replace tiny metadata chips with larger, more readable status blocks on mobile.
- [ ] Improve the top stats so each card answers a real user question instead of only showing raw counts.
- [ ] Clarify what `This Week` means and consider naming it after the underlying content, such as `Due this week`.
- [ ] Make the garden streak panel more actionable by showing why it matters and what action preserves it.
- [ ] Turn `Focus Actions` into a more opinionated quick-action row that reflects actual user intent, not just feature entry points.
- [ ] Add section-level empty states that explain why a section is empty and what to do next.
- [ ] Add a compact daily overview for users with no assignments but active decks, so the page still feels useful.
- [ ] Use fewer 8px-10px all-caps labels across dashboard cards; this is the main readability issue on the current home screen.
- [ ] Tighten the visual system so deck cards, assignment cards, class cards, and queue chips feel like one family instead of adjacent experiments.

## P1 Deck Library

- [ ] Reduce the specimen-card ornamentation in [client/src/pages/Decks.jsx](/Users/ab/Desktop/Riven/Riven/client/src/pages/Decks.jsx) so users can scan many decks quickly.
- [ ] Add a compact list view for users managing large numbers of decks.
- [ ] Keep search, sort, and filters visible or sticky while browsing long deck lists.
- [ ] Add a visible `Clear filters` action whenever folder, tag, or search filters are active.
- [ ] Show more useful deck metadata such as last studied date, due count, mastery, or class context.
- [ ] Make empty states specific to each filter condition instead of showing generic emptiness.
- [ ] Improve folder and tag management so create, edit, and delete flows feel like part of the deck system, not detached utilities.
- [ ] Add stronger visual distinction between browse mode and deck-management mode.
- [ ] Make deck onboarding less decorative and more task-oriented for first-time users with zero decks.

## P1 Create Deck

- [ ] Convert [client/src/pages/CreateDeck.jsx](/Users/ab/Desktop/Riven/Riven/client/src/pages/CreateDeck.jsx) into a clearer multi-step flow: type, source, metadata, confirm.
- [ ] Rename `Quick Deck` and `Generate from Notes` if needed so mode choice is obvious without reading helper copy.
- [ ] Add persistent helper text showing what each mode produces and how long it usually takes.
- [ ] Surface AI limits before the user starts entering content so the pricing boundary is predictable.
- [ ] Add inline validation for missing title, empty notes, unsupported files, and oversized files.
- [ ] Make folder, class, and tag assignment feel lighter and faster, especially on mobile.
- [ ] Add a sticky bottom action bar on mobile so submit is always reachable.
- [ ] Add progress feedback during AI generation that explains the current step instead of only showing a loading state.
- [ ] Add success confirmation context before redirecting so users know what was created.

## P1 Study Mode

- [ ] Simplify the control hierarchy in [client/src/pages/StudyMode.jsx](/Users/ab/Desktop/Riven/Riven/client/src/pages/StudyMode.jsx) so the card is always the main focal point.
- [ ] Make progress, elapsed time, accuracy, and remaining cards visible without crowding the top bar.
- [ ] Add a clear session-resume banner when a stored session is detected so the user chooses to resume or restart.
- [ ] Improve the flip interaction so it is obvious on first use and never relies on gesture knowledge alone.
- [ ] Ensure swipe actions have visible button equivalents and labels for accessibility.
- [ ] Add stronger completion UX at the end of a session: summary, streak impact, hearts impact, and the next recommended action.
- [ ] Make shuffle and spaced repetition mode states easier to understand at a glance.
- [ ] Add confirmation before abandoning an in-progress study session if meaningful progress has been made.
- [ ] Reduce animation intensity during flip and progress transitions when reduced motion is enabled.

## P1 Classes and Planning

- [ ] Apply the same readability cleanup from the dashboard to class and assignment views, especially for due-date chips and status controls.
- [ ] Make assignment status changes feel more deliberate with clearer current-state and next-state feedback.
- [ ] Add stronger weekly planning affordances so users can go from `what is due` to `what should I do next`.
- [ ] Improve overdue presentation so urgency is visible without making the whole interface feel alarming.
- [ ] Add better empty states for classes with no assignments, no linked decks, or no upcoming work.

## P2 Social, Groups, and Messaging

- [ ] Make the difference between friends, messages, and study groups clearer in navigation and entry points.
- [ ] Add stronger conversation previews and unread hierarchy in messages.
- [ ] Add task-oriented empty states for groups, such as `share a deck`, `start a cram session`, or `invite members`.
- [ ] Reduce the amount of visual style variation across social surfaces so they still feel like Riven, not a separate app.

## P2 Visual System and Content Design

- [ ] Define a stricter typography scale so body copy, helper text, labels, and metadata are consistent across the app.
- [ ] Reduce overuse of very small uppercase mono labels, especially where plain-language body text would improve comprehension.
- [ ] Consolidate card treatments into a small number of surface types: hero, data card, collection card, modal, and utility card.
- [ ] Define a shared spacing scale for dense dashboard sections versus immersive brand sections.
- [ ] Use texture and glass effects more selectively so they support hierarchy instead of flattening it.
- [ ] Audit color contrast across muted secondary text, decorative chips, and translucent surfaces.
- [ ] Standardize icon sizing and icon-to-label alignment across navigation, cards, and buttons.

## P2 Feedback, States, and Trust

- [ ] Replace modal-heavy error handling with inline guidance where the user can fix the problem immediately.
- [ ] Standardize loading skeletons, optimistic updates, and retry states across primary pages.
- [ ] Make rate limits, hearts depletion, and premium upgrade prompts contextual and anticipatory instead of reactive.
- [ ] Add friendlier but more specific empty states across decks, classes, groups, messages, and dashboard sections.
- [ ] Audit toast usage so short confirmations stay lightweight and destructive or blocking events use stronger treatment.

## P2 Accessibility and Mobile Quality

- [ ] Review all icon-only buttons for explicit accessible names.
- [ ] Ensure `outline-none` is never used without a visible replacement focus style.
- [ ] Increase spacing between adjacent mobile actions to satisfy touch-spacing guidance from the skill.
- [ ] Audit forms for appropriate `inputmode`, `autocomplete`, and keyboard behavior on mobile.
- [ ] Verify that sticky elements do not trap content behind safe areas or bottom navigation.
- [ ] Check that scroll regions, bottom sheets, and overlays are keyboard navigable and screen-reader coherent.

## Suggested Rollout Order

- [ ] Phase 1: Shell, landing, auth, and dashboard readability.
- [ ] Phase 2: Deck library, create deck, and study mode task flows.
- [ ] Phase 3: Classes, social, groups, pricing, and cross-app visual consolidation.
- [ ] Phase 4: Full accessibility audit, motion audit, and mobile polish pass.
