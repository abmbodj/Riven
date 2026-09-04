import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

describe('audio notes v2 edge contract', () => {
  it('accepts transcript-backed enhancement jobs without a whole audio file', async () => {
    const source = await read('../../supabase/functions/create-ai-job/index.ts');
    expect(source).toContain('payload.sessionId');
    expect(source).toContain('!payload.audioPath && !payload.sessionId && !hasUserNotes');
  });

  it('loads timestamped transcript segments and atomically applies v2 notes', async () => {
    const source = await read('../../supabase/functions/_shared/aiJobProcessors.ts');
    expect(source).toContain("from('transcript_segments')");
    expect(source).toContain('buildEvidenceTranscript');
    expect(source).toContain("admin.rpc('apply_audio_note_enhancement_v2'");
    expect(source).toContain("input.preferredFormat !== 'auto'");
    expect(source).toContain('groundingContext');
    expect(source).toContain('Merge only the grounded section drafts');
    expect(source).toContain('transcribeDeepgramRecording');
    expect(source).toContain("Deno.env.get('DEEPGRAM_API_KEY')");
  });

  it('configures every new self-authenticating edge function for gateway pass-through', async () => {
    const source = await read('../../supabase/config.toml');
    for (const name of ['transcription-token', 'audio-retention-cleanup', 'retry-ai-jobs']) {
      expect(source).toContain(`[functions.${name}]\nverify_jwt = false`);
    }
  });

  it('defines an atomic enhancement apply function with revision and retention updates', async () => {
    const source = await read('../../supabase/migrations/20260903000000_audio_notes_v2.sql');
    expect(source).toContain('function public.apply_audio_note_enhancement_v2');
    expect(source).toContain("change_kind, source_snapshot_hash");
    expect(source).toContain("enhancement_schema_version = 2");
    expect(source).toContain("interval '24 hours'");
    expect(source).toContain('function public.restore_audio_note_revision');
    expect(source).toContain("polish_status = 'draft'");
  });

  it('durably retries transient audio-note provider failures for up to 24 hours', async () => {
    const runner = await read('../../supabase/functions/run-ai-job/index.ts');
    const dispatcher = await read('../../supabase/functions/retry-ai-jobs/index.ts');
    const migration = await read('../../supabase/migrations/20260903000000_audio_notes_v2.sql');

    expect(runner).toContain('buildAiJobRetrySchedule');
    expect(runner).toContain("status: 'queued'");
    expect(dispatcher).toContain(".eq('kind', 'note_enhancement')");
    expect(migration).toContain('retry_until');
    expect(migration).toContain('audio-note-ai-retry-minute');
  });
});
