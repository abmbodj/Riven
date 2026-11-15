# Audio to notes

Record a lecture inside a note. Riven streams a live transcript while recording,
uploads the audio in chunks, and on **Enhance** turns the recording (plus anything the
student typed) into structured study notes.

## How to reach it (user)

- Sidebar **Create note** (or `/note/new`) → **Record lecture** (mic button) → speak →
  **Stop recording** → banner **Enhance**.
- Also: Notes library → open a note → **Record lecture**. iOS uses the native voice
  recorder plugin; tab/system audio is offered where `getDisplayMedia` exists.

## What runs

1. `transcription-token` → short-lived Deepgram token (Deepgram `/v1/auth/grant`).
2. Browser opens `wss://api.deepgram.com/v1/listen` and streams MediaRecorder audio;
   `Results` messages become transcript segments
   (`client/src/services/deepgramLive.js`, `context/RecordingSessionContext.jsx`).
3. Rows: `recording_sessions` (state machine `preflight → recording → stopped → …`),
   `recording_chunks` + Storage bucket `recording-chunks`, `transcript_segments`.
4. **Enhance** → `create-ai-job` (`note_enhancement`) → `run-ai-job` →
   `_shared/aiJobProcessors.ts`: durable Deepgram batch transcription with a callback to
   `deepgram-transcription-callback`, then note drafting/enrichment (OpenAI, Tiptap JSON),
   knowledge-layer extraction, write to `notes.content`.
5. The editor follows the job through Realtime on `ai_jobs` plus a 3 s poll.
6. pg_cron `audio-note-ai-retry-minute` re-dispatches due jobs via `retry-ai-jobs`.

## Drive it

```bash
node scripts/verify/riven-verify.mjs run audio-to-notes
```

Chromium runs with a fake microphone; the harness answers the Deepgram WebSocket with
five transcript sentences (`lib/harness.mjs`). Edge functions see the project URL as
`https://supabase.riven.local` so the callback URL is https like production; the fake
Deepgram posts the batch transcript back to it.

Asserts: live transcript text visible; session `stopped` with chunks in Storage and
transcript segments saved; `note_enhancement` job `completed`; enhanced document in the
editor and in `notes.content`.

## Gotchas

- The note id appears in the URL only after recording starts.
- `recording_sessions.state` flips to `stopped` a moment after the Stop click; poll.
- Known issue: the enhancement rail sometimes stays at "Preparing timestamped class
  transcript" after the job completed (see `docs/health-audit.md`). The journey fails
  when it happens; `--retry 1` reports it as flaky.
