# Riven verification map

The maintained source for verifying Riven's user-facing web behavior. Read this index, then use the feature file as the recipe. Harness details live in `../SKILL.md`.

## Baseline preconditions

- `.claude/skills/verify-riven/scripts/launch.sh` has printed `ready: http://127.0.0.1:4174`.
- `.claude/skills/verify-riven/scripts/doctor.sh` exits 0 (fresh fixture build, our pid, our port).
- Each journey starts from the default seed in `scripts/seed.mjs`. User 7 `atlas` is signed in and onboarded. Classes `Biology` (21) and `Calculus` (22) exist. Deck `Cell Biology` (31) holds 3 cards.
- Never drive an instance that `launch.sh` did not start.

## Driving conventions

- Every run starts a fresh browser context and a fresh in-memory DB, so a journey never inherits another's mutations.
- Use roles, accessible names, placeholders and `data-*` handles. Add `.filter({ visible: true }).first()` where mobile and desktop copies of a control coexist.
- Desktop is 1440×900. The mobile layout (390×844) is a separate entry point with different labels.
- Wait for app state (counters, phase labels, `data-dashboard-ready`), never fixed sleeps.

## Proof and skip reporting

- Report the evidence folder `client/test-results/verify-riven/<stamp>-<journey>/`.
- A mutation proof needs both the visible result and the matching entry in `writes.json`.
- Check `summary.json` → `unstubbed`. A feature that touches an unstubbed endpoint has only partial proof, and you must say so.
- If an entry point is listed below with no journey, it is **unverified**. Do not count it as verified because a different entry point passed.
- The fake Supabase does not run RLS, SQL or edge-function code. Say so when a change touches them.

## Feature entry contract

Each feature file has an H1, a one-paragraph description, then `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-riven`, `Gotchas`.

## Features

| Feature | Journey | Status |
|---|---|---|
| [Dashboard (Home)](./dashboard.md) | `journeys/dashboard.mjs` | desktop entry verified |
| [Classes](./classes.md) | `journeys/create-class.mjs` | manual create verified; AI/Canvas create, edit, archive unverified |
| [Deck cards](./deck-cards.md) | `journeys/add-card.mjs` | add card verified; edit, delete, bulk import unverified |
| [Flashcard study](./study-flashcards.md) | `journeys/study-deck.mjs` | desktop recall grading verified; free review, mobile swipe unverified |
