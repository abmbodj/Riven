const DEFINITION_MARKERS = [
  ' is ', ' are ', ' means ', ' refers to ', ' denotes ', ' describes ',
  ': ', ' — ', ' – ', ' - ',
];

const RECAP_HEADING_PATTERN = /^\s*(key concepts?|summary|conclusion|recap|in summary|takeaways?|wrap[- ]?up|key takeaways?)\s*$/i;

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

const findRecapHeadings = (doc) => {
  const recaps = [];
  const nodes = Array.isArray(doc?.content) ? doc.content : [];
  for (const node of nodes) {
    if (node?.type !== 'heading') continue;
    const text = collectPlainText(node).trim();
    if (RECAP_HEADING_PATTERN.test(text)) recaps.push(text);
  }
  return recaps;
};

export const validateNoteDoc = (doc) => {
  const issues = [];
  let severity = 0;

  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return { ok: false, severity: 10, issues: ['Document is not a valid Tiptap doc'] };
  }

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

  const recapHeadings = findRecapHeadings(doc);
  if (recapHeadings.length > 0) {
    issues.push(
      `Remove the recap/summary section(s): ${recapHeadings.map((t) => `"${t}"`).join(', ')}. The notes should stand on their own.`,
    );
    severity += 2;
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
    'Rules remain the same: every bolded term needs a plain-language definition immediately after; every concept needs a concrete example; no recap/summary sections; use H2 headings for major topics.',
  ];
  return lines.join('\n');
};
