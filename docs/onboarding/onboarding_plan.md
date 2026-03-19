# Riven onboarding plan (5 screens, post-auth)

Product goal: **fresh install → first study action in &lt;2 minutes**, feeling like “starting the product,” not a tour.

## Screen flow

| Step | Intent (one decision) | Primary CTA | Skip |
|------|----------------------|-------------|------|
| 1 | Orient: “You’re in—here’s what Riven does for you” | Continue | Skip to dashboard |
| 2 | Study context: how do you mainly ingest material? | One tap (lectures / readings / both) | Skip |
| 3 | **Audio → notes** (primary hook) | Open note with mic | Skip |
| 4 | **Syllabus / materials** differentiator | Open create with AI / file focus | Skip |
| 5 | First study moment | Go to decks / study | Finish |

## Rules

- One headline + one primary action per step.
- Skip always lands on a coherent next step (`/dashboard`) without broken state.
- Syllabus is an accelerator, not a hard gate.
- Mobile-first layout; desktop uses split column where helpful.

## Success metric (default)

**First study action** (instrumented): user opens **flashcard study** or **test** OR completes **note enhancement from audio**—configurable in analytics. Primary narrative remains audio → notes.
