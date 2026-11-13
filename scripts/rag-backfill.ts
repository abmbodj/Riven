// Backfill RAG chunks for existing notes. Resumable and rate-limited.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… GEMINI_API_KEY=… \
//     deno run -A scripts/rag-backfill.ts [--per-minute 60] [--batch 100] [--cursor .rag-backfill-cursor] [--dry-run]
//
// Walks notes in id order, saving the last finished id to the cursor file after every note, so a
// crash or Ctrl-C resumes where it stopped. Re-running is safe: ingestSource skips notes whose
// content hash is unchanged. Embedding 429/5xx are retried with backoff inside embed().
import { parseArgs } from 'jsr:@std/cli@1.0.6/parse-args';

import { ingestSource, noteToBlocks, supabaseChunkStore } from '../supabase/functions/_shared/rag.ts';
import { newTraceId } from '../supabase/functions/_shared/llmTelemetry.ts';
import { getSupabaseAdmin } from '../supabase/functions/_shared/supabaseAdmin.ts';

const args = parseArgs(Deno.args, {
  string: ['per-minute', 'batch', 'cursor'],
  boolean: ['dry-run'],
  default: { 'per-minute': '60', batch: '100', cursor: '.rag-backfill-cursor' },
});
const perMinute = Math.max(1, Number(args['per-minute']));
const batch = Math.max(1, Number(args.batch));
const cursorPath = String(args.cursor);
const minGapMs = 60_000 / perMinute;

const admin = getSupabaseAdmin();
const store = supabaseChunkStore(admin);
const readCursor = async () => {
  try { return (await Deno.readTextFile(cursorPath)).trim() || null; } catch { return null; }
};

let cursor = await readCursor();
let done = 0, skipped = 0, failed = 0, chunks = 0;
console.log(`backfill: resuming after ${cursor ?? '(start)'}; ${perMinute} notes/min`);

while (true) {
  let query = admin.from('notes').select('id, user_id, title, content, source_type')
    .not('user_id', 'is', null).order('id').limit(batch);
  if (cursor) query = query.gt('id', cursor);
  const { data: notes, error } = await query;
  if (error) throw error;
  if (!notes?.length) break;

  for (const note of notes) {
    const started = Date.now();
    try {
      if (!args['dry-run']) {
        const r = await ingestSource({
          store,
          userId: note.user_id,
          sourceId: note.id,
          title: note.title || 'Untitled',
          kind: `note:${note.source_type || 'manual'}`,
          blocks: await noteToBlocks(admin, note),
          telemetry: { traceId: newTraceId() },
        });
        if (r.skipped) skipped++; else { done++; chunks += r.chunks; }
      }
    } catch (err) {
      // Leave it for the next run / the trigger-driven job; don't stall the backfill.
      failed++;
      console.error(`backfill: note ${note.id} failed:`, err instanceof Error ? err.message : err);
    }
    cursor = note.id as string;
    await Deno.writeTextFile(cursorPath, note.id);
    const wait = minGapMs - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  console.log(`backfill: indexed=${done} unchanged=${skipped} failed=${failed} chunks=${chunks} cursor=${cursor}`);
}

console.log(`backfill: complete. indexed=${done} unchanged=${skipped} failed=${failed} chunks=${chunks}`);
if (failed) console.log('backfill: delete the cursor file and re-run to retry failures (unchanged notes are skipped).');
