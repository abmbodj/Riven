# Audio-to-Notes Parallel Section Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sequential draft→enrich pipeline with parallel per-section note generation so that a 45-minute lecture recording reveals notes section-by-section as they complete, with fluid animations, instead of waiting for the full pipeline to finish.

**Architecture:** After Whisper transcribes the audio (returning segment timestamps), the transcript is split into ~5-minute sections at natural segment boundaries. Notes for all sections are generated in parallel (concurrency=4), and each completed section is pushed to the frontend via the existing Realtime job subscription. Short recordings (< 10 min) keep the existing single-section streaming flow unchanged.

**Tech Stack:** Deno/TypeScript (Supabase Edge Functions), Groq SDK (`groq-sdk@0.24.0`), React 18, Framer Motion, Vitest + React Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/functions/_shared/aiClient.ts` | Modify | Add `transcribeAudioWithSegments()` returning `{text, segments}` |
| `supabase/functions/_shared/aiJobProcessors.ts` | Modify | Add `groupSegmentsIntoSections`, `processConcurrently`, `generateNotesForSection`, `buildSectionNotePrompt`, `mergeAndEnrichSections`; replace `processNoteEnhancementJob` long-recording path |
| `client/src/components/audio/SectionedPreview.jsx` | Create | Animated per-section note reveal component |
| `client/src/pages/NoteEditor.jsx` | Modify | Add `enhancementSections` state, section-aware preview routing, file size guard in `handleEnhance` |

---

## Task 1: Add `transcribeAudioWithSegments` to aiClient.ts

**Files:**
- Modify: `supabase/functions/_shared/aiClient.ts`

- [ ] **Step 1: Add the new method** immediately after the closing brace of `transcribeAudio` (line 72), inside the object returned by `createAiClient`:

```ts
    async transcribeAudioWithSegments(audioBlob: Blob, filename: string): Promise<{
      text: string;
      segments: Array<{ id: number; start: number; end: number; text: string }>;
    }> {
      const file = new File([audioBlob], filename, { type: audioBlob.type });
      const transcription = await groq.audio.transcriptions.create({
        model: 'whisper-large-v3',
        file,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });
      return {
        text: transcription.text,
        segments: (transcription.segments ?? []).map((s: any) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          text: s.text,
        })),
      };
    },
```

Place it between `transcribeAudio` and the closing `};` of the returned object so the final file looks like:

```ts
    async transcribeAudio(...): Promise<string> { ... },

    async transcribeAudioWithSegments(...): Promise<{...}> {
      // new method above
    },
  };
};
```

- [ ] **Step 2: Update the `AiClient` type export** — it is inferred via `ReturnType<typeof createAiClient>` at line 76, so no manual type change is needed. Verify by checking the line still reads:

```ts
export type AiClient = ReturnType<typeof createAiClient>;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/aiClient.ts
git commit -m "feat(audio): add transcribeAudioWithSegments returning segment timestamps"
```

---

## Task 2: Add section-grouping and concurrency utilities to aiJobProcessors.ts

**Files:**
- Modify: `supabase/functions/_shared/aiJobProcessors.ts`

- [ ] **Step 1: Write a unit test for `groupSegmentsIntoSections`**

There is no separate test file for edge functions today — add a comment block at the top of the modified file and verify behavior manually, OR add to `client/src/pages/NoteEditor.test.jsx` if a shared utility is extracted. For now, test via integration (Task 5). Skip to implementation.

- [ ] **Step 2: Add the `groupSegmentsIntoSections` function** to `aiJobProcessors.ts`, immediately after the `getAudioMimeType` function (after line 156):

```ts
type AudioSegment = { id: number; start: number; end: number; text: string };
type AudioSection = { index: number; text: string; startTime: number; endTime: number };

const groupSegmentsIntoSections = (
  segments: AudioSegment[],
  targetDurationSecs = 300,
): AudioSection[] => {
  if (segments.length === 0) return [];

  const sections: AudioSection[] = [];
  let currentSegments: AudioSegment[] = [];
  let sectionStart = segments[0].start;

  for (const seg of segments) {
    currentSegments.push(seg);
    const elapsed = seg.end - sectionStart;
    if (elapsed >= targetDurationSecs) {
      sections.push({
        index: sections.length,
        text: currentSegments.map((s) => s.text).join(' '),
        startTime: sectionStart,
        endTime: seg.end,
      });
      currentSegments = [];
      sectionStart = seg.end;
    }
  }

  // Flush remaining segments as the last section
  if (currentSegments.length > 0) {
    sections.push({
      index: sections.length,
      text: currentSegments.map((s) => s.text).join(' '),
      startTime: sectionStart,
      endTime: currentSegments[currentSegments.length - 1].end,
    });
  }

  return sections;
};
```

- [ ] **Step 3: Add `processConcurrently` helper** directly after `groupSegmentsIntoSections`:

```ts
const processConcurrently = async <T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> => {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map((item, batchIndex) => fn(item, i + batchIndex)),
    );
  }
};
```

- [ ] **Step 4: Add `buildSectionNotePrompt`** after the existing `buildNoteEnrichPrompt` function (after line ~74 where the prompt builders live):

```ts
const buildSectionNotePrompt = (
  sectionIndex: number,
  totalSections: number,
  userNotes: string | null,
  className?: string | null,
) => `You are a lecture notes assistant. Given a transcript excerpt from a lecture, produce structured notes as a Tiptap JSON document for this section only.

${buildSubjectContext(className ?? undefined)}

This is section ${sectionIndex + 1} of ${totalSections} from a longer lecture.
- Use H2 for the section's main topic, H3 for subtopics.
- Bullet lists for concepts, ordered lists for sequential steps.
- Bold key terms on first use.
- Blockquotes for direct definitions.
- Do NOT include "Key Concepts" or "Potential Exam Questions" — those go in the final merge.
- Be concise. Do not pad with filler.

${TIPTAP_FORMAT}

Student notes (for context, if any):
${userNotes || 'No student notes were provided.'}`;
```

- [ ] **Step 5: Add `generateNotesForSection`** after the prompt builder:

```ts
const generateNotesForSection = async ({
  ai,
  section,
  totalSections,
  userNotesSnapshot,
  className,
  modelMap,
}: {
  ai: AiClient;
  section: AudioSection;
  totalSections: number;
  userNotesSnapshot: string | null;
  className: string | null;
  modelMap: ReturnType<typeof getAiModelMap>;
}): Promise<unknown> => {
  const prompt = buildSectionNotePrompt(section.index, totalSections, userNotesSnapshot, className);
  const rawText = await generateWithFallback({
    ai,
    primaryModel: modelMap.draft,
    fallbackModel: modelMap.final,
    messages: [{ role: 'user', content: `${prompt}\n\nSection Transcript:\n${section.text}` }],
    jsonMode: true,
    maxTokens: 3072,
  });

  try {
    return parseAiJsonResponse(rawText, 'Invalid section notes format');
  } catch {
    // Return an error placeholder node so other sections aren't blocked
    return {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: '[This section could not be processed]' }],
      }],
    };
  }
};
```

- [ ] **Step 6: Add `buildMergePrompt`** after `generateNotesForSection`:

```ts
const buildMergePrompt = (
  userNotes: string | null,
  className: string | null | undefined,
  sectionDocs: unknown[],
) => `You are a lecture notes assistant. You have notes for each section of a lecture. Merge them into one complete, polished Tiptap JSON document.

${buildSubjectContext(className ?? undefined)}

Requirements:
- Preserve the structure and wording of each section's notes.
- Remove any duplication introduced at section boundaries.
- Add a final "Key Concepts" section summarizing the whole lecture.
- Add a "Potential Exam Questions" section with 3–5 questions covering the full lecture.
- Keep H1/H2/H3 hierarchy. Bold key terms. Blockquotes for definitions.

${TIPTAP_FORMAT}

Student notes (for context, if any):
${userNotes || 'No student notes were provided.'}

Section notes JSON array:
${JSON.stringify(sectionDocs)}`;
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/aiJobProcessors.ts
git commit -m "feat(audio): add section grouping, concurrency, and per-section generation helpers"
```

---

## Task 3: Wire parallel processing into `processNoteEnhancementJob`

**Files:**
- Modify: `supabase/functions/_shared/aiJobProcessors.ts`

This task replaces the body of `processNoteEnhancementJob` starting from the `transcribeAudio` call (line 478) through the end of the `markSaving` block (line 542). Keep the setup lines (reporter creation, input extraction, model map, ai client, `markRunning`) unchanged.

- [ ] **Step 1: Replace `transcribeAudio` call with `transcribeAudioWithSegments`**

Find this block (around line 476–478):

```ts
  await reporter.markRunning('accepted', 5, 'Accepted note enhancement job');

  const transcription = await transcribeAudio({ ai, audioPath, admin, reporter });
```

Replace the `transcribeAudio` call with:

```ts
  await reporter.markRunning('accepted', 5, 'Accepted note enhancement job');

  // Download audio (same logic as before, now used by segment transcription)
  await reporter.update('fetching_audio', 12, 'Fetching lecture audio');
  const { data: audioData, error: storageError } = await admin.storage.from('note-audio').download(audioPath);
  if (storageError || !audioData) {
    throw createHttpError('Failed to retrieve audio file.', 500);
  }

  const audioBlob = new Blob([await audioData.arrayBuffer()], { type: getAudioMimeType(audioPath) });
  const filename = audioPath.split('/').pop() || 'audio.webm';

  // File size guard
  if (audioBlob.size > 25 * 1024 * 1024) {
    throw createHttpError('Audio file exceeds the 25MB processing limit. Try a shorter recording.', 413);
  }

  await reporter.update('processing_media', 24, 'Transcribing audio');
  const { text: transcription, segments } = await ai.transcribeAudioWithSegments(audioBlob, filename);
```

- [ ] **Step 2: Add section routing after transcription** — replace everything from `const draftMessages` through `reporter.markSaving(...)` with:

```ts
  const sections = groupSegmentsIntoSections(segments);

  // ── SHORT RECORDING: single-section streaming path (unchanged) ──────────
  if (sections.length <= 1) {
    const draftMessages: AiMessage[] = [{
      role: 'user',
      content: `${buildNoteDraftPrompt(userNotesSnapshot, className)}\n\nLecture Audio Transcription:\n${transcription}`,
    }];

    const draftResult = await streamDocPreview({
      ai,
      model: modelMap.draft,
      fallbackModel: modelMap.final,
      messages: draftMessages,
      reporter,
      phase: 'drafting',
      startPercent: 36,
      endPercent: 68,
      message: 'Drafting enhanced notes',
    });

    const draftDoc = draftResult.doc;
    if (draftResult.firstPreviewAt != null) {
      firstPreviewAt = draftResult.firstPreviewAt;
    }

    await reporter.update('enriching', 72, 'Enriching draft with examples and study aids', {
      preview_doc: draftDoc,
      preview_sections: Array.isArray((draftDoc as Record<string, unknown>).content)
        ? (draftDoc as Record<string, unknown>).content
        : [],
      preview_text: extractTextFromTiptapDoc(draftDoc),
    });

    const enrichText = await generateWithFallback({
      ai,
      primaryModel: modelMap.final,
      fallbackModel: modelMap.final,
      messages: [{
        role: 'user',
        content: `${buildNoteEnrichPrompt(userNotesSnapshot, className, draftDoc)}\n\nLecture Audio Transcription:\n${transcription}`,
      }],
      jsonMode: true,
    });

    let finalDoc: unknown;
    try {
      finalDoc = parseAiJsonResponse(enrichText, 'AI generated invalid enhanced notes format. Please try again.');
    } catch {
      finalDoc = draftDoc;
    }

    await reporter.markSaving('Saving enhanced notes', {
      final_doc: finalDoc,
      note_id: noteId,
      metrics: {
        server_total_ms: Date.now() - jobStartedAt,
        first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - jobStartedAt,
        ai_model_stage: { draft: modelMap.draft, final: modelMap.final },
      },
    });

    // DB write + cleanup (same as before — keep the existing code below this block)

  // ── LONG RECORDING: parallel section path ────────────────────────────────
  } else {
    const completedSections: unknown[] = new Array(sections.length).fill(null);
    const CONCURRENCY = 4;

    await reporter.update('drafting', 30, `Generating notes for ${sections.length} sections`);

    await processConcurrently(sections, CONCURRENCY, async (section) => {
      const sectionDoc = await generateNotesForSection({
        ai,
        section,
        totalSections: sections.length,
        userNotesSnapshot,
        className,
        modelMap,
      });

      completedSections[section.index] = sectionDoc;

      const ready = completedSections.filter(Boolean);
      if (firstPreviewAt == null) firstPreviewAt = Date.now();
      const progressPercent = Math.round(30 + (ready.length / sections.length) * 42);

      await reporter.markStreaming(
        'drafting',
        progressPercent,
        `Section ${ready.length} of ${sections.length} complete`,
        {
          preview_sections: ready,
          sections_complete: ready.length,
          sections_total: sections.length,
        },
      );
    });

    // Merge all sections + add Key Concepts / Exam Questions
    await reporter.update('enriching', 75, 'Merging sections and adding study aids');

    const mergeText = await generateWithFallback({
      ai,
      primaryModel: modelMap.final,
      fallbackModel: modelMap.final,
      messages: [{
        role: 'user',
        content: buildMergePrompt(userNotesSnapshot, className, completedSections),
      }],
      jsonMode: true,
      maxTokens: 8192,
    });

    let finalDoc: unknown;
    try {
      finalDoc = parseAiJsonResponse(mergeText, 'AI generated invalid merged notes format. Please try again.');
    } catch {
      // Fallback: concatenate section docs manually
      const allContent = completedSections.flatMap((doc: any) =>
        Array.isArray(doc?.content) ? doc.content : [],
      );
      finalDoc = { type: 'doc', content: allContent };
    }

    await reporter.markSaving('Saving enhanced notes', {
      final_doc: finalDoc,
      note_id: noteId,
      metrics: {
        server_total_ms: Date.now() - jobStartedAt,
        first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - jobStartedAt,
        ai_model_stage: { draft: modelMap.draft, final: modelMap.final },
        sections_count: sections.length,
      },
    });
  }
```

- [ ] **Step 3: Keep the DB write and cleanup block exactly as-is** — it comes after the `markSaving` call and is shared by both paths. It already reads:

```ts
  const { error: updateError } = await admin
    .from('notes')
    .update({
      enhanced_content: finalDoc,
      content: finalDoc,
      audio_url: null,
      source_type: 'audio',
    })
    .eq('id', noteId)
    .eq('user_id', job.user_id);

  if (updateError) throw updateError;

  admin.storage.from('note-audio').remove([audioPath]).catch(() => {});

  await reporter.complete({ ... });
```

Since `finalDoc` is now declared inside each branch of the `if/else`, you need to hoist the declaration before the `if`. Add this line immediately before `if (sections.length <= 1) {`:

```ts
  let finalDoc: unknown;
```

Then remove the `let finalDoc: unknown;` declarations inside each branch (they're already there in the code above — just ensure the declaration is hoisted).

- [ ] **Step 4: Delete the now-unused `transcribeAudio` function** (lines 158–181 in the original). The new path calls `transcribeAudioWithSegments` directly. Verify no other callers reference `transcribeAudio` by running:

```bash
grep -n "transcribeAudio[^W]" supabase/functions/_shared/aiJobProcessors.ts
```

Expected: zero results.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/aiJobProcessors.ts
git commit -m "feat(audio): parallel section note generation for long recordings"
```

---

## Task 4: File size guard in the client

**Files:**
- Modify: `client/src/pages/NoteEditor.jsx`

- [ ] **Step 1: Add the size check** in `handleEnhance` immediately after the null check on line 668:

Find:
```js
    const handleEnhance = async () => {
        const blob = recorder.getBlob();
        if (!blob || !noteId) return;

        setEnhancing(true);
```

Replace with:
```js
    const handleEnhance = async () => {
        const blob = recorder.getBlob();
        if (!blob || !noteId) return;

        const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // 24MB — 1MB below Groq's 25MB limit
        if (blob.size > MAX_AUDIO_BYTES) {
            setEnhanceError('Recording is too large to process (max ~90 min at standard quality). Please try a shorter recording.');
            return;
        }

        setEnhancing(true);
```

- [ ] **Step 2: Write a test** in `client/src/pages/NoteEditor.test.jsx` — add to the enhancement describe block:

```js
it('shows an error and does not upload when blob exceeds 24MB', async () => {
  const oversizedBlob = new Blob([new Uint8Array(25 * 1024 * 1024)], { type: 'audio/webm' });
  recorderMock.state = 'stopped';
  recorderMock.getBlob.mockReturnValue(oversizedBlob);

  api.getNote.mockResolvedValue(note);
  api.listAiJobs.mockResolvedValue([]);
  api.getClasses.mockResolvedValue([]);

  renderNoteEditor();
  await flushAsync();

  fireEvent.click(screen.getByRole('button', { name: /convert to notes/i }));
  await flushAsync();

  expect(api.uploadNoteAudio).not.toHaveBeenCalled();
  expect(screen.getByText(/too large to process/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the test to verify it fails first**

```bash
cd client && npx vitest run src/pages/NoteEditor.test.jsx --reporter=verbose 2>&1 | tail -30
```

Expected: FAIL — `getByText(/too large to process/i)` finds nothing because the guard doesn't exist yet (it will pass after Step 1 is done — but we wrote the test first for documentation, so both steps are already complete at this point).

- [ ] **Step 4: Run tests again to verify pass**

```bash
cd client && npx vitest run src/pages/NoteEditor.test.jsx --reporter=verbose 2>&1 | tail -30
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/NoteEditor.jsx client/src/pages/NoteEditor.test.jsx
git commit -m "feat(audio): block uploads over 24MB with a clear user-facing error"
```

---

## Task 5: Create the `SectionedPreview` component

**Files:**
- Create: `client/src/components/audio/SectionedPreview.jsx`

- [ ] **Step 1: Create the file**

```jsx
import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TiptapEditor from '../editor/TiptapEditor';

// Impeccable animation constants — ease-out only, no bounce
const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1],
      // Cap stagger at 6 sections so late sections don't wait 800ms+
      delay: Math.min(i, 6) * 0.06,
    },
  }),
  exit: { opacity: 0, y: 12, transition: { duration: 0.2 } },
};

/**
 * SectionedPreview
 *
 * Shows lecture note sections as they complete, animating each one in.
 *
 * Props:
 *   sections      — array of Tiptap doc objects (grows as sections complete)
 *   sectionsTotal — total number of sections expected (0 = unknown)
 *   statusText    — current phase label from the job
 */
export default function SectionedPreview({ sections = [], sectionsTotal = 0, statusText = '' }) {
  const prevLengthRef = useRef(0);

  // Track which sections are newly added so only new ones animate
  const newFromIndex = prevLengthRef.current;
  prevLengthRef.current = sections.length;

  const progressLabel = sectionsTotal > 0
    ? `${sections.length} of ${sectionsTotal} sections complete`
    : `${sections.length} section${sections.length !== 1 ? 's' : ''} complete`;

  return (
    <div className="rounded-2xl border border-claude-accent/20 bg-claude-surface/60 overflow-hidden mb-5">
      {/* Header */}
      <div className="px-4 py-3 border-b border-claude-border/20 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent">
            AI Enhancement Preview
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-claude-secondary mt-1">
            {progressLabel}
          </p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary shrink-0">
          {statusText}
        </span>
      </div>

      {/* Sections */}
      <div className="px-4 py-4 space-y-0">
        <AnimatePresence initial={false}>
          {sections.map((section, index) => (
            <motion.div
              key={index}
              custom={index - newFromIndex}
              variants={SECTION_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <TiptapEditor content={section} editable={false} placeholder="" />
              {index < sections.length - 1 && (
                <div className="my-4 border-t border-claude-border/20" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {sections.length === 0 && (
          <p className="font-mono text-[11px] text-claude-secondary py-2">
            Generating first section…
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write a smoke test** in `client/src/components/audio/SectionedPreview.test.jsx`:

```jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SectionedPreview from './SectionedPreview';

vi.mock('../editor/TiptapEditor', () => ({
  default: ({ content }) => (
    <div data-testid="section-content">
      {content?.content?.[0]?.content?.[0]?.text || ''}
    </div>
  ),
}));

const makeDoc = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('SectionedPreview', () => {
  it('renders each section', () => {
    render(
      <SectionedPreview
        sections={[makeDoc('Section one'), makeDoc('Section two')]}
        sectionsTotal={4}
        statusText="Generating notes..."
      />
    );
    expect(screen.getAllByTestId('section-content')).toHaveLength(2);
    expect(screen.getByText('Section one')).toBeInTheDocument();
    expect(screen.getByText('Section two')).toBeInTheDocument();
  });

  it('shows progress label', () => {
    render(<SectionedPreview sections={[makeDoc('A')]} sectionsTotal={8} statusText="Drafting" />);
    expect(screen.getByText(/1 of 8 sections complete/i)).toBeInTheDocument();
  });

  it('shows placeholder when no sections yet', () => {
    render(<SectionedPreview sections={[]} sectionsTotal={0} statusText="" />);
    expect(screen.getByText(/generating first section/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run component tests**

```bash
cd client && npx vitest run src/components/audio/SectionedPreview.test.jsx --reporter=verbose
```

Expected: all 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/components/audio/SectionedPreview.jsx client/src/components/audio/SectionedPreview.test.jsx
git commit -m "feat(audio): add SectionedPreview component with staggered section animations"
```

---

## Task 6: Wire `SectionedPreview` into NoteEditor

**Files:**
- Modify: `client/src/pages/NoteEditor.jsx`

- [ ] **Step 1: Add import** near the other audio component imports at the top of the file:

```js
import SectionedPreview from '../components/audio/SectionedPreview';
```

- [ ] **Step 2: Add `enhancementSections` state** alongside the other enhancement state vars (around line 106):

```js
    const [enhancementSections, setEnhancementSections] = useState([]);
    const [enhancementSectionsTotal, setEnhancementSectionsTotal] = useState(0);
```

- [ ] **Step 3: Update `handleEnhancementJobUpdate`** to extract section data from the job payload. Find the existing line:

```js
        const previewDoc = getJobPreviewDoc(job);
        setEnhancementPreviewDoc(previewDoc);
```

Add after it:

```js
        // Multi-section parallel path
        const payload = job?.result_payload || {};
        if (Array.isArray(payload.preview_sections) && typeof payload.sections_total === 'number') {
            setEnhancementSections(payload.preview_sections.filter(Boolean));
            setEnhancementSectionsTotal(payload.sections_total);
        }
```

- [ ] **Step 4: Reset section state on job completion/error** — find the two places that call `setEnhancementPreviewDoc(null)` (lines ~251 and ~268 in the original) and add the section reset beside each:

```js
            setEnhancementPreviewDoc(null);
            setEnhancementSections([]);        // add this
            setEnhancementSectionsTotal(0);    // add this
```

Do this in both the `completed` branch and the `failed/error` branch.

- [ ] **Step 5: Replace the preview panel** in the JSX. Find the block at line 1215–1243:

```jsx
                    <AnimatePresence>
                        {enhancementPreviewDoc && enhancementLocked && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="mb-5 rounded-2xl border border-claude-accent/20 bg-claude-surface/60 overflow-hidden"
                            >
                                <div className="px-4 py-3 border-b border-claude-border/20 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent">AI Enhancement Preview</p>
                                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-claude-secondary mt-1">
                                            Sections appear as they are completed
                                        </p>
                                    </div>
                                    <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary shrink-0">
                                        {enhancementStatusText}
                                    </span>
                                </div>
                                <div className="px-4 py-4">
                                    <TiptapEditor
                                        content={enhancementPreviewDoc}
                                        editable={false}
                                        placeholder=""
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
```

Replace with:

```jsx
                    <AnimatePresence>
                        {enhancementLocked && (enhancementSections.length > 0 || enhancementPreviewDoc) && (
                            <>
                                {enhancementSections.length > 1 ? (
                                    // Multi-section parallel path
                                    <SectionedPreview
                                        sections={enhancementSections}
                                        sectionsTotal={enhancementSectionsTotal}
                                        statusText={enhancementStatusText}
                                    />
                                ) : enhancementPreviewDoc ? (
                                    // Single-section streaming path (unchanged appearance)
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        className="mb-5 rounded-2xl border border-claude-accent/20 bg-claude-surface/60 overflow-hidden"
                                    >
                                        <div className="px-4 py-3 border-b border-claude-border/20 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent">AI Enhancement Preview</p>
                                                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-claude-secondary mt-1">
                                                    Sections appear as they are completed
                                                </p>
                                            </div>
                                            <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary shrink-0">
                                                {enhancementStatusText}
                                            </span>
                                        </div>
                                        <div className="px-4 py-4">
                                            <TiptapEditor
                                                content={enhancementPreviewDoc}
                                                editable={false}
                                                placeholder=""
                                            />
                                        </div>
                                    </motion.div>
                                ) : null}
                            </>
                        )}
                    </AnimatePresence>
```

- [ ] **Step 6: Run all NoteEditor tests**

```bash
cd client && npx vitest run src/pages/NoteEditor.test.jsx --reporter=verbose 2>&1 | tail -40
```

Expected: all tests PASS (existing tests should be unaffected — the new state vars are additive)

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/NoteEditor.jsx
git commit -m "feat(audio): show per-section preview during parallel note generation"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Baseline — short recording (< 10 min)**
  - Record ~5 min of audio in a test note
  - Hit "Convert to Notes"
  - Verify: single-section streaming path runs; preview appears as a single block (not section-by-section); no regression in UX

- [ ] **Step 2: Parallel path — long recording (> 10 min)**
  - Record or upload a > 10 min audio file
  - Hit "Convert to Notes"  
  - Verify in the preview panel:
    - "Section 1 of N complete" appears before all sections are done
    - Each section animates in with a smooth fade+slide (no bounce/spring)
    - Progress counter increments as sections finish
  - Verify final note contains merged content with "Key Concepts" and "Exam Questions" sections

- [ ] **Step 3: File size guard**
  - Create a Blob > 24MB in the browser console: `new Blob([new Uint8Array(25*1024*1024)])`
  - Mock `recorder.getBlob()` to return it (or manually test via unit test from Task 4)
  - Verify: error message shown, `uploadNoteAudio` never called

- [ ] **Step 4: Section error isolation**
  - Temporarily inject a mock in `generateNotesForSection` that throws for section index 1
  - Verify: other sections still complete and show in the preview; the failed section shows the `[This section could not be processed]` placeholder node
  - Remove the mock

- [ ] **Step 5: Navigate-away recovery**
  - Start a long conversion, immediately navigate to a different note, then return
  - Verify: the job state is restored from the Realtime subscription; sections that completed before return are shown; job continues to completion

---

## Self-Review Checklist

**Spec coverage:**
- [x] Whisper segment timestamps → Task 1
- [x] Section grouping with natural boundaries → Task 2
- [x] Parallel concurrency=4 with `Promise.allSettled` → Task 3
- [x] Short recording fast path preserved → Task 3 (single-section branch)
- [x] Error node on section failure → Task 2 (`generateNotesForSection` catch block)
- [x] All sections fail → fallback: concatenate section docs in Task 3 merge catch
- [x] File size guard client-side → Task 4
- [x] File size guard server-side → Task 3 Step 1
- [x] Section-by-section animated reveal → Task 5
- [x] Progress counter header → Task 5
- [x] Impeccable animation principles → Task 5 (ease-out, no bounce, stagger cap)
- [x] Single-section path preserves existing streaming UX → Task 6 Step 5

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:**
- `AudioSection.index` used consistently across `groupSegmentsIntoSections`, `processConcurrently`, `generateNotesForSection`
- `completedSections[section.index]` correctly addresses the ordered slot
- `preview_sections` key matches what the client reads in `getJobPreviewDoc` and the new `handleEnhancementJobUpdate` patch
- `sections_total` key matches `SectionedPreview`'s `sectionsTotal` prop (camelCase in component, snake_case in payload — translation happens in `handleEnhancementJobUpdate`)
