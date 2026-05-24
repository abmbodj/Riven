import { resolveNoteStrategy } from './subjectStrategies.mjs';

const DEFINITION_MARKERS = [
  ' is ', ' are ', ' means ', ' refers to ', ' denotes ', ' describes ',
  ': ', ' — ', ' – ', ' - ',
];

const RECAP_HEADING_PATTERN = /^\s*(key concepts?|summary|conclusion|recap|in summary|takeaways?|wrap[- ]?up|key takeaways?)\s*$/i;
const REVIEW_SUMMARY_HEADING_PATTERN = /^\s*review summary\s*$/i;
const METHOD_CHECK_MIN_BLOCKS = 4;

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

  const nodes = Array.isArray(doc?.content) ? doc.content : [];
  for (const node of nodes) {
    if (node?.type === 'paragraph') {
      if ((collectPlainText(node) || '').trim().length > 0) topParagraphs++;
    } else if (node?.type === 'heading') {
      headings++;
    } else if (node?.type === 'bulletList' || node?.type === 'orderedList') {
      const items = Array.isArray(node.content) ? node.content : [];
      bulletItems += items.length;
    }
  }
  return { topParagraphs, bulletItems, headings };
};

const findRecapHeadings = (doc, allowsSummary) => {
  const recaps = [];
  const nodes = Array.isArray(doc?.content) ? doc.content : [];
  for (const node of nodes) {
    if (node?.type !== 'heading') continue;
    const text = collectPlainText(node).trim();
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

  return issues;
};

export const validateNoteDoc = (doc, options = {}) => {
  const issues = [];
  let severity = 0;

  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return { ok: false, severity: 10, issues: ['Document is not a valid Tiptap doc'] };
  }

  const noteStrategy = resolveValidationStrategy(options);

  const boldFindings = getBoldFirstUses(doc);
  const missingDefinitions = boldFindings.filter((f) => !f.defined).map((f) => f.term);
  if (missingDefinitions.length > 0) {
    issues.push(
      `These bolded terms appear without a definition nearby: ${missingDefinitions.map((t) => `"${t}"`).join(', ')}.`,
    );
    severity += missingDefinitions.length;
  }

  const { topParagraphs, bulletItems, headings } = countStructure(doc);
  const totalContentBlocks = topParagraphs + bulletItems;
  if (totalContentBlocks >= 6) {
    const bulletRatio = bulletItems / totalContentBlocks;
    if (bulletRatio > 0.7) {
      issues.push(
        `The document is ${Math.round(bulletRatio * 100)}% bullet items. Convert some bullets into short explanatory paragraphs that define terms and give examples.`,
      );
      severity += 3;
    }
  }
  if (totalContentBlocks >= 6 && headings === 0) {
    issues.push('No H2 headings. Organize the material under H2 topic headings so a student can scan the structure.');
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
    'Rules remain the same: every bolded term needs a plain-language definition immediately after; every concept needs a concrete example; only include a Review Summary when the selected note method requires it; use H2 headings for major topics.',
  ];
  return lines.join('\n');
};
