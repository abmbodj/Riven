import { buildNaturalNoteStyleInstructions, buildSubjectContext } from './aiCore.mjs';
import { resolveNoteStrategy } from './subjectStrategies.mjs';

const NOTE_TIPTAP_FORMAT = `Output ONLY valid JSON: { "type": "doc", "content": [...] }. No markdown/backticks outside JSON.
Node types: heading (attrs.level 1-3), paragraph, bulletList→listItem→paragraph, orderedList→listItem→paragraph, blockquote→paragraph, horizontalRule.
Table: { "type": "table", "content": [ tableRow ] } where each tableRow contains tableHeader (header row) or tableCell nodes each wrapping a paragraph. Use tables ONLY for genuine comparisons (e.g. comparing concepts, listing properties side-by-side). Do not replace bullet lists with tables.
Text marks: { "type": "text", "marks": [{ "type": "bold" }], "text": "..." } (also: italic, code).`;

const HYBRID_NOTE_SHAPE_REQUIREMENTS = `Required shape:
- Break the note into obvious H2 topic blocks whenever the material covers multiple ideas.
- Inside each topic, mix short framing paragraphs with concise bullets, ordered steps, examples, or comparison items.
- Add compact review cues like "Why it matters:", "What to remember:", or "Watch for:" when they help the student scan faster.
- Do not let the output collapse into uninterrupted essay prose; split dense explanation into note-sized chunks.
- Scale the notes to the material: a long session must yield substantially more notes than a short one. Capture every distinct topic, definition, example, and step that was covered — do not over-compress or summarize away detail.
- Never output literal markdown markers such as **term**. Bold must be represented using Tiptap marks only.`;

// What the model should call the source in its instructions, by input kind.
const SOURCE_LABELS = { audio: 'the lecture audio', video: 'the video', notes: 'your notes' };
const resolveSourceLabel = (sourceKind) => SOURCE_LABELS[sourceKind] || SOURCE_LABELS.audio;

const buildNotePromptContext = ({
  className,
  subject,
  sourceText,
  includeKeyConcepts = false,
  preserveStudentPhrasing = true,
  allowMethodSummary = true,
  sourceKind = 'audio',
} = {}) => {
  const noteStrategy = resolveNoteStrategy({ className, subject, sourceText });
  const sectionSummaryRule = noteStrategy.allowsSummary && !allowMethodSummary
    ? '\n- For this section draft, omit the final Review Summary; the merged complete note handles it.'
    : '';

  const adaptationDirective = `Adapt the structure to the material rather than forcing a fixed template. Based on ${resolveSourceLabel(sourceKind)}, this session reads as ${noteStrategy.label.toLowerCase()} — follow the note method below, but let the content (conceptual/technical, narrative/argumentative, procedural/skills, meeting/discussion, or language) drive the shape.`;

  return `${buildSubjectContext(className ?? undefined, subject ?? undefined)}

${adaptationDirective}

${buildNaturalNoteStyleInstructions({
  includeKeyConcepts,
  preserveStudentPhrasing,
  allowReviewSummary: noteStrategy.allowsSummary && allowMethodSummary,
})}

${noteStrategy.promptInstructions}${sectionSummaryRule}`;
};

export const buildNoteDraftPrompt = (userNotes, className, subject, sourceText, { sourceKind = 'audio' } = {}) => {
  const hasUserNotes = Boolean(userNotes && userNotes.trim());
  const sourceLabel = resolveSourceLabel(sourceKind);
  return `You are a notes assistant producing a fast first draft as a Tiptap JSON document.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: hasUserNotes,
  sourceKind,
})}

Goal: produce a usable first pass quickly.
${hasUserNotes
  ? `- Preserve every point the student already wrote; never drop their content. Weave the highest-confidence detail from ${sourceLabel} around what they have.`
  : `- Generate clean, usable notes directly from ${sourceLabel}.`}
- Capture the main ideas in a way the student could realistically have written after class.
- Keep the structure practical; lead with the highest-value content.
${HYBRID_NOTE_SHAPE_REQUIREMENTS}

${NOTE_TIPTAP_FORMAT}

Student notes:
${userNotes || 'No student notes were provided.'}`;
};

export const buildNoteEnrichPrompt = (userNotes, className, draftDoc, subject, sourceText, { sourceKind = 'audio' } = {}) => {
  const hasUserNotes = Boolean(userNotes && userNotes.trim());
  const sourceLabel = resolveSourceLabel(sourceKind);
  return `You are a notes assistant refining an existing draft into a complete set of natural, study-ready notes as Tiptap JSON.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: hasUserNotes,
  sourceKind,
})}
- Preserve the structure and strongest wording of the draft unless accuracy requires revision.
${hasUserNotes
  ? '- Keep every point from the student\'s original notes; never drop their content.'
  : `- Build the notes from ${sourceLabel}; there were no student notes to preserve.`}
- Add missing terms, definitions, examples, and connective explanation wherever the content contract is not yet satisfied.
- Reshape polished prose into chunked study notes whenever possible: short setup line, then facts/steps/examples.
${HYBRID_NOTE_SHAPE_REQUIREMENTS}

${NOTE_TIPTAP_FORMAT}

Student notes:
${userNotes || 'No student notes were provided.'}

Current draft JSON:
${JSON.stringify(draftDoc)}`;
};

export const buildSectionNotePrompt = (
  sectionIndex,
  totalSections,
  userNotes,
  className,
  subject,
  sourceText,
  { sourceKind = 'audio' } = {},
) => {
  const hasUserNotes = Boolean(userNotes && userNotes.trim());
  const sourceLabel = resolveSourceLabel(sourceKind);
  return `You are a notes assistant. Given an excerpt from ${sourceLabel}, produce notes as a Tiptap JSON document for this section only.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: hasUserNotes,
  allowMethodSummary: false,
  sourceKind,
})}

This is section ${sectionIndex + 1} of ${totalSections} from a longer session.
- Keep this section self-contained and focused on the material covered here.
- Use H2 or H3 headings only when they help organize the section.
- Capture every concrete idea, definition, and example in this excerpt — be thorough within the section, but add no filler.
- Favor short note blocks over polished paragraphing.
${HYBRID_NOTE_SHAPE_REQUIREMENTS}

${NOTE_TIPTAP_FORMAT}

Student notes (for context, if any):
${userNotes || 'No student notes were provided.'}`;
};

export const buildMergePrompt = (
  userNotes,
  className,
  sectionDocs,
  subject,
  { sourceKind = 'audio' } = {},
) => `You are a notes assistant. You have notes for each section of a longer session. Merge them into one complete Tiptap JSON document.

${buildNotePromptContext({
  className,
  subject,
  includeKeyConcepts: false,
  preserveStudentPhrasing: Boolean(userNotes && userNotes.trim()),
  sourceKind,
})}
- Preserve ALL distinct content from every section: every topic, definition, example, and step. Do NOT shorten, summarize, or drop sections — the merged note should be roughly as long as the combined sections minus duplication.
- Remove only duplication introduced at section boundaries: if a term was defined in an earlier section, don't redefine it in a later one.
- Smooth out abrupt transitions only where it helps readability.
- The merged document should read as one coherent, ordered set of study notes.
${HYBRID_NOTE_SHAPE_REQUIREMENTS}

${NOTE_TIPTAP_FORMAT}

Student notes (for context, if any):
${userNotes || 'No student notes were provided.'}

Section notes JSON array:
${JSON.stringify(sectionDocs)}`;

export const buildYoutubeSourcePrompt = (className, subject, sourceText) => `You are an expert academic note taker watching an educational YouTube video.
Produce natural, complete notes as a Tiptap JSON document that can be reused to generate other study materials.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: false,
  sourceKind: 'video',
})}
- Be detailed enough that the saved notes can support later flashcards, guides, or exams.
${HYBRID_NOTE_SHAPE_REQUIREMENTS}

${NOTE_TIPTAP_FORMAT}`;

export const buildSinglePassNoteGeneratePrompt = (className, subject, sourceText, { sourceKind = 'audio' } = {}) => {
  const sourceLabel = resolveSourceLabel(sourceKind);
  return `You are a notes assistant. Given ${sourceLabel}, produce study-ready notes as a Tiptap JSON document that satisfies the content contract below.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: false,
  sourceKind,
})}
- Cover the main ideas, definitions, examples, and steps from ${sourceLabel}.
- Organize with H2 headings for major topics and H3 for sub-topics. A student scanning this should be able to tell at a glance what was covered.
- Use selective bullet clusters, short examples, and compact "why it matters" notes instead of continuous essay paragraphs.
${HYBRID_NOTE_SHAPE_REQUIREMENTS}

${NOTE_TIPTAP_FORMAT}`;
};

export const buildSinglePassNoteEnhancePrompt = (userNotes, className, subject, sourceText, { sourceKind = 'audio' } = {}) => {
  const sourceLabel = resolveSourceLabel(sourceKind);
  return `You are a notes assistant. Expand the student's notes using ${sourceLabel} as context, so the result satisfies the content contract below.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: true,
  sourceKind,
})}
- Keep the student's voice where it already works, and keep every point they wrote.
- Fill gaps from ${sourceLabel} with high-confidence details, definitions, and examples until every bolded term has a definition and every concept has an example.
- Preserve notebook energy where possible, but restructure flat prose into scan-friendly study chunks.
- Use headings, compact bullets, short examples, and quick review cues so the result reads like real student study notes rather than a polished essay.
${HYBRID_NOTE_SHAPE_REQUIREMENTS}

${NOTE_TIPTAP_FORMAT}

Student notes:
${userNotes || 'No student notes were provided.'}`;
};
