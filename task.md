# Riven UX Improvement Tasks

## Goal
Improve Riven's usability by fixing information architecture, reducing flow friction, and closing accessibility gaps in the highest-traffic screens.

## Tasks
- [ ] Split the logged-out home from the logged-in dashboard.
  Files: `client/src/routes/config.jsx`, `client/src/pages/Home.jsx`
  Verify: logged-out users see a clear onboarding/value page with sign-up and sign-in CTAs; logged-in users still land on the study dashboard.

- [ ] Rework primary navigation so core features are not hidden behind the FAB or buried in profile.
  Files: `client/src/components/Layout.jsx`, `client/src/components/auth/ProfileView.jsx`
  Verify: users can reach study, library, social, and settings destinations in one obvious tap from the main shell.

- [ ] Make deck library state URL-driven.
  Files: `client/src/pages/Decks.jsx`
  Verify: search, filter, and sort persist in the URL; refresh/back/forward preserve state; filtered views are deep-linkable.

- [ ] Replace full-screen library overlays with lighter-weight browse controls.
  Files: `client/src/pages/Decks.jsx`
  Verify: search/filter/sort feel faster to use repeatedly on mobile, and active scope is always visible without reopening drawers.

- [ ] Turn Home into a command center with a strong "resume study" path.
  Files: `client/src/pages/Home.jsx`
  Verify: the first screen shows due-now work, a continue-studying CTA, and direct entry into study mode instead of only deck-detail links.

- [ ] Simplify deck detail actions into a clearer primary/secondary hierarchy.
  Files: `client/src/pages/DeckView.jsx`
  Verify: only 1-2 primary actions are immediately visible; export, duplicate, share, and destructive actions move into a labeled overflow menu or sheet.

- [ ] Make message actions mobile-native instead of hover-dependent.
  Files: `client/src/pages/Messages.jsx`
  Verify: edit, delete, and report actions are discoverable on touch devices via an explicit menu or long-press action sheet.

- [ ] Replace browser `confirm` flows with in-app confirmation UI.
  Files: `client/src/pages/Messages.jsx`, `client/src/pages/AdminPanel.jsx`, `client/src/components/CardImageUpload.jsx`
  Verify: destructive actions and error states use consistent in-product modals/toasts instead of browser dialogs.

- [ ] Reduce monetization friction inside study sessions.
  Files: `client/src/pages/StudyMode.jsx`, `client/src/components/ui/OutOfHeartsModal.jsx`, `client/src/components/ui/PricingModal.jsx`
  Verify: upsell/ad prompts no longer interrupt the core recall loop at the moment of failure; monetization appears at lower-friction points.

- [ ] Add accessibility labels to icon-only controls.
  Files: `client/src/pages/DeckView.jsx`, `client/src/pages/StudyMode.jsx`, `client/src/components/auth/LoginForm.jsx`, `client/src/components/auth/SignupForm.jsx`, `client/src/components/ui/PricingModal.jsx`
  Verify: all icon-only buttons have `aria-label`; screen-reader output is unambiguous.

- [ ] Replace modal-style auth validation with inline field errors.
  Files: `client/src/components/auth/LoginForm.jsx`, `client/src/components/auth/SignupForm.jsx`
  Verify: invalid fields show inline guidance, the first errored field receives focus, and auth flows can be corrected without dismissing an alert modal.

- [ ] Remove mobile-hostile autofocus behavior from library search.
  Files: `client/src/pages/Decks.jsx`
  Verify: opening search on mobile does not immediately force the keyboard unless the user explicitly focuses the field.

## Done When
- [ ] Logged-out users understand Riven within the first screen.
- [ ] Core destinations are easy to discover from the main navigation.
- [ ] Study can be resumed in one tap from Home.
- [ ] Deck browsing state survives navigation and refresh.
- [ ] Social and deck actions work cleanly on touch devices.
- [ ] Core flows meet basic accessibility expectations for labels, focus, and validation.

## Reference
- Vercel Web Interface Guidelines: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
