import { resolveNoteStrategy } from './subjectStrategies.mjs';

const DEFINITION_MARKERS = [
  ' is ', ' are ', ' means ', ' refers to ', ' denotes ', ' describes ',
  ': ', ' — ', ' – ', ' - ',
];

const RECAP_HEADING_PATTERN = /^\s*(key concepts?|summary|conclusion|recap|in summary|takeaways?|wrap[- ]?up|key takeaways?)\s*$/i;
// Time-sensitive / housekeeping sections are intentionally allowed even though they sit
// near the end like a recap would — they carry signal (deadlines, follow-ups), not filler.
const ALLOWED_SECTION_HEADING_PATTERN = /^\s*(action items?|announcements?|next steps?)\s*$/i;
const REVIEW_SUMMARY_HEADING_PATTERN = /^\s*review summary\s*$/i;
const METHOD_CHECK_MIN_BLOCKS = 4;
const MARKDOWN_LEAK_PATTERN = /(\*\*[^*][\s\S]*?\*\*|__[^_][\s\S]*?__)/;

const collectPlainText = (node) => {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(collectPlainText).join('');
  }
  return '';
};

const hasBoldMark = (textNode) =>
  Array.isArray(textNode?.marks) && textNode.marks.some((m) => m?.type === 'bold');

const firstDefinitionMarkerIndex = (haystack) => {
  for (const marker of DEFINITION_MARKERS) {
    const idx = haystack.indexOf(marker);
    if (idx !== -1) return idx;
  }
  return -1;
};

const isTermDefinedInContext = (sameNodeFollowing, successorIsBlockquote) => {
  if (successorIsBlockquote) return true;
  if (!sameNodeFollowing) return false;
  const windowText = sameNodeFollowing.slice(0, 80);
  if (firstDefinitionMarkerIndex(windowText) !== -1) return true;
  const trimmed = sameNodeFollowing.trim();
  return trimmed.length >= 40;
};

const walkTextRuns = (node, onRun) => {
  if (!node) return;
  if (node.type === 'text') {
    onRun(node);
    return;
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) walkTextRuns(child, onRun);
  }
};

const getBoldFirstUses = (doc) => {
  const seen = new Set();
  const findings = [];

  const visitParagraphLike = (node, successorNode) => {
    const runs = [];
    walkTextRuns(node, (run) => runs.push(run));
    const successorIsBlockquote = successorNode?.type === 'blockquote';

    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      if (!hasBoldMark(run)) continue;
      const term = (run.text || '').trim();
      if (!term || term.length < 2) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const followingSameNode = runs
        .slice(i + 1)
        .filter((r) => !hasBoldMark(r))
        .map((r) => r.text || '')
        .join('');
      findings.push({ term, defined: isTermDefinedInContext(followingSameNode, successorIsBlockquote) });
    }
  };

  const topLevel = Array.isArray(doc?.content) ? doc.content : [];
  for (let i = 0; i < topLevel.length; i++) {
    const node = topLevel[i];
    const next = topLevel[i + 1];

    if (node?.type === 'paragraph') {
      visitParagraphLike(node, next);
    } else if (node?.type === 'bulletList' || node?.type === 'orderedList') {
      const items = Array.isArray(node.content) ? node.content : [];
      for (let j = 0; j < items.length; j++) {
        visitParagraphLike(items[j], items[j + 1] ?? next);
      }
    }
  }

  return findings;
};

const countStructure = (doc) => {
  let topParagraphs = 0;
  let bulletItems = 0;
  let headings = 0;
  let orderedItems = 0;
  let listNodes = 0;

  const nodes = Array.isArray(doc?.content) ? doc.content : [];
  for (const node of nodes) {
    if (node?.type === 'paragraph') {
      if ((collectPlainText(node) || '').trim().length > 0) topParagraphs++;
    } else if (node?.type === 'heading') {
      headings++;
    } else if (node?.type === 'bulletList' || node?.type === 'orderedList') {
      const items = Array.isArray(node.content) ? node.content : [];
      listNodes++;
      bulletItems += items.length;
      if (node?.type === 'orderedList') {
        orderedItems += items.length;
      }
    }
  }
  return { topParagraphs, bulletItems, headings, orderedItems, listNodes };
};

const countWords = (text) => String(text || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .length;

const getTopLevelParagraphMetrics = (doc) => {
  const metrics = [];
  const nodes = Array.isArray(doc?.content) ? doc.content : [];

  for (const node of nodes) {
    if (node?.type !== 'paragraph') continue;
    const text = collectPlainText(node).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    metrics.push({
      text,
      words: countWords(text),
      hasReviewCue: /\b(what matters|why it matters|watch for|what to remember|key shift|remember)\b/i.test(text),
      hasExampleCue: /\b(example|for instance|for example|e\.g\.|such as)\b/i.test(text),
    });
  }

  return metrics;
};

const collectMarkdownLeaks = (doc) => {
  const leaks = [];
  walkTextRuns(doc, (run) => {
    const text = run?.text || '';
    if (MARKDOWN_LEAK_PATTERN.test(text)) {
      leaks.push(text.trim());
    }
  });
  return leaks;
};

const getStructureTolerance = (noteMethod) => {
  if (noteMethod === 'evidence_analysis') {
    return {
      maxLongParagraphs: 3,
      requireLists: false,
      requireReviewCue: false,
    };
  }

  if (noteMethod === 'chronological_causal' || noteMethod === 'cornell') {
    return {
      maxLongParagraphs: 2,
      requireLists: false,
      requireReviewCue: true,
    };
  }

  if (noteMethod === 'meeting_discussion') {
    // Decisions and rationale read as short paragraphs; don't demand review cues or lists.
    return {
      maxLongParagraphs: 2,
      requireLists: false,
      requireReviewCue: false,
    };
  }

  if (noteMethod === 'procedural_skills') {
    // Steps belong in lists, but the "watch for"/"best practice" cues are method-specific,
    // not the generic review cue, so don't force the latter.
    return {
      maxLongParagraphs: 1,
      requireLists: true,
      requireReviewCue: false,
    };
  }

  return {
    maxLongParagraphs: 1,
    requireLists: true,
    requireReviewCue: true,
  };
};

const findRecapHeadings = (doc, allowsSummary) => {
  const recaps = [];
  const nodes = Array.isArray(doc?.content) ? doc.content : [];
  for (const node of nodes) {
    if (node?.type !== 'heading') continue;
    const text = collectPlainText(node).trim();
    if (ALLOWED_SECTION_HEADING_PATTERN.test(text)) continue;
    if (!RECAP_HEADING_PATTERN.test(text)) continue;
    if (allowsSummary && REVIEW_SUMMARY_HEADING_PATTERN.test(text)) continue;
    recaps.push(text);
  }
  return recaps;
};

const hasHeading = (doc, pattern) => {
  const nodes = Array.isArray(doc?.content) ? doc.content : [];
  return nodes.some((node) => node?.type === 'heading' && pattern.test(collectPlainText(node).trim()));
};

const collectDocPlainText = (doc) =>
  collectPlainText(doc).replace(/\s+/g, ' ').trim();

const findHallucinatedTerms = (boldFindings, transcript) => {
  if (typeof transcript !== 'string' || transcript.trim().length === 0) return [];
  const haystack = transcript.toLowerCase();
  const flagged = [];
  for (const { term } of boldFindings) {
    const significantWords = String(term || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3);
    if (significantWords.length === 0) continue; // too short/symbolic to judge
    const grounded = significantWords.some((word) => haystack.includes(word));
    if (!grounded) flagged.push(term);
  }
  return flagged;
};

const resolveValidationStrategy = (options = {}) => {
  if (options.noteMethod) {
    return {
      noteMethod: options.noteMethod,
      allowsSummary: options.allowsSummary ?? options.noteMethod === 'cornell',
    };
  }
  return resolveNoteStrategy({
    className: options.className,
    subject: options.subject,
    sourceText: options.sourceText,
  });
};

const validateMethodShape = ({ doc, noteMethod, allowsSummary, totalContentBlocks }) => {
  if (totalContentBlocks < METHOD_CHECK_MIN_BLOCKS) return [];

  const text = collectDocPlainText(doc);
  const issues = [];

  if (noteMethod === 'worked_examples' && !/\b(worked example|example|for instance|solve|step|given|substitute|therefore|formula|theorem)\b/i.test(text)) {
    issues.push({
      severity: 2,
      message: 'Worked-example notes need at least one example, formula/theorem application, or step-by-step solution pattern.',
    });
  }

  if (noteMethod === 'process_diagram' && !/\b(process map|diagram labels|cycle flow|phase|mechanism|pathway|step|cause|effect)\b|->|→/i.test(text)) {
    issues.push({
      severity: 2,
      message: 'Process notes need a text-first process map, diagram labels, cycle flow, or ordered mechanism/phase structure.',
    });
  }

  if (noteMethod === 'cornell') {
    if (!/\bcue questions?\b|\breview questions?\b|\bquestions to ask\b/i.test(text)) {
      issues.push({
        severity: 2,
        message: 'Cornell notes need cue questions tied to the material.',
      });
    }
    if (allowsSummary && !hasHeading(doc, REVIEW_SUMMARY_HEADING_PATTERN)) {
      issues.push({
        severity: 1,
        message: 'Cornell notes need one H2 heading named "Review Summary" with a 1-2 sentence summary.',
      });
    }
  }

  if (noteMethod === 'concept_map' && !/\b(central idea|branch|relationship|connects to|depends on|contrasts with|leads to)\b|->|→/i.test(text)) {
    issues.push({
      severity: 2,
      message: 'Concept-map notes need a central idea, labeled branches, and explicit relationships between concepts.',
    });
  }

  if (noteMethod === 'procedural_skills' && !/\b(step|first|then|next|how to|procedure|best practice|common mistake|watch for|make sure)\b/i.test(text)) {
    issues.push({
      severity: 2,
      message: 'Procedural notes need an explicit step sequence and at least one best-practice or common-mistake cue.',
    });
  }

  if (noteMethod === 'meeting_discussion' && !/\b(decision|decided|agreed|owner|assigned|action item|next step|follow[- ]?up|open question)\b/i.test(text)) {
    issues.push({
      severity: 2,
      message: 'Meeting notes need explicit decisions, owners, or action items rather than a running transcript summary.',
    });
  }

  if (noteMethod === 'language_learning' && !/\b(vocabulary|vocab|grammar|conjugat|example sentence|translation|rule)\b/i.test(text)) {
    issues.push({
      severity: 2,
      message: 'Language notes need grouped vocabulary, grammar rules, or example sentences with translations.',
    });
  }

  return issues;
};

export const validateNoteDoc = (doc, options = {}) => {
  const issues = [];
  let severity = 0;

  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return { ok: false, severity: 10, issues: ['Document is not a valid Tiptap doc'] };
  }

  const noteStrategy = resolveValidationStrategy(options);
  const markdownLeaks = collectMarkdownLeaks(doc);
  if (markdownLeaks.length > 0) {
    issues.push(
      `Literal markdown styling leaked into the note text. Replace sequences like ${markdownLeaks.slice(0, 2).map((text) => `"${text}"`).join(', ')} with proper Tiptap marks.`,
    );
    severity += 4;
  }

  const boldFindings = getBoldFirstUses(doc);
  const missingDefinitions = boldFindings.filter((f) => !f.defined).map((f) => f.term);
  if (missingDefinitions.length > 0) {
    issues.push(
      `These bolded terms appear without a definition nearby: ${missingDefinitions.map((t) => `"${t}"`).join(', ')}.`,
    );
    severity += missingDefinitions.length;
  }

  // Transcript fidelity: a bolded key term should be grounded in what was actually said.
  // Conservative — a term is "grounded" if ANY significant word in it appears in the transcript,
  // so legitimately-added examples/definitions don't trip the check; only fully-absent terms flag.
  const hallucinatedTerms = findHallucinatedTerms(boldFindings, options.transcript);
  if (hallucinatedTerms.length > 0) {
    issues.push(
      `These bolded terms do not appear in the lecture transcript and may be hallucinated — remove or correct them: ${hallucinatedTerms.map((t) => `"${t}"`).join(', ')}.`,
    );
    // Weighted below a 1:1 contribution and capped: a legitimate garbled-term reconstruction
    // (the corrected term won't appear verbatim in the transcript) must not, on its own, push
    // severity over the retry threshold and trigger a needless rewrite. Heavy hallucination
    // still contributes, and combines with other contract breaks to force a retry.
    severity += Math.min(3, Math.ceil(hallucinatedTerms.length / 2));
  }

  const { topParagraphs, bulletItems, headings, orderedItems, listNodes } = countStructure(doc);
  const totalContentBlocks = topParagraphs + bulletItems;
  const paragraphMetrics = getTopLevelParagraphMetrics(doc);
  const longParagraphs = paragraphMetrics.filter((entry) => entry.words >= 55);
  const reviewCueParagraphs = paragraphMetrics.filter((entry) => entry.hasReviewCue);
  const exampleCueParagraphs = paragraphMetrics.filter((entry) => entry.hasExampleCue);
  const structureTolerance = getStructureTolerance(noteStrategy.noteMethod);

  if (totalContentBlocks >= 6) {
    const bulletRatio = bulletItems / totalContentBlocks;
    if (bulletRatio > 0.7) {
      issues.push(
        `The document is ${Math.round(bulletRatio * 100)}% bullet items. Convert some bullets into short explanatory paragraphs that define terms and give examples.`,
      );
      severity += 3;
    }
  }
  if (totalContentBlocks >= 5 && headings === 0) {
    issues.push('No H2 headings. Organize the material under H2 topic headings so a student can scan the structure.');
    severity += 2;
  }
  if (totalContentBlocks >= 5 && headings < Math.max(1, Math.floor(totalContentBlocks / 5))) {
    issues.push('Too few headings for the amount of material. Break the lecture into more obvious topic sections instead of letting it read as one continuous block.');
    severity += 2;
  }
  if (longParagraphs.length > structureTolerance.maxLongParagraphs) {
    issues.push(
      `There are ${longParagraphs.length} long top-level paragraphs. Split essay-like prose into shorter note blocks, bullets, examples, or step lists.`,
    );
    severity += 3;
  }
  if (totalContentBlocks >= 5 && listNodes === 0 && structureTolerance.requireLists) {
    issues.push('The note has no bullet or step clusters. Add concise lists for facts, steps, examples, or comparisons so it reads like study notes instead of an essay.');
    severity += 3;
  }
  if (totalContentBlocks >= 5 && reviewCueParagraphs.length === 0 && structureTolerance.requireReviewCue) {
    issues.push('Add at least one compact review cue such as "Why it matters", "What to remember", or "Watch for" so the note is easier to review quickly.');
    severity += 2;
  }
  if (topParagraphs >= 5 && bulletItems === 0 && exampleCueParagraphs.length === 0) {
    issues.push('The note is repeating prose-only explanation without enough examples, steps, or note-style chunking. Add concrete examples or structured sub-blocks.');
    severity += 3;
  }
  if (noteStrategy.noteMethod === 'process_diagram' && totalContentBlocks >= 5 && orderedItems === 0) {
    issues.push('Process notes need at least one ordered sequence or step-based block so the flow can be reviewed quickly.');
    severity += 2;
  }

  const recapHeadings = findRecapHeadings(doc, noteStrategy.allowsSummary);
  if (recapHeadings.length > 0) {
    issues.push(
      `Remove the recap/summary section(s): ${recapHeadings.map((t) => `"${t}"`).join(', ')}. The notes should stand on their own.`,
    );
    severity += 2;
  }

  const methodIssues = validateMethodShape({
    doc,
    noteMethod: noteStrategy.noteMethod,
    allowsSummary: noteStrategy.allowsSummary,
    totalContentBlocks,
  });
  for (const issue of methodIssues) {
    issues.push(issue.message);
    severity += issue.severity;
  }

  return { ok: severity === 0, severity, issues };
};

export const buildRetryInstruction = (findings) => {
  if (!findings.issues.length) return '';
  const lines = [
    'Your previous draft violated the content contract. Fix every issue below and re-emit the FULL corrected Tiptap JSON document (not a diff):',
    '',
    ...findings.issues.map((issue, idx) => `${idx + 1}. ${issue}`),
    '',
    'Rules remain the same: every bolded term needs a plain-language definition immediately after; every concept needs a concrete example; only include a Review Summary when the selected note method requires it; use H2 headings for major topics; and never emit literal markdown markers like **term** inside text nodes.',
  ];
  return lines.join('\n');
};
