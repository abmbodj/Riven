// ─────────────────────────────────────────────────────────────────────────────
// Notes pipeline harness — before/after demonstration.
//
// For each fabricated transcript (a technical lecture, a recorded meeting, and a
// cert-prep session) it prints:
//   (a) BASELINE — a naive generic "make notes" prompt (pre-improvement style)
//   (b) ENHANCED — the real new pipeline: subject/content-type adaptation +
//       draft -> enrich (quality pass) with Action items / emphasis / garbled-term repair
//   (c) KNOWLEDGE LAYER — the structured hand-off extracted from the enhanced note,
//       plus the compact context every downstream generator now consumes.
//
// Usage:
//   GROQ_API_KEY=sk-... node server/test/notes-pipeline-harness.mjs
//   node server/test/notes-pipeline-harness.mjs --dry      # print prompts only, no API
//   node server/test/notes-pipeline-harness.mjs --text     # treat fixtures as TYPED notes (no audio)
//   GROQ_API_KEY=... node server/test/notes-pipeline-harness.mjs technical-lecture
//
// It calls Groq's OpenAI-compatible REST endpoint directly (no SDK dependency) so it
// runs under plain Node. Models mirror the app defaults (GPT-OSS 20B draft, GPT-OSS 120B quality pass).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { resolveNoteStrategy } from '../../supabase/functions/_shared/subjectStrategies.mjs';
import { buildNoteDraftPrompt, buildNoteEnrichPrompt } from '../../supabase/functions/_shared/notePrompts.mjs';
import {
  buildKnowledgeExtractionPrompt,
  normalizeKnowledgeLayer,
  buildKnowledgeContext,
} from '../../supabase/functions/_shared/noteKnowledge.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TRANSCRIPTS = join(HERE, 'fixtures', 'transcripts');

const DRAFT_MODEL = process.env.AI_DRAFT_MODEL || 'openai/gpt-oss-20b';
const FINAL_MODEL = process.env.AI_FINAL_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const FIXTURES = [
  { file: 'technical-lecture.txt', className: 'Biology 101', subject: 'Biology' },
  { file: 'recorded-meeting.txt', className: 'Product Team Sync', subject: null },
  { file: 'cert-prep.txt', className: 'AWS Solutions Architect Prep', subject: null },
];

const BASELINE_PROMPT = `Turn the following transcript into study notes. Output ONLY valid JSON for a Tiptap document: { "type": "doc", "content": [...] } using heading, paragraph, and bulletList nodes.`;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const TEXT_MODE = args.includes('--text');
const only = args.find((a) => !a.startsWith('--'));

const wordCount = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

async function callGroq(model, prompt) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq ${model} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
};

// Render a Tiptap doc to readable text so notes are easy to eyeball.
const renderDoc = (node, depth = 0) => {
  if (!node) return '';
  if (node.type === 'text') {
    const bold = node.marks?.some((m) => m.type === 'bold');
    return bold ? `**${node.text}**` : node.text || '';
  }
  const kids = (node.content || []).map((c) => renderDoc(c, depth)).join('');
  switch (node.type) {
    case 'doc': return (node.content || []).map((c) => renderDoc(c, 0)).join('\n');
    case 'heading': return `\n${'#'.repeat(node.attrs?.level || 2)} ${(node.content || []).map(renderDoc).join('')}`;
    case 'paragraph': return `${(node.content || []).map(renderDoc).join('')}`;
    case 'bulletList':
    case 'orderedList':
      return (node.content || []).map((li, i) => {
        const marker = node.type === 'orderedList' ? `${i + 1}.` : '-';
        const text = (li.content || []).map((c) => renderDoc(c, depth + 1)).join(' ').trim();
        return `${'  '.repeat(depth)}${marker} ${text}`;
      }).join('\n');
    case 'listItem': return (node.content || []).map((c) => renderDoc(c, depth)).join(' ');
    case 'blockquote': return `> ${(node.content || []).map(renderDoc).join(' ')}`;
    case 'table': return '[table]\n' + (node.content || []).map(renderDoc).join('\n');
    case 'tableRow': return (node.content || []).map(renderDoc).join(' | ');
    case 'tableHeader':
    case 'tableCell': return (node.content || []).map(renderDoc).join(' ');
    case 'horizontalRule': return '---';
    default: return kids;
  }
};

const hr = (label) => `\n${'═'.repeat(78)}\n${label}\n${'═'.repeat(78)}`;
const sub = (label) => `\n${'─'.repeat(40)} ${label} ${'─'.repeat(Math.max(0, 36 - label.length))}`;

async function runFixture({ file, className, subject }) {
  const source = readFileSync(join(TRANSCRIPTS, file), 'utf8').trim();
  const strategy = resolveNoteStrategy({ className, subject, sourceText: source });

  // In --text mode the fixture stands in for the user's TYPED notes (no audio): the source
  // is the notes themselves, sourceKind 'notes', and nothing is appended as a transcript.
  const sourceKind = TEXT_MODE ? 'notes' : 'audio';
  const userNotes = TEXT_MODE ? source : null;
  const sourceBlock = TEXT_MODE ? '' : `\n\nLecture Audio Transcription:\n${source}`;

  console.log(hr(`FIXTURE: ${file}${TEXT_MODE ? '  [TEXT-ONLY ENHANCE]' : ''}`));
  console.log(`class: ${className} | subject: ${subject ?? '(none)'}`);
  console.log(`detected note method: ${strategy.noteMethod} (${strategy.label}) | source words: ${wordCount(source)}`);

  const draftPrompt = `${buildNoteDraftPrompt(userNotes, className, subject, source, { sourceKind })}${sourceBlock}`;

  if (DRY) {
    console.log(sub('ENHANCED DRAFT PROMPT (dry run — not sent)'));
    console.log(draftPrompt.slice(0, 1600) + '\n...[truncated]');
    return;
  }

  // (a) Baseline (skipped in text mode — there is no naive text-enhance baseline worth showing)
  if (!TEXT_MODE) {
    console.log(sub('(a) BASELINE notes (naive generic prompt)'));
    const baseline = parseJson(await callGroq(DRAFT_MODEL, `${BASELINE_PROMPT}\n\nTranscript:\n${source}`));
    const baselineText = baseline ? renderDoc(baseline).trim() : '';
    console.log(baselineText || '[failed to parse baseline]');
    if (baselineText) console.log(`\n[baseline length: ${wordCount(baselineText)} words]`);
  }

  // (b) Enhanced: draft -> enrich (quality pass)
  const draftDoc = parseJson(await callGroq(DRAFT_MODEL, draftPrompt));
  const enrichPrompt = `${buildNoteEnrichPrompt(userNotes, className, draftDoc, subject, source, { sourceKind })}${sourceBlock}`;
  const finalDoc = parseJson(await callGroq(FINAL_MODEL, enrichPrompt)) || draftDoc;
  const finalText = finalDoc ? renderDoc(finalDoc).trim() : '';
  console.log(sub('(b) ENHANCED notes (adaptive + quality pass)'));
  console.log(finalText || '[failed to parse enhanced]');
  if (finalText) console.log(`\n[enhanced length: ${wordCount(finalText)} words from ${wordCount(source)} source words]`);

  // (c) Structured knowledge layer (grounded on the source: transcript for audio, the notes for text)
  const rawLayer = parseJson(await callGroq(FINAL_MODEL, buildKnowledgeExtractionPrompt(finalDoc, source, className, subject, strategy.noteMethod)));
  const layer = normalizeKnowledgeLayer(rawLayer);
  console.log(sub('(c) KNOWLEDGE LAYER (downstream hand-off)'));
  console.log(JSON.stringify(layer, null, 2));
  console.log(sub('    → context injected into flashcards/exams/guides'));
  console.log(buildKnowledgeContext(layer));
}

async function main() {
  if (!DRY && !process.env.GROQ_API_KEY) {
    console.error('No GROQ_API_KEY set. Re-run with a key, or pass --dry to print prompts only.');
    process.exit(1);
  }
  const targets = only ? FIXTURES.filter((f) => f.file.startsWith(only)) : FIXTURES;
  if (targets.length === 0) {
    console.error(`No fixture matches "${only}". Available: ${FIXTURES.map((f) => f.file).join(', ')}`);
    process.exit(1);
  }
  for (const fixture of targets) {
    try {
      await runFixture(fixture);
    } catch (err) {
      console.error(`\n[${fixture.file}] failed:`, err.message);
    }
  }
  console.log('\nDone.');
}

main();
