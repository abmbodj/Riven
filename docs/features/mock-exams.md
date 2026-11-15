# Mock exams

AI practice exams (MCQ, true/false, multi-select, numeric, short answer) from a note,
tutor session or file, taken as a timed simulation or in practice mode, with topic
breakdown and a study path afterwards.

## How to reach it (user)

`/exams` → sparkles button (top right, no text label) → title, source **Note / Guide /
File**, optional blueprint → **Generate Exam** → `/exam/:id` → **Exam Simulation** or
**Practice** → answer → **Submit** → results.

## What runs

- `generate-exam` → OpenAI exam prompt (`_shared/aiCore.mjs`) → `normalizeExamQuestions`
  (`_shared/examQuestions.mjs`) → `mock_exams` row (`source_type` is `notes` for notes).
- Submit → `exam_attempts` insert → `exam-complete` (XP, stats). Short answers are graded
  by `grade-answer` (AI) in practice mode.
- Blueprints: `extract-exam-blueprint` → `exam_blueprints`.

## Drive it

```bash
node scripts/verify/riven-verify.mjs run mock-exam
```

Generates from **Lecture 5: Cellular respiration**, starts a simulation, answers Q1,
submits early. Asserts 6 normalized questions stored, one OpenAI call, results page
("Topic Breakdown") and an `exam_attempts` row.

## Gotchas

- The generate button is icon-only; the journey selects `button:has(svg.lucide-sparkles)`.
  It has no accessible name (see the audit).
- Score is weighted by `marks`, so 1 of 6 correct shows 9%.
