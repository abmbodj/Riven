// Loads the eval corpus through the same extractors production uses:
//   bio201  – a real PDF (generated from pages.json with pdf-lib) → unpdf → pagesToBlocks
//   hist110 – markdown converted to a Tiptap doc → tiptapToBlocks (a saved note)
//   chem102 – timestamped audio transcript segments → segmentsToBlocks (an audio note)
//   econ101 – YouTube transcript with [mm:ss] lines → plainTextToBlocks
//   psyc100 – plain-text study guide with headings → plainTextToBlocks
import { PDFDocument, StandardFonts } from 'npm:pdf-lib@1.17.1';

import { pdfToBlocks, type Block } from '../supabase/functions/_shared/rag.ts';
import { plainTextToBlocks, segmentsToBlocks, tiptapToBlocks } from '../supabase/functions/_shared/ragCore.mjs';

export type Doc = { key: string; title: string; kind: string; blocks: Block[]; fullText: string };

const dir = new URL('./corpus/', import.meta.url);
const read = (name: string) => Deno.readTextFile(new URL(name, dir));

/** Write the lecture PDF once (deterministic), so the fixture is a real PDF on disk. */
export const buildLecturePdf = async (): Promise<Uint8Array> => {
  const pages: string[] = JSON.parse(await read('bio201-lecture7.pages.json'));
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date('2026-10-01T00:00:00Z'));
  pdf.setModificationDate(new Date('2026-10-01T00:00:00Z'));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = pdf.addPage([612, 792]);
    let y = 740;
    for (const para of text.split('\n')) {
      const words = para.split(' ');
      let line = '';
      const flush = () => { page.drawText(line, { x: 54, y, size: 10.5, font }); y -= 14; line = ''; };
      for (const w of words) {
        if (font.widthOfTextAtSize(`${line} ${w}`, 10.5) > 500) flush();
        line = line ? `${line} ${w}` : w;
      }
      if (line || !para) flush();
    }
  }
  return await pdf.save();
};

const mdToTiptap = (md: string) => ({
  type: 'doc',
  content: md.split(/\n\s*\n/).flatMap((block) => block.split('\n').filter(Boolean).map((line) => {
    const h = line.match(/^#\s+(.+)/);
    return h
      ? { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: h[1] }] }
      : { type: 'paragraph', content: [{ type: 'text', text: line }] };
  })),
});

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export const loadCorpus = async (): Promise<Doc[]> => {
  const pdfPath = new URL('bio201-lecture7.pdf', dir);
  let pdfBytes: Uint8Array;
  try { pdfBytes = await Deno.readFile(pdfPath); } catch {
    pdfBytes = await buildLecturePdf();
    await Deno.writeFile(pdfPath, pdfBytes);
  }
  const bioBlocks = await pdfToBlocks(pdfBytes);

  const histMd = await read('hist110-french-revolution.notes.md');
  const histBlocks = tiptapToBlocks(mdToTiptap(histMd));

  const segs: Array<{ start_ms: number; end_ms: number; text: string }> = JSON.parse(await read('chem102-buffers.segments.json'));
  const chemBlocks = segmentsToBlocks(segs);

  const econTxt = await read('econ101-elasticity.youtube.txt');
  const psycTxt = await read('psyc100-memory.notes.txt');

  // fullText = what the old full-context path stuffs into the prompt (whole document, with the
  // page / timestamp / heading markers the student's source carries, so both modes can cite).
  return [
    {
      key: 'bio201', title: 'BIO 201 Lecture 7', kind: 'upload:pdf', blocks: bioBlocks,
      fullText: bioBlocks.map((b) => `[Page ${b.meta.page}]\n${b.text}`).join('\n\n'),
    },
    { key: 'hist110', title: 'HIST 110 French Revolution notes', kind: 'note:manual', blocks: histBlocks, fullText: histMd },
    {
      key: 'chem102', title: 'CHEM 102 buffers lecture recording', kind: 'note:audio', blocks: chemBlocks,
      fullText: segs.map((s) => `[${mmss(s.start_ms)}] ${s.text}`).join('\n'),
    },
    { key: 'econ101', title: 'EconExplained: price elasticity (YouTube)', kind: 'note:youtube', blocks: plainTextToBlocks(econTxt), fullText: econTxt },
    { key: 'psyc100', title: 'PSYC 100 memory study guide', kind: 'upload:text', blocks: plainTextToBlocks(psycTxt), fullText: psycTxt },
  ];
};
