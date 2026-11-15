# Deck cards

A deck page at `/deck/:id` shows a deck's title, description, tags and cards. Students can add, edit, delete, reorder and bulk-import cards, start studying, or take a test.

## Sub-features

- `deck-view` the deck renders with its cards in `position` order.
- `card-add` the Add Card modal inserts a card at the next position.
- `card-edit` inline edit with `Save Edits` (unverified).
- `card-delete` swipe or delete removes a card (unverified).
- `card-bulk-import` the `Import` button parses pasted cards (unverified).
- `deck-share` sharing a deck with friends (unverified: needs friends data).

## How to get to it (user POV)

- Dashboard recent decks, the Study library (`/decks/library`), or a class page link to `/deck/:id`.
- On the deck page, the `+ Add` toolbar button opens Add Card.

## Driving it with verify-riven

Preconditions:

- Default seed (deck 31 with cards 501–503 at positions 0–2).

- **View.** `page.goto('/deck/31')`. `What is the powerhouse of the cell?` is visible.
- **Open modal.** Click `getByRole('button', { name: /^Add$/ }).filter({ visible: true }).first()`. The placeholder `Question or term` is visible.
- **Fill.** Fill `Question or term` and `Answer or definition`, then click `Add Card`. The modal closes.
- **Listed.** The new question text is visible in the deck.
- **Side effect.** `writes` holds a `cards` insert matching `{ deck_id: 31, position: 3 }`.
- Run it: `node .claude/skills/verify-riven/scripts/journeys/add-card.mjs`.

## Gotchas

- The `Add` label is hidden below the `sm` breakpoint. On mobile the button only has a `+` icon, so select it by position or add an aria-label.
- `addCard` reads existing positions first. A seed whose cards lack `position` inserts at 0.
- Card content validation rejects empty front and back before any request is sent.
