export const STUDY_GUIDE_FORMAT_VERSION = 2;
export const STUDY_GUIDE_CONFIDENCE_VALUES = ['need_work', 'okay', 'know_it'];

const normalizeText = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeOptionalText = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeStringArray = (value, maxItems = 8) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeOptionalText(item))
    .filter(Boolean)
    .slice(0, maxItems);
};

const slugify = (value, fallback) => {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const ensureUniqueId = (candidate, usedIds, fallback) => {
  let nextId = slugify(candidate, fallback);
  let suffix = 2;

  while (usedIds.has(nextId)) {
    nextId = `${slugify(candidate, fallback)}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
};

const normalizeMiniQuizItem = (item, index) => {
  if (typeof item === 'string') {
    const prompt = normalizeOptionalText(item);
    if (!prompt) return null;
    return { prompt, answer: '' };
  }

  if (!item || typeof item !== 'object') return null;

  const prompt = normalizeText(
    item.prompt ?? item.question ?? item.q,
    `Checkpoint ${index + 1}`,
  );
  const answer = normalizeText(item.answer ?? item.expected_answer ?? item.a, '');

  return { prompt, answer };
};

const normalizeSection = (section, index, usedIds) => {
  if (!section || typeof section !== 'object') return null;

  const title = normalizeText(section.title, `Section ${index + 1}`);
  const answerPoints = normalizeStringArray(
    section.answer_points ?? section.answerPoints ?? section.key_points,
    8,
  );
  const recallPrompt = normalizeText(
    section.recall_prompt ?? section.recallPrompt ?? section.prompt ?? section.question,
    `Explain ${title} from memory before checking the answer.`,
  );
  const keyTerms = normalizeStringArray(section.key_terms ?? section.keyTerms, 10);
  const commonTraps = normalizeStringArray(section.common_traps ?? section.commonTraps, 6);
  const miniQuiz = Array.isArray(section.mini_quiz ?? section.miniQuiz)
    ? (section.mini_quiz ?? section.miniQuiz)
      .map(normalizeMiniQuizItem)
      .filter(Boolean)
      .slice(0, 4)
    : [];

  if (!title && answerPoints.length === 0 && keyTerms.length === 0) {
    return null;
  }

  return {
    id: ensureUniqueId(section.id ?? title, usedIds, `section-${index + 1}`),
    title,
    recall_prompt: recallPrompt,
    answer_points: answerPoints,
    key_terms: keyTerms,
    mini_quiz: miniQuiz,
    common_traps: commonTraps,
  };
};

export const normalizeStudyGuideData = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  const usedIds = new Set();
  const sections = rawSections
    .map((section, index) => normalizeSection(section, index, usedIds))
    .filter(Boolean);

  if (sections.length === 0) {
    return null;
  }

  return {
    overview: normalizeText(raw.overview ?? raw.summary, 'Review each section actively before revealing the answers.'),
    sections,
  };
};

const buildDefaultSectionState = () => ({
  revealed: false,
  confidence: null,
  completed: false,
  note: '',
});

const normalizeConfidence = (value) => (
  STUDY_GUIDE_CONFIDENCE_VALUES.includes(value) ? value : null
);

export const createDefaultStudyGuideState = (guideData) => {
  const sections = Array.isArray(guideData?.sections) ? guideData.sections : [];
  const sectionStates = Object.fromEntries(
    sections.map((section) => [section.id, buildDefaultSectionState()]),
  );

  return {
    current_section_id: sections[0]?.id ?? null,
    section_states: sectionStates,
    last_reviewed_at: null,
  };
};

export const normalizeStudyGuideState = (guideData, value) => {
  const defaults = createDefaultStudyGuideState(guideData);
  const raw = value && typeof value === 'object' ? value : {};
  const sections = Array.isArray(guideData?.sections) ? guideData.sections : [];

  const sectionStates = Object.fromEntries(
    sections.map((section) => {
      const incoming = raw.section_states?.[section.id] ?? {};
      return [
        section.id,
        {
          revealed: Boolean(incoming.revealed),
          confidence: normalizeConfidence(incoming.confidence),
          completed: Boolean(incoming.completed),
          note: typeof incoming.note === 'string' ? incoming.note : '',
        },
      ];
    }),
  );

  const requestedCurrent = normalizeOptionalText(raw.current_section_id);
  const fallbackCurrent = sections.find((section) => !sectionStates[section.id]?.completed)?.id
    ?? defaults.current_section_id;
  const currentSectionId = requestedCurrent && sectionStates[requestedCurrent]
    ? requestedCurrent
    : fallbackCurrent;

  return {
    current_section_id: currentSectionId,
    section_states: sectionStates,
    last_reviewed_at: normalizeOptionalText(raw.last_reviewed_at),
  };
};

const textNode = (text, marks = undefined) => (
  marks ? { type: 'text', text, marks } : { type: 'text', text }
);

const paragraphNode = (content) => ({
  type: 'paragraph',
  content: content.filter(Boolean),
});

const headingNode = (level, text) => ({
  type: 'heading',
  attrs: { level },
  content: [textNode(text)],
});

const bulletListNode = (items) => ({
  type: 'bulletList',
  content: items.map((item) => ({
    type: 'listItem',
    content: [paragraphNode([textNode(item)])],
  })),
});

const orderedListNode = (items) => ({
  type: 'orderedList',
  attrs: { start: 1 },
  content: items.map((item) => ({
    type: 'listItem',
    content: [paragraphNode(item.content)],
  })),
});

export const buildStudyGuideSummaryDoc = (guideData) => {
  const normalized = normalizeStudyGuideData(guideData);
  if (!normalized) {
    return { type: 'doc', content: [] };
  }

  const content = [
    headingNode(1, 'Active Recall Workbook'),
    paragraphNode([textNode(normalized.overview)]),
  ];

  normalized.sections.forEach((section, index) => {
    content.push(headingNode(2, `${index + 1}. ${section.title}`));
    content.push(paragraphNode([
      textNode('Recall prompt: ', [{ type: 'bold' }]),
      textNode(section.recall_prompt),
    ]));

    if (section.answer_points.length > 0) {
      content.push(headingNode(3, 'Answer Points'));
      content.push(bulletListNode(section.answer_points));
    }

    if (section.key_terms.length > 0) {
      content.push(paragraphNode([
        textNode('Key terms: ', [{ type: 'bold' }]),
        textNode(section.key_terms.join(', ')),
      ]));
    }

    if (section.mini_quiz.length > 0) {
      content.push(headingNode(3, 'Mini Quiz'));
      content.push(orderedListNode(
        section.mini_quiz.map((item) => ({
          content: [
            textNode(`Q: ${item.prompt}`, [{ type: 'bold' }]),
            ...(item.answer ? [textNode(` A: ${item.answer}`)] : []),
          ],
        })),
      ));
    }

    if (section.common_traps.length > 0) {
      content.push(headingNode(3, 'Common Traps'));
      content.push(bulletListNode(section.common_traps));
    }
  });

  return { type: 'doc', content };
};

export const studyGuideDataToPlainText = (guideData) => {
  const normalized = normalizeStudyGuideData(guideData);
  if (!normalized) return '';

  return [
    `Overview:\n${normalized.overview}`,
    ...normalized.sections.map((section, index) => {
      const parts = [
        `Section ${index + 1}: ${section.title}`,
        `Recall Prompt: ${section.recall_prompt}`,
      ];

      if (section.answer_points.length > 0) {
        parts.push(`Answer Points:\n${section.answer_points.map((point) => `- ${point}`).join('\n')}`);
      }

      if (section.key_terms.length > 0) {
        parts.push(`Key Terms: ${section.key_terms.join(', ')}`);
      }

      if (section.mini_quiz.length > 0) {
        parts.push(`Mini Quiz:\n${section.mini_quiz.map((item) => `- ${item.prompt}${item.answer ? ` -> ${item.answer}` : ''}`).join('\n')}`);
      }

      if (section.common_traps.length > 0) {
        parts.push(`Common Traps:\n${section.common_traps.map((item) => `- ${item}`).join('\n')}`);
      }

      return parts.join('\n');
    }),
  ].join('\n\n');
};

