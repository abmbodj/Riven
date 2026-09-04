import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.resolve(process.cwd(), '..', 'supabase', 'migrations');

const readAudioNotesV2Migration = async () => {
  const names = await readdir(migrationsDir);
  const filename = names.find((name) => name.endsWith('_audio_notes_v2.sql'));
  expect(filename, 'audio notes v2 migration must exist').toBeTruthy();
  return readFile(path.join(migrationsDir, filename), 'utf8');
};

describe('audio notes v2 migration', () => {
  it('creates every normalized owner-scoped table', async () => {
    const sql = await readAudioNotesV2Migration();
    const tables = [
      'recording_sessions',
      'recording_chunks',
      'transcript_segments',
      'recording_marks',
      'recording_assets',
      'note_revisions',
      'study_signals',
      'class_note_profiles',
      'class_memory_terms',
    ];

    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`create table(?: if not exists)? public\\.${table}`, 'i'));
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }
  });

  it('grants Data API access explicitly and keeps anonymous callers out', async () => {
    const sql = await readAudioNotesV2Migration();

    expect(sql).toMatch(/grant select, insert, update, delete on public\.recording_sessions to authenticated/i);
    expect(sql).toMatch(/revoke all on public\.recording_sessions from anon/i);
    expect(sql).toMatch(/to authenticated[\s\S]*get_app_user_id\(\)/i);
  });

  it('creates private storage buckets and owner-folder policies', async () => {
    const sql = await readAudioNotesV2Migration();

    expect(sql).toMatch(/'recording-chunks'[\s\S]*false/i);
    expect(sql).toMatch(/'note-assets'[\s\S]*false/i);
    expect(sql).toMatch(/storage\.foldername\(name\)/i);
  });

  it('enforces idempotent chunk sequence and transcript segment identity', async () => {
    const sql = await readAudioNotesV2Migration();

    expect(sql).toMatch(/unique\s*\(session_id,\s*sequence\)/i);
    expect(sql).toMatch(/unique\s*\(session_id,\s*provider_segment_id\)/i);
  });
});
