export const STUDY_GUIDE_FORMAT_VERSION = 3;
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

const normalizeGuideMeta = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const creationMode = normalizeOptionalText(raw.creation_mode ?? raw.creationMode);
  const examLabel = normalizeOptionalText(raw.exam_label ?? raw.examLabel);
  const examDate = normalizeOptionalText(raw.exam_date ?? raw.examDate);
  const userTopics = normalizeStringArray(raw.user_topics ?? raw.userTopics, 12);
  const weakTopics = normalizeStringArray(raw.user_weak_topics ?? raw.userWeakTopics ?? raw.weakTopics, 12);
  const preferredTone = normalizeOptionalText(raw.preferred_tone ?? raw.preferredTone);

  const normalized = {};

  if (creationMode && ['setup', 'source', 'hybrid'].includes(creationMode)) {
    normalized.creation_mode = creationMode;
  }
  if (examLabel) normalized.exam_label = examLabel;
  if (examDate) normalized.exam_date = examDate;
  if (userTopics.length > 0) normalized.user_topics = userTopics;
  if (weakTopics.length > 0) normalized.user_weak_topics = weakTopics;
  if (preferredTone) normalized.preferred_tone = preferredTone;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const slugify = (value, fallback) => {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const ensureUniqueId = (candidate, usedIds, fallback) => {
  const base = slugify(candidate, fallback);
  let nextId = base;
  let suffix = 2;

  while (usedIds.has(nextId)) {
    nextId = `${base}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
};

const normalizeCheckItem = (item, index) => {
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

const normalizeFlashcard = (item, index) => {
  if (typeof item === 'string') {
    const front = normalizeOptionalText(item);
    if (!front) return null;
    return { front, back: '' };
  }

  if (!item || typeof item !== 'object') return null;

  const front = normalizeText(item.front ?? item.prompt, `Flashcard ${index + 1}`);
  const back = normalizeText(item.back ?? item.answer, '');

  return { front, back };
};

const normalizeKeyTerm = (item) => {
  if (typeof item === 'string') {
    const term = normalizeOptionalText(item);
    return term ? { term, definition: '' } : null;
  }

  if (!item || typeof item !== 'object') return null;

  const term = normalizeOptionalText(item.term ?? item.title ?? item.label);
  if (!term) return null;

  return {
    term,
    definition: normalizeText(item.definition, ''),
  };
};

const normalizeAiHelpers = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    simpler: normalizeText(raw.simpler, ''),
    example: normalizeText(raw.example, ''),
    mnemonic: normalizeText(raw.mnemonic, ''),
  };
};

const normalizeVisual = (value) => {
  if (!value || typeof value !== 'object') return null;

  const type = normalizeOptionalText(value.type);
  if (!['sequence', 'compare', 'process'].includes(type)) return null;

  const steps = normalizeStringArray(value.steps ?? value.items ?? value.points, 6);
  if (steps.length === 0) return null;

  return {
    type,
    title: normalizeText(value.title, ''),
    steps,
  };
};

const normalizeCheckItems = (value) => (
  Array.isArray(value)
    ? value.map(normalizeCheckItem).filter(Boolean).slice(0, 4)
    : []
);

const normalizeFlashcards = (value) => (
  Array.isArray(value)
    ? value.map(normalizeFlashcard).filter(Boolean).slice(0, 6)
    : []
);

const normalizeKeyTerms = (value) => (
  Array.isArray(value)
    ? value.map(normalizeKeyTerm).filter(Boolean).slice(0, 10)
    : []
);

const normalizeV2Section = (section, index, usedIds) => {
  if (!section || typeof section !== 'object') return null;

  const title = normalizeText(section.title, `Section ${index + 1}`);

  return {
    id: ensureUniqueId(section.id ?? title, usedIds, `section-${index + 1}`),
    title,
    summary: normalizeText(
      section.summary,
      normalizeText(section.answer_points?.[0], ''),
    ),
    recall_prompt: normalizeText(
      section.recall_prompt ?? section.recallPrompt ?? section.prompt ?? section.question,
      `Explain ${title} from memory before revealing the answer.`,
    ),
    answer_points: normalizeStringArray(
      section.answer_points ?? section.answerPoints ?? section.key_points,
      8,
    ),
    key_terms: normalizeKeyTerms(section.key_terms ?? section.keyTerms),
    checks: normalizeCheckItems(section.checks ?? section.mini_quiz ?? section.miniQuiz),
    flashcards: normalizeFlashcards(section.flashcards),
    common_traps: normalizeStringArray(section.common_traps ?? section.commonTraps, 6),
    visual: normalizeVisual(section.visual),
    ai_helpers: normalizeAiHelpers(section.ai_helpers),
  };
};

const normalizeV3Subtopic = (topic, subtopic, topicIndex, subtopicIndex, sectionIds) => {
  if (!subtopic || typeof subtopic !== 'object') return null;

  const title = normalizeText(subtopic.title, `Subtopic ${subtopicIndex + 1}`);

  return {
    id: ensureUniqueId(
      subtopic.id ?? title,
      sectionIds,
      `subtopic-${topicIndex + 1}-${subtopicIndex + 1}`,
    ),
    title,
    summary: normalizeText(
      subtopic.summary,
      normalizeText(subtopic.answer_points?.[0], ''),
    ),
    recall_prompt: normalizeText(
      subtopic.recall_prompt ?? subtopic.prompt ?? subtopic.question,
      `Explain ${title} from memory before revealing the answer.`,
    ),
    answer_points: normalizeStringArray(subtopic.answer_points, 8),
    key_terms: normalizeKeyTerms(subtopic.key_terms),
    checks: normalizeCheckItems(subtopic.checks ?? subtopic.mini_quiz),
    flashcards: normalizeFlashcards(subtopic.flashcards),
    common_traps: normalizeStringArray(subtopic.common_traps, 6),
    visual: normalizeVisual(subtopic.visual),
    ai_helpers: normalizeAiHelpers(subtopic.ai_helpers),
  };
};

const flattenGuideSections = (guideData) => {
  if (!guideData || typeof guideData !== 'object' || !Array.isArray(guideData.topics)) {
    return [];
  }

  return guideData.topics.flatMap((topic) => (
    Array.isArray(topic.subtopics)
      ? topic.subtopics.map((subtopic) => ({
        ...subtopic,
        topic_id: topic.id,
        topic_title: topic.title,
      }))
      : []
  ));
};

export const normalizeStudyGuideData = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const overview = normalizeText(
    raw.overview ?? raw.summary,
    'Review each section actively before revealing the answers.',
  );
  const meta = normalizeGuideMeta(raw.meta);

  if (Array.isArray(raw.topics) && raw.topics.length > 0) {
    const topicIds = new Set();
    const sectionIds = new Set();

    const topics = raw.topics.map((topic, topicIndex) => {
      if (!topic || typeof topic !== 'object') return null;

      const title = normalizeText(topic.title, `Topic ${topicIndex + 1}`);
      const topicId = ensureUniqueId(topic.id ?? title, topicIds, `topic-${topicIndex + 1}`);
      const subtopics = Array.isArray(topic.subtopics)
        ? topic.subtopics
          .map((subtopic, subtopicIndex) => normalizeV3Subtopic(
            { ...topic, id: topicId, title },
            subtopic,
            topicIndex,
            subtopicIndex,
            sectionIds,
          ))
          .filter(Boolean)
        : [];

      if (subtopics.length === 0) return null;

      return {
        id: topicId,
        title,
        summary: normalizeText(topic.summary, ''),
        subtopics,
      };
    }).filter(Boolean);

    return topics.length > 0
      ? {
        version: 3,
        overview,
        topics,
        ...(meta ? { meta } : {}),
      }
      : null;
  }

  const sectionIds = new Set();
  const sections = Array.isArray(raw.sections)
    ? raw.sections
      .map((section, index) => normalizeV2Section(section, index, sectionIds))
      .filter(Boolean)
    : [];

  if (sections.length === 0) {
    return null;
  }

  return {
    version: 3,
    overview,
    topics: [
      {
        id: 'topic-general',
        title: 'Study Guide',
        summary: '',
        subtopics: sections,
      },
    ],
    ...(meta ? { meta } : {}),
  };
};

const buildDefaultSectionState = () => ({
  revealed: false,
  confidence: null,
  completed: false,
  note: '',
  last_reviewed_at: null,
  next_review_at: null,
  quiz_correct: 0,
  quiz_total: 0,
  current_difficulty: 'support',
  mastery_score: null,
});

const normalizeConfidence = (value) => (
  STUDY_GUIDE_CONFIDENCE_VALUES.includes(value) ? value : null
);

export const createDefaultStudyGuideState = (guideData) => {
  const sections = flattenGuideSections(normalizeStudyGuideData(guideData));
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
  const normalizedGuideData = normalizeStudyGuideData(guideData);
  const defaults = createDefaultStudyGuideState(normalizedGuideData);
  const raw = value && typeof value === 'object' ? value : {};
  const sections = flattenGuideSections(normalizedGuideData);

  const sectionStates = Object.fromEntries(
    sections.map((section) => {
      const incoming = raw.section_states?.[section.id] ?? {};
      return [
        section.id,
        {
          ...buildDefaultSectionState(),
          revealed: Boolean(incoming.revealed),
          confidence: normalizeConfidence(incoming.confidence),
          completed: Boolean(incoming.completed),
          note: typeof incoming.note === 'string' ? incoming.note : '',
          last_reviewed_at: normalizeOptionalText(incoming.last_reviewed_at),
          next_review_at: normalizeOptionalText(incoming.next_review_at),
          quiz_correct: Number.isFinite(Number(incoming.quiz_correct)) ? Number(incoming.quiz_correct) : 0,
          quiz_total: Number.isFinite(Number(incoming.quiz_total)) ? Number(incoming.quiz_total) : 0,
          current_difficulty: normalizeText(incoming.current_difficulty, 'support'),
          mastery_score: Number.isFinite(Number(incoming.mastery_score)) ? Number(incoming.mastery_score) : null,
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

const keyTermText = (item) => {
  if (!item || typeof item !== 'object') return '';
  return item.definition ? `${item.term}: ${item.definition}` : item.term;
};

export const buildStudyGuideSummaryDoc = (guideData) => {
  const normalized = normalizeStudyGuideData(guideData);
  if (!normalized) {
    return { type: 'doc', content: [] };
  }

  const content = [
    headingNode(1, 'Exam Coach'),
    paragraphNode([textNode(normalized.overview)]),
  ];

  normalized.topics.forEach((topic, topicIndex) => {
    content.push(headingNode(2, `${topicIndex + 1}. ${topic.title}`));

    if (topic.summary) {
      content.push(paragraphNode([textNode(topic.summary)]));
    }

    topic.subtopics.forEach((subtopic, subtopicIndex) => {
      content.push(headingNode(3, `${topicIndex + 1}.${subtopicIndex + 1} ${subtopic.title}`));

      if (subtopic.summary) {
        content.push(paragraphNode([
          textNode('Summary: ', [{ type: 'bold' }]),
          textNode(subtopic.summary),
        ]));
      }

      content.push(paragraphNode([
        textNode('Recall prompt: ', [{ type: 'bold' }]),
        textNode(subtopic.recall_prompt),
      ]));

      if (subtopic.answer_points.length > 0) {
        content.push(headingNode(4, 'Answer Points'));
        content.push(bulletListNode(subtopic.answer_points));
      }

      if (subtopic.key_terms.length > 0) {
        content.push(paragraphNode([
          textNode('Key terms: ', [{ type: 'bold' }]),
          textNode(subtopic.key_terms.map(keyTermText).join(', ')),
        ]));
      }

      if (subtopic.checks.length > 0) {
        content.push(headingNode(4, 'Checks'));
        content.push(orderedListNode(
          subtopic.checks.map((item) => ({
            content: [
              textNode(`Q: ${item.prompt}`, [{ type: 'bold' }]),
              ...(item.answer ? [textNode(` A: ${item.answer}`)] : []),
            ],
          })),
        ));
      }

      if (subtopic.flashcards.length > 0) {
        content.push(headingNode(4, 'Flashcards'));
        content.push(bulletListNode(
          subtopic.flashcards.map((item) => `${item.front}${item.back ? ` -> ${item.back}` : ''}`),
        ));
      }

      if (subtopic.common_traps.length > 0) {
        content.push(headingNode(4, 'Common Traps'));
        content.push(bulletListNode(subtopic.common_traps));
      }
    });
  });

  return { type: 'doc', content };
};

export const studyGuideDataToPlainText = (guideData) => {
  const normalized = normalizeStudyGuideData(guideData);
  if (!normalized) return '';

  return [
    `Overview:\n${normalized.overview}`,
    ...normalized.topics.flatMap((topic, topicIndex) => {
      const topicParts = [`Topic ${topicIndex + 1}: ${topic.title}`];

      if (topic.summary) {
        topicParts.push(`Topic Summary: ${topic.summary}`);
      }

      const subtopicParts = topic.subtopics.map((subtopic, subtopicIndex) => {
        const parts = [
          `Subtopic ${subtopicIndex + 1}: ${subtopic.title}`,
          `Recall Prompt: ${subtopic.recall_prompt}`,
        ];

        if (subtopic.summary) {
          parts.push(`Summary: ${subtopic.summary}`);
        }

        if (subtopic.answer_points.length > 0) {
          parts.push(`Answer Points:\n${subtopic.answer_points.map((point) => `- ${point}`).join('\n')}`);
        }

        if (subtopic.key_terms.length > 0) {
          parts.push(`Key Terms: ${subtopic.key_terms.map(keyTermText).join(', ')}`);
        }

        if (subtopic.checks.length > 0) {
          parts.push(`Checks:\n${subtopic.checks.map((item) => `- ${item.prompt}${item.answer ? ` -> ${item.answer}` : ''}`).join('\n')}`);
        }

        if (subtopic.flashcards.length > 0) {
          parts.push(`Flashcards:\n${subtopic.flashcards.map((item) => `- ${item.front}${item.back ? ` -> ${item.back}` : ''}`).join('\n')}`);
        }

        if (subtopic.common_traps.length > 0) {
          parts.push(`Common Traps:\n${subtopic.common_traps.map((item) => `- ${item}`).join('\n')}`);
        }

        return parts.join('\n');
      });

      return [...topicParts, ...subtopicParts];
    }),
  ].join('\n\n');
};
