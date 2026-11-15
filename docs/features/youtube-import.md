# YouTube import

Paste a YouTube link and generate any of Notes, Flashcards, Tutor Session or Mock Exam
from the video's transcript.

## How to reach it (user)

`/youtube` (Create sheet → YouTube, or the command palette) → paste URL → pick outputs →
optional title / linked class → **Generate N item(s)** → open each result.

## What runs

- One `create-ai-job` per output plus a shared `youtube_source` job; each kicks
  `run-ai-job` (fire-and-forget fetch, `EdgeRuntime.waitUntil`).
- `youtube_source`: transcript via `_shared/youtubeTranscript.ts` (innertube player →
  `youtube-caption-extractor` → transcriptapi.com fallback), cached in
  `youtube_transcripts`, condensed into a source brief.
- `youtube_notes` / `youtube_deck` / `youtube_guide` / `youtube_exam` then build the
  outputs from the brief.
- The page subscribes to each `ai_jobs` row over **Supabase Realtime** (no poll), so
  Realtime must be running.

## Drive it

```bash
node scripts/verify/riven-verify.mjs run youtube-import
```

Picks Notes + Flashcards. The two scraping strategies get 404s from the fake and the
transcript comes from the transcriptapi fake. Asserts both jobs `completed`, one
`source_type = 'youtube'` note, one new deck with cards, no failed jobs.

## Gotchas

- Option buttons toggle; the journey reads `aria-pressed` before clicking.
- A `source_ingest` job is queued for the new note (RAG); it runs only via pg_cron.
