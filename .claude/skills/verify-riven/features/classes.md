# Classes

Students keep a roster of classes, with name, color, professor, room or Zoom link, and subject, at `/classes`. Each class has its own page at `/class/:id` holding its decks, notes and assignments. Classes can be created manually, generated with AI, or imported from Canvas, and they can be archived at the end of a semester.

## Sub-features

- `class-list` the roster lists the user's classes, newest first.
- `class-create-manual` the Add class form creates a class from typed fields.
- `class-create-ai` the AI creation method (unverified: needs an edge-function stub).
- `class-create-canvas` the Canvas/LMS import (unverified: goes through the Express LMS route and the iCal fetch).
- `class-edit` edits an existing class (unverified).
- `class-end-semester` archives classes through `End semester` (unverified).
- `class-view` the class detail page at `/class/:id` (unverified).

## How to get to it (user POV)

- Sidebar `Classes`, then the `+` button (`aria-label="Add class"`).
- The dashboard's assignment and focus-class cards link to `/class/:id`.
- The command palette has a `Classes` entry.

## Driving it with verify-riven

Preconditions:

- Default seed (classes 21 `Biology`, 22 `Calculus`).

- **List.** `page.goto('/classes')`. `Biology` is visible.
- **Open form.** Click `getByRole('button', { name: 'Add class' })`. The placeholder `e.g. CS 101` is visible. The method defaults to `Manual`.
- **Fill.** Fill `e.g. CS 101` with `Organic Chemistry` and `Dr. Smith` with `Dr. Okafor`, then click `Create Class`. The form closes and the toast `Class created` appears.
- **Listed.** `Organic Chemistry` is visible in the roster.
- **Side effect.** `writes` holds a `classes` insert matching `{ user_id: 7, name: 'Organic Chemistry', professor: 'Dr. Okafor' }`.
- Run it: `node .claude/skills/verify-riven/scripts/journeys/create-class.mjs`.

## Gotchas

- Typing a name auto-infers `subject` unless the user picked one, so the inserted row may carry a subject you didn't type.
- `user_id` comes from `GET /api/auth/me` (the legacy Express bridge), which the harness answers with the seed user. If that stub is removed, the insert fails with "Failed to resolve the current user".
- `/class/:id` for an id not in `seed.tables.classes` redirects back to `/classes`.
