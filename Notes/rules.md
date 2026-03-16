# AI Lecture Notes Feature Prompt

I want to **expand the notes feature with AI-powered audio capture and note enhancement** so that **students can focus entirely on understanding the lecture instead of frantically writing, while still having the ability to contribute their own thinking and have it intelligently merged with the captured content.**

First, read these files completely before responding:

- `notes-feature.md` — current notes architecture, data models, editor state, and storage layer
- `audio-permissions.md` — existing microphone/audio permission handling patterns in the app
- `design-system.md` — component library, tokens, animation standards, and icon set

-----

## Reference

Here is a reference for **inspiration only** — not a blueprint to clone:

**Granola.ai** (<https://www.granola.ai>) — an AI notepad built for professionals in back-to-back meetings. We are building for **students in lectures**, which is a meaningfully different context (longer sessions, educational structure, personal study output). Use Granola to understand what a great audio-to-notes UX *feels* like, then make deliberate choices that fit our users and product.

**What we borrow from the spirit of Granola:**

- The core idea: listen passively, enhance actively after the session ends
- Keeping the recording UI minimal so it never interrupts the primary activity
- Treating user-typed notes as higher-signal than raw audio

**What we intentionally do differently:**

- Our output is optimized for studying and review (e.g. summary, key concepts, potential exam questions) — not meeting action items or CRM follow-ups
- Our users are students, not executives — the tone, structure, and feature set should reflect that
- We live inside an existing notes product — we extend it, we don’t replace it with a new paradigm
- We do not replicate Granola’s visual design, layout, or branding. Our UI should feel native to our product’s existing design system

**Principles extracted (adapted for our context):**

1. Always keep the recording indicator peripheral — never let it compete with the note-taking area
1. Always treat user-typed notes as higher-signal than the transcript — they express the student’s own understanding
1. Never auto-enhance; always gate it behind a deliberate post-session action
1. Always produce structured, scannable output — headings, bullets, key terms — never a wall of prose
1. Never surface a raw transcript unless the user explicitly requests it
1. Always preserve the student’s original notes alongside the AI-enhanced version
1. Never require any interaction during the session — the whole point is to let them focus on the lecture

-----

## Here’s What I Need for My Version

### SUCCESS BRIEF

**Type of output + length:**  
A fully specced feature prompt and implementation plan for a senior engineer/AI engineer to execute. Covers UI/UX, component design, state machine, API contract, and edge cases. Length: thorough enough that no ambiguity remains.

**Recipient’s reaction:**  
The engineer reads this and immediately knows: what to build, why each decision was made, what the states and transitions are, which existing systems to hook into, and where the hard problems live. They feel confident starting without a meeting.

**Does NOT sound like:**  
Generic AI feature spec. No vague phrases like “leverage AI to enhance.” No over-engineered architecture astronautics. No feature creep beyond the stated scope.

**Success means:**  
The engineer opens a PR that nails the UX on the first review pass, with no “what did you mean by X?” Slack messages.

-----

## Rules

My context standards, constraints, and landmines:

- **DRY**: Do not propose new abstractions for things already handled by the existing notes infrastructure. Hook in; don’t duplicate.
- **KISS**: Microphone button → waveform → session end → AI call → enhanced notes. That’s the whole loop. Do not add steps.
- **YAGNI**: No speaker diarization, no real-time transcription UI, no cloud sync of raw audio, no multi-language support — unless already in scope. Build exactly what is described.
- **Permissions-first**: Audio capture must gracefully handle denied/unavailable microphone states. Never silently fail.
- **Privacy**: Raw audio must never leave the device unless explicit consent is given and it is technically required for the AI call. Prefer on-device transcription (e.g., Web Speech API or Whisper WASM) where feasible.
- **Accessibility**: The waveform is decorative; there must be an accessible text/ARIA label indicating recording state for screen readers.
- **Two modes must be cleanly separated**: (A) Full AI mode — user types nothing, AI generates notes from audio. (B) Enhance mode — user typed notes exist, AI uses audio to expand and improve them. The distinction affects the AI prompt, not the UI.

-----

## Conversation

DO NOT start executing yet. Instead, ask me clarifying questions so we can refine the approach together:

1. What is the target platform — web (browser), native mobile, or both?
1. Is there an existing transcript/speech-to-text pipeline, or do we need to select one (Web Speech API, Whisper, third-party)?
1. Should enhanced notes replace the original notes view, or be shown as a side-by-side / tabbed diff like Granola’s “your notes vs. AI enhanced”?
1. Is there a note session concept (with a defined start/end) already, or do we need to introduce one?

-----

## Plan

Before you write any code or detailed spec, list the **3 rules from the constraints above that matter most for this specific feature** and briefly explain why.

Then give me your **execution plan in 5 steps maximum.**

Only begin the full spec once we’ve aligned on the plan.

-----

## Execution Spec (Post-Alignment)

*To be completed after plan alignment. Structure it as:*

### 1. State Machine

Define all recording states and valid transitions:
`idle → requesting_permission → recording → processing → complete | error`

### 2. Component Design

- `MicButton` — idle / recording / disabled states, accessible label, animation spec
- `WaveformIndicator` — visual design (simple 3–5 bar animated equalizer or smooth sine wave), shown only during `recording` state, purely decorative
- `NoteEnhancementBanner` — post-session prompt: “Your notes are ready to enhance” CTA
- `EnhancedNotesView` — structured output display, with toggle to see original typed notes

### 3. Audio Capture

- Use `MediaRecorder` API (web) or platform equivalent
- Chunk audio into rolling segments for memory efficiency
- On session end: assemble chunks → send to transcription service → receive transcript string

### 4. AI Enhancement API Contract

```
POST /api/notes/enhance
{
  "transcript": string,          // full session transcript
  "user_notes": string | null,   // raw typed notes, null if user typed nothing
  "mode": "generate" | "enhance" // drives system prompt selection
}

Response:
{
  "enhanced_notes": string,      // structured markdown
  "key_topics": string[],        // optional: extracted topics for tagging
  "original_preserved": string   // echo back user_notes for storage
}
```

**System prompt — generate mode:**

> “You are a lecture notes assistant. Given the following transcript of a lecture or talk, produce clean, well-structured notes in markdown. Use headings for major topics, bullets for key points, and bold for critical terms. Be concise. Do not include filler or repeated content.”

**System prompt — enhance mode:**

> “You are a lecture notes assistant. The user took rough notes during a session. You also have the full transcript. Expand and improve the user’s notes using the transcript as context. Preserve the user’s phrasing and structure where it is clear. Fill in gaps, add missing key points, and improve organization. Output structured markdown.”

### 5. Edge Cases & Error Handling

|Scenario                                 |Behavior                                                                          |
|-----------------------------------------|----------------------------------------------------------------------------------|
|Microphone permission denied             |Show inline error with link to browser settings. Button remains in disabled state.|
|User ends session with no audio captured |Skip AI call. Show empty notes state with manual option.                          |
|AI call fails / times out                |Show error banner: “Enhancement failed. Your notes are saved.” Offer retry.       |
|User typed notes AND chose not to enhance|Notes are saved as-is. Enhancement CTA is dismissible.                            |
|Very short session (< 10 seconds)        |Warn user: “Session too short for reliable notes.” Still attempt if audio exists. |
|App closed mid-session                   |Store audio chunks to IndexedDB. Offer to resume or discard on next open.         |

### 6. UI/UX Details (Granola-Inspired)

- **Microphone button**: 36px circle, subtle border, mic icon centered. On hover: slight scale up.
- **Recording state**: Button transforms — icon swaps to waveform animation (3 vertical bars, staggered amplitude CSS animation). Color shifts to a soft active accent (not alarming red).
- **Waveform**: CSS-only, 3–5 bars with `animation: pulse` at varied delays. Height oscillates between 4px–16px. No canvas, no JS audio analysis required — decorative only.
- **Session end**: Tap button again to stop. Brief “Processing…” spinner state. Then: slide-in banner at top of notes area — “✨ AI notes ready — tap to view.”
- **Enhanced view**: Replaces the blank/sparse notes with structured markdown rendered output. A small “View original” link at the bottom surfaces the raw typed notes in a modal or collapsed section.
- **Typography for output**: Monospace or editorial serif for headings to signal “this is structured knowledge,” body in readable sans-serif.