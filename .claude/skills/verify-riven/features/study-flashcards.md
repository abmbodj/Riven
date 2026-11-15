# Flashcard study

Study mode at `/deck/:id/study` steps through a deck one card at a time. In free review the student flips and browses. With recall grading (spaced repetition) on, each revealed card is graded `Forgot`, `Hard` or `Easy`, and FSRS reschedules it. Finishing shows a session summary, and leaving the page saves the session and bumps the streak.

## Sub-features

- `study-flip` Space, a tap or `Flip` reveals the answer.
- `study-recall-grade` Forgot/Hard/Easy (keys 1/2/3) writes the FSRS fields to `cards`.
- `study-complete` the `Session complete` panel shows `correct/studied`.
- `study-save-on-exit` leaving inserts `study_sessions` and stamps `decks.last_studied`.
- `study-hearts` free users spend a heart on `Forgot` (hearts edge function, unverified).
- `study-free-review` browse without grading (unverified).
- `study-mobile-swipe` swipe left/right to grade on touch (unverified).
- `study-resume` resume a persisted session (unverified).

## How to get to it (user POV)

- Deck page, then `Study`.
- The dashboard's focus-deck card links straight to `/deck/:id/study`.

## Driving it with verify-riven

Preconditions:

- Default seed: deck 31 with 3 cards, all in `card_state: 'new'`, and 5 hearts.

- **Open.** `page.goto('/deck/31/study')`. `1 / 3` and the first question are visible.
- **Recall on.** Click the visible `Recall OFF` button (`Spaced Repetition OFF` on mobile). It then reads `Recall ON`.
- **Per card.** Wait for `N / 3` and `Reveal prompt`, then press `Space`. Wait for `Grade recall` and the answer text, then click the visible `Easy`.
- **Complete.** `Session complete` and `3/3 correct` are visible.
- **Exit.** Click `Back to Deck`. The URL ends in `/deck/31`.
- **Side effects.** `writes` holds 3 `cards` updates matching `{ card_state: 'review', reps: 1, next_review: <ISO> }`, 1 `study_sessions` insert matching `{ deck_id: 31, cards_studied: 3, cards_correct: 3 }`, and 1 `decks` update with `last_studied`.
- Run it: `node .claude/skills/verify-riven/scripts/journeys/study-deck.mjs`.

## Gotchas

- Flips during a card transition are ignored. Always wait for the counter and `Reveal prompt` before pressing Space.
- The answer text is in the DOM before the flip, so assert `Grade recall` to prove the card actually turned.
- `study_sessions` is written on unmount, not on `Session complete`. Navigate away before asserting it.
- The hearts status call goes to the `hearts` edge function. The seed answers it, so `Forgot` decrements `state.hearts`.
