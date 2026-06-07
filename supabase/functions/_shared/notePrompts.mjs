import { buildNaturalNoteStyleInstructions, buildSubjectContext } from './aiCore.mjs';
import { resolveNoteStrategy } from './subjectStrategies.mjs';

const NOTE_TIPTAP_FORMAT = `Output ONLY valid JSON: { "type": "doc", "content": [...] }. No markdown/backticks outside JSON.
Node types: heading (attrs.level 1-3), paragraph, bulletList→listItem→paragraph, orderedList→listItem→paragraph, blockquote→paragraph, horizontalRule.
Table: { "type": "table", "content": [ tableRow ] } where each tableRow contains tableHeader (header row) or tableCell nodes each wrapping a paragraph. Use tables ONLY for genuine comparisons (e.g. comparing concepts, listing properties side-by-side). Do not replace bullet lists with tables.
Text marks: { "type": "text", "marks": [{ "type": "bold" }], "text": "..." } (also: italic, code).`;

const buildNotePromptContext = ({
  className,
  subject,
  sourceText,
  includeKeyConcepts = false,
  preserveStudentPhrasing = true,
  allowMethodSummary = true,
} = {}) => {
  const noteStrategy = resolveNoteStrategy({ className, subject, sourceText });
  const sectionSummaryRule = noteStrategy.allowsSummary && !allowMethodSummary
    ? '\n- For this section draft, omit the final Review Summary; the merged complete note handles it.'
    : '';

  return `${buildSubjectContext(className ?? undefined, subject ?? undefined)}

${buildNaturalNoteStyleInstructions({
  includeKeyConcepts,
  preserveStudentPhrasing,
  allowReviewSummary: noteStrategy.allowsSummary && allowMethodSummary,
})}

${noteStrategy.promptInstructions}${sectionSummaryRule}`;
};

export const buildNoteDraftPrompt = (userNotes, className, subject, sourceText) => `You are a lecture notes assistant producing a fast first draft as a Tiptap JSON document.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: true,
})}

Goal: produce a usable first pass quickly.
- Fill only the highest-confidence gaps from the lecture audio.
- Capture the main ideas in a way the student could realistically have written after class.
- Keep the structure selective and practical rather than exhaustive.

${NOTE_TIPTAP_FORMAT}

Student notes:
${userNotes || 'No student notes were provided.'}`;

export const buildNoteEnrichPrompt = (userNotes, className, draftDoc, subject, sourceText) => `You are a lecture notes assistant refining an existing draft into a complete set of natural, study-ready notes as Tiptap JSON.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: true,
})}
- Preserve the structure and strongest wording of the draft unless accuracy requires revision.
- Keep the best parts of the student's original notes.
- Add missing terms, definitions, examples, and connective explanation wherever the content contract is not yet satisfied.

${NOTE_TIPTAP_FORMAT}

Student notes:
${userNotes || 'No student notes were provided.'}

Current draft JSON:
${JSON.stringify(draftDoc)}`;

export const buildSectionNotePrompt = (
  sectionIndex,
  totalSections,
  userNotes,
  className,
  subject,
  sourceText,
) => `You are a lecture notes assistant. Given a transcript excerpt from a lecture, produce notes as a Tiptap JSON document for this section only.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: true,
  allowMethodSummary: false,
})}

This is section ${sectionIndex + 1} of ${totalSections} from a longer lecture.
- Keep this section self-contained and focused on the material covered here.
- Use H2 or H3 headings only when they help organize the section.
- Capture concrete ideas, definitions, and examples without adding filler.

${NOTE_TIPTAP_FORMAT}

Student notes (for context, if any):
${userNotes || 'No student notes were provided.'}`;

export const buildMergePrompt = (
  userNotes,
  className,
  sectionDocs,
  subject,
) => `You are a lecture notes assistant. You have notes for each section of a lecture. Merge them into one complete, polished Tiptap JSON document.

${buildNotePromptContext({
  className,
  subject,
  includeKeyConcepts: false,
  preserveStudentPhrasing: true,
})}
- Preserve the structure and strongest wording of each section's notes.
- Remove duplication introduced at section boundaries: if a term was defined in an earlier section, don't redefine it in a later one.
- Smooth out abrupt transitions only where it helps readability.
- The merged document should read as one coherent, ordered set of study notes.

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
  includeKeyConcepts: true,
  preserveStudentPhrasing: false,
})}
- Be detailed enough that the saved notes can support later flashcards, guides, or exams.

${NOTE_TIPTAP_FORMAT}`;

export const buildSinglePassNoteGeneratePrompt = (className, subject, sourceText) => `You are a lecture notes assistant. Given the lecture transcription, produce study-ready notes as a Tiptap JSON document that satisfies the content contract below.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: false,
})}
- Cover the main ideas, definitions, examples, and steps from the lecture.
- Organize with H2 headings for major topics and H3 for sub-topics. A student scanning this should be able to tell at a glance what was covered.

${NOTE_TIPTAP_FORMAT}`;

export const buildSinglePassNoteEnhancePrompt = (userNotes, className, subject, sourceText) => `You are a lecture notes assistant. Expand the student's notes using the lecture transcription as context, so the result satisfies the content contract below.

${buildNotePromptContext({
  className,
  subject,
  sourceText,
  includeKeyConcepts: false,
  preserveStudentPhrasing: true,
})}
- Keep the student's voice where it already works.
- Fill gaps from the transcription with high-confidence details, definitions, and examples until every bolded term has a definition and every concept has an example.

${NOTE_TIPTAP_FORMAT}

Student notes:
${userNotes || 'No student notes were provided.'}`;
