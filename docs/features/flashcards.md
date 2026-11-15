# Flashcards

Decks of cards studied with FSRS spaced repetition. Decks come from manual entry, AI
generation (notes / file / YouTube), or sharing.

## How to reach it (user)

- Create: `/create` → **Generate from Notes** → deck name + pasted notes or file →
  **Generate Flashcards** (cards stream in) → lands on `/deck/:id`.
- Study: deck page → Study (`/deck/:id/study`) → toggle **Recall ON** for graded
  spaced repetition → Space to flip → **Forgot / Hard / Easy** (keys 1-3).

## What runs

- `generate-deck` (streaming SSE): quota check (`consumeAiQuota`, 10/month free),
  OpenAI, `parseAiJsonResponse`, `decks` + `cards` insert, `ai_generations_count + 1`.
  The client fires `x-warmup` pings to generate-deck/guide/exam on the create pages.
- Grading writes FSRS fields on `cards` (`ts-fsrs`, client side). Leaving study mode
  through the app (unmount) writes `study_sessions` and stamps `decks.last_studied`;
  `hearts` is called while studying.

## Drive it

```bash
node scripts/verify/riven-verify.mjs run flashcards
```

Asserts: 5 cards stream in and are saved, one OpenAI call, quota count 1; all 5 cards
graded **Easy** have `reps > 0`; one `study_sessions` row after **Back to Deck**.

## Gotchas

- A hard reload (`page.goto`) does not save the session; leave through **Back to Deck**.
- Grade buttons are Forgot / Hard / Easy (no "Good").
- Desktop says "Recall ON"; below `xl` it says "Spaced Repetition ON".
