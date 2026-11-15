# AI tutor (River tutor sessions)

A River-led lecture built from the student's material: an agenda, per-concept teaching
on a chalkboard, recall questions graded by AI, and an "Ask River" chat grounded in the
student's sources (RAG).

## How to reach it (user)

`/guides` → **Create tutor session** (+) → **From notes / Upload file / Topic only** →
**Continue** → tone & focus (optional) → **Generate session** → `/guide/:id` →
**Start with River** → lecture beats → **Skip to question** / answer → **Submit Answer**.
Ask questions any time in the **Ask River** box.

## What runs

- `generate-guide` two-phase pipeline (`_shared/aiCore.mjs`): skeleton (one call) →
  teaching per card (parallel, 30 s timeout each) → quality check → repair call for weak
  cards → `study_guides` (`guide_data` JSON, `content` Tiptap summary).
- `tutor-chat`: embeds the question (Gemini), retrieves `source_chunks`
  (`match_source_chunks`), answers with citations or refuses. Needs `GEMINI_API_KEY`.
- `grade-tutor-answer`: AI grading into correct / partial / incorrect / misconception;
  `study_guides.study_state` saved; `study-session-complete` on progress.

## Drive it

```bash
node scripts/verify/riven-verify.mjs run ai-tutor
```

Asserts: guide with 2 cards; exactly 1 skeleton call and 2 teaching calls; lecture
opening rendered; chat answer shown (embedding + chat calls made); answer graded with the
AI feedback text; `study_state` saved.

## Gotchas

- The canned teaching fixture triggers the quality repair call and "soft issues" warnings
  in `edge.log`; that is expected with the fake.
- The seeded note has no `source_chunks` (its ingest job is deleted at seed), so chat
  runs with empty retrieval.
