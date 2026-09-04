import { describe, expect, it } from 'vitest';

import {
  buildEvidenceTranscript,
  buildRecordingAssetEvidence,
  buildMissingAudioGapSignals,
  buildSourceSnapshotHash,
  extractExplicitStudySignals,
  resolveClassroomNoteMethod,
} from '../../supabase/functions/_shared/audioNotesV2Core.mjs';

const segments = [
  {
    provider_segment_id: 'seg-1',
    started_at_ms: 1250,
    ended_at_ms: 3200,
    speaker_key: '0',
    original_text: 'The chain rule will definitely be on the exam.',
  },
  {
    provider_segment_id: 'seg-2',
    started_at_ms: 3300,
    ended_at_ms: 5200,
    speaker_key: '1',
    original_text: 'Homework seven is due Friday.',
  },
];

describe('classroom audio notes v2 core', () => {
  it('formats every transcript claim with stable timestamped evidence ids', () => {
    expect(buildEvidenceTranscript(segments)).toBe(
      '[seg-1 | 00:01.250–00:03.200 | Speaker 0] The chain rule will definitely be on the exam.\n'
      + '[seg-2 | 00:03.300–00:05.200 | Speaker 1] Homework seven is due Friday.',
    );
  });

  it('keeps Deepgram numeric speaker zero instead of treating it as unattributed', () => {
    expect(buildEvidenceTranscript([{
      id: 'speaker-zero', startMs: 0, endMs: 1000, speaker: 0, text: 'Opening point.',
    }])).toContain('Speaker 0');
  });

  it('creates a stable snapshot hash independent of input ordering', async () => {
    const first = await buildSourceSnapshotHash({ segments, jots: 'Remember substitution.' });
    const second = await buildSourceSnapshotHash({ segments: [...segments].reverse(), jots: 'Remember substitution.' });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it('extracts only explicit exam and assignment signals with evidence links', () => {
    expect(extractExplicitStudySignals(segments)).toEqual([
      expect.objectContaining({ signalKind: 'exam_cue', evidenceRefs: ['seg-1'] }),
      expect.objectContaining({ signalKind: 'deadline_candidate', evidenceRefs: ['seg-2'] }),
    ]);
  });

  it('adapts note shape by class material while keeping a stable frame', () => {
    expect(resolveClassroomNoteMethod({ subject: 'Calculus', sessionKind: 'problem_solving' })).toBe('worked_examples');
    expect(resolveClassroomNoteMethod({ subject: 'Organic Chemistry', sessionKind: 'lab' })).toBe('procedural');
    expect(resolveClassroomNoteMethod({ subject: 'English Literature', sessionKind: 'seminar' })).toBe('discussion');
    expect(resolveClassroomNoteMethod({ subject: 'Spanish', sessionKind: 'lecture' })).toBe('language');
  });

  it('turns only readable timestamped class assets into grounded evidence', () => {
    expect(buildRecordingAssetEvidence([
      {
        id: 'asset-1', asset_kind: 'photo', captured_at_ms: 61000,
        accessible_label: 'Whiteboard', extracted_text: 'v = u + at',
      },
      { id: 'asset-2', asset_kind: 'slide_pdf', captured_at_ms: 90000, accessible_label: 'Unreadable deck' },
    ])).toBe('[asset:asset-1 | 01:01.000 | photo | Whiteboard]\nv = u + at');
  });

  it('creates review signals for missing five-second audio chunks', () => {
    expect(buildMissingAudioGapSignals({
      manifestChunkCount: 5,
      chunks: [{ sequence: 0 }, { sequence: 1 }, { sequence: 4 }],
    })).toEqual([expect.objectContaining({
      signalKind: 'audio_gap',
      severity: 'warning',
      payload: { firstSequence: 2, lastSequence: 3, startedAtMs: 10000, endedAtMs: 20000 },
    })]);
  });
});
