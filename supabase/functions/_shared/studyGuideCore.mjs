export const STUDY_GUIDE_FORMAT_VERSION = 4;

const DEFAULT_RIVER_NAME = 'River';
const DEFAULT_SOURCE_MODE = 'hybrid';
const DEFAULT_ESTIMATED_MINUTES = 12;

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

const normalizeStringArray = (value, maxItems = 12) => (
  Array.isArray(value)
    ? value
      .map((item) => normalizeOptionalText(item))
      .filter(Boolean)
      .slice(0, maxItems)
    : []
);

const clampNumber = (value, { min = 0, max = 100, fallback = 0 } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
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

const normalizeSessionMeta = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const examContextRaw = raw.exam_context && typeof raw.exam_context === 'object'
    ? raw.exam_context
    : {};
  const sourceMode = normalizeOptionalText(raw.source_mode ?? raw.sourceMode);
  const estimatedMinutes = clampNumber(
    raw.estimated_minutes ?? raw.estimatedMinutes,
    { min: 1, max: 240, fallback: DEFAULT_ESTIMATED_MINUTES },
  );

  return {
    subject: normalizeText(raw.subject, 'General Study'),
    student_goal: normalizeText(raw.student_goal ?? raw.goal, 'Build durable understanding'),
    student_level: normalizeText(raw.student_level ?? raw.level, 'intermediate'),
    exam_context: {
      label: normalizeText(examContextRaw.label, ''),
      date: normalizeText(examContextRaw.date, ''),
    },
    source_mode: ['setup', 'source', 'hybrid'].includes(sourceMode)
      ? sourceMode
      : DEFAULT_SOURCE_MODE,
    estimated_minutes: estimatedMinutes,
    preferred_tutor_tone: normalizeText(
      raw.preferred_tutor_tone ?? raw.preferredTutorTone,
      'calm, precise, encouraging',
    ),
    focus_topics: normalizeStringArray(raw.focus_topics ?? raw.focusTopics),
    weak_topics: normalizeStringArray(raw.weak_topics ?? raw.weakTopics),
  };
};

const normalizeCue = (value, fallback = {}) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    expression: normalizeText(raw.expression, normalizeText(fallback.expression, 'blink_soft')),
    animation: normalizeText(raw.animation, normalizeText(fallback.animation, 'tail_sway_idle')),
  };
};

const normalizeCueMap = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    idle: normalizeCue(raw.idle, { expression: 'blink_soft', animation: 'tail_sway_idle' }),
    focus: normalizeCue(raw.focus, { expression: 'focus_lean_in', animation: 'ear_tilt_curious' }),
    recover: normalizeCue(raw.recover, { expression: 'soft_concern_mistake', animation: 'paw_point_hint' }),
    mastery: normalizeCue(raw.mastery, { expression: 'whisker_pride', animation: 'sparkle_mastery' }),
  };
};

const normalizeDialogueVariants = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    opening: normalizeStringArray(raw.opening, 4),
    encouragement: normalizeStringArray(raw.encouragement, 4),
    recovery: normalizeStringArray(raw.recovery, 4),
    mastery: normalizeStringArray(raw.mastery, 4),
  };
};

const normalizeRiver = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    name: normalizeText(raw.name, DEFAULT_RIVER_NAME),
    species: normalizeText(raw.species, 'grey cat'),
    style: normalizeText(raw.style, 'premium svg mascot'),
    tone: normalizeText(raw.tone, 'calm, intelligent, reassuring'),
    default_expression: normalizeText(raw.default_expression, 'blink_soft'),
    default_animation: normalizeText(raw.default_animation, 'tail_sway_idle'),
    cue_map: normalizeCueMap(raw.cue_map ?? raw.cueMap),
    dialogue_variants: normalizeDialogueVariants(raw.dialogue_variants ?? raw.dialogueVariants),
  };
};

const normalizeConcept = (value, index, usedIds) => {
  if (!value || typeof value !== 'object') return null;

  const title = normalizeText(value.title, `Concept ${index + 1}`);
  const id = ensureUniqueId(value.id ?? title, usedIds, `concept-${index + 1}`);

  return {
    id,
    title,
    summary: normalizeText(value.summary, ''),
    depends_on: normalizeStringArray(value.depends_on ?? value.dependsOn),
    weak_points: normalizeStringArray(value.weak_points ?? value.weakPoints),
    misconception_tags: normalizeStringArray(
      value.misconception_tags ?? value.misconceptions,
    ),
  };
};

const normalizeKnowledgeMap = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const usedIds = new Set();
  const concepts = Array.isArray(raw.concepts)
    ? raw.concepts
      .map((concept, index) => normalizeConcept(concept, index, usedIds))
      .filter(Boolean)
    : [];

  return concepts.length > 0 ? { concepts } : null;
};

const normalizeCardHint = (value, index) => {
  if (!value || typeof value !== 'object') return null;

  return {
    level: clampNumber(value.level, { min: 1, max: 5, fallback: index + 1 }),
    text: normalizeText(value.text, `Hint ${index + 1}`),
    cue: normalizeCue(value.cue, { expression: 'paw_point_hint', animation: 'ear_tilt_curious' }),
  };
};

const normalizeMisconceptionFeedback = (value) => {
  if (!value || typeof value !== 'object') return null;
  const misconceptionId = normalizeOptionalText(value.misconception_id ?? value.misconceptionId);
  if (!misconceptionId) return null;

  return {
    misconception_id: misconceptionId,
    responses: normalizeStringArray(value.responses, 4),
  };
};

const normalizeCardFeedback = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    correct: normalizeStringArray(raw.correct, 4),
    partial: normalizeStringArray(raw.partial, 4),
    incorrect: normalizeStringArray(raw.incorrect, 4),
    empty: normalizeStringArray(raw.empty, 4),
    misconception: Array.isArray(raw.misconception)
      ? raw.misconception.map(normalizeMisconceptionFeedback).filter(Boolean).slice(0, 6)
      : [],
  };
};

const normalizeCardTransitions = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const normalizeTransition = (candidate) => {
    const normalized = normalizeOptionalText(candidate);
    if (!normalized) return null;
    if (['retry', 'hint'].includes(normalized)) return normalized;
    return normalized;
  };

  return {
    on_correct: normalizeTransition(raw.on_correct ?? raw.onCorrect),
    on_partial: normalizeTransition(raw.on_partial ?? raw.onPartial) ?? 'retry',
    on_incorrect: normalizeTransition(raw.on_incorrect ?? raw.onIncorrect) ?? 'hint',
    on_struggle: normalizeTransition(raw.on_struggle ?? raw.onStruggle) ?? 'retry',
  };
};

const normalizeCardRiver = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    intro: normalizeText(raw.intro, ''),
    success: normalizeText(raw.success, ''),
    struggle: normalizeText(raw.struggle, ''),
  };
};

const normalizeCard = (value, index, usedIds, conceptIds) => {
  if (!value || typeof value !== 'object') return null;

  const prompt = normalizeText(value.prompt, '');
  const targetAnswer = normalizeText(value.target_answer ?? value.targetAnswer, '');
  const conceptId = normalizeOptionalText(value.concept_id ?? value.conceptId);

  if (!prompt || !targetAnswer || !conceptId || !conceptIds.has(conceptId)) {
    return null;
  }

  return {
    id: ensureUniqueId(value.id ?? prompt, usedIds, `card-${index + 1}`),
    concept_id: conceptId,
    phase: normalizeText(value.phase, 'diagnostic'),
    difficulty: normalizeText(value.difficulty, 'medium'),
    card_type: normalizeText(value.card_type ?? value.cardType, 'short_answer'),
    prompt,
    target_answer: targetAnswer,
    required_idea_tags: normalizeStringArray(
      value.required_idea_tags ?? value.requiredIdeaTags,
    ),
    optional_idea_tags: normalizeStringArray(
      value.optional_idea_tags ?? value.optionalIdeaTags,
    ),
    misconception_tags: normalizeStringArray(
      value.misconception_tags ?? value.misconceptions,
    ),
    hints: Array.isArray(value.hints)
      ? value.hints.map(normalizeCardHint).filter(Boolean).slice(0, 4)
      : [],
    feedback: normalizeCardFeedback(value.feedback),
    river: normalizeCardRiver(value.river),
    transitions: normalizeCardTransitions(value.transitions),
    mastery_weight: clampNumber(
      value.mastery_weight ?? value.masteryWeight,
      { min: 1, max: 5, fallback: 1 },
    ),
  };
};

const normalizeTagSynonyms = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    Object.entries(raw)
      .map(([tag, synonyms]) => [
        tag,
        normalizeStringArray(Array.isArray(synonyms) ? synonyms : [], 12),
      ])
      .filter(([, synonyms]) => synonyms.length > 0),
  );
};

const normalizeMisconceptionRule = (value, index) => {
  if (!value || typeof value !== 'object') return null;

  const id = normalizeOptionalText(value.id) || `misconception-${index + 1}`;

  return {
    id,
    concept_id: normalizeText(value.concept_id ?? value.conceptId, ''),
    trigger_phrases: normalizeStringArray(
      value.trigger_phrases ?? value.triggerPhrases,
      12,
    ),
    correction: normalizeText(value.correction, ''),
  };
};

const normalizeEvaluationRules = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const scoreBands = raw.score_bands && typeof raw.score_bands === 'object'
    ? raw.score_bands
    : {};

  return {
    score_bands: {
      correct: clampNumber(scoreBands.correct, { min: 0, max: 1, fallback: 0.85 }),
      partial: clampNumber(scoreBands.partial, { min: 0, max: 1, fallback: 0.4 }),
    },
    empty_patterns: normalizeStringArray(raw.empty_patterns ?? raw.emptyPatterns, 12),
    tag_synonyms: normalizeTagSynonyms(raw.tag_synonyms ?? raw.tagSynonyms),
    misconception_rules: Array.isArray(raw.misconception_rules ?? raw.misconceptionRules)
      ? (raw.misconception_rules ?? raw.misconceptionRules)
        .map(normalizeMisconceptionRule)
        .filter(Boolean)
        .slice(0, 20)
      : [],
  };
};

const normalizePerformanceBand = (key, value, fallback) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    key,
    mastery_below: clampNumber(raw.mastery_below ?? raw.masteryBelow, {
      min: 0,
      max: 101,
      fallback,
    }),
    river_expression: normalizeText(
      raw.river_expression ?? raw.riverExpression,
      key === 'struggling'
        ? 'soft_concern_mistake'
        : key === 'mastery'
          ? 'whisker_pride'
          : 'focus_lean_in',
    ),
    river_animation: normalizeText(
      raw.river_animation ?? raw.riverAnimation,
      key === 'struggling'
        ? 'paw_point_hint'
        : key === 'mastery'
          ? 'sparkle_mastery'
          : 'ear_tilt_curious',
    ),
  };
};

const normalizeAdaptationRules = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  const bandsRaw = raw.performance_bands ?? raw.performanceBands;

  return {
    max_attempts_before_recovery: clampNumber(
      raw.max_attempts_before_recovery ?? raw.maxAttemptsBeforeRecovery,
      { min: 1, max: 5, fallback: 2 },
    ),
    max_hints_per_card: clampNumber(
      raw.max_hints_per_card ?? raw.maxHintsPerCard,
      { min: 0, max: 5, fallback: 2 },
    ),
    performance_bands: {
      struggling: normalizePerformanceBand('struggling', bandsRaw?.struggling, 45),
      steady: normalizePerformanceBand('steady', bandsRaw?.steady, 80),
      mastery: normalizePerformanceBand('mastery', bandsRaw?.mastery, 101),
    },
  };
};

const normalizeCompletion = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    title: normalizeText(raw.title, 'Session complete'),
    mastery_message: normalizeText(raw.mastery_message ?? raw.masteryMessage, ''),
    confidence_close: normalizeText(raw.confidence_close ?? raw.confidenceClose, ''),
    next_review_message: normalizeText(raw.next_review_message ?? raw.nextReviewMessage, ''),
    river_cue: normalizeCue(raw.river_cue ?? raw.riverCue, {
      expression: 'whisker_pride',
      animation: 'sparkle_mastery',
    }),
  };
};

const deriveSections = (concepts, cards) => (
  concepts.map((concept) => {
    const conceptCards = cards.filter((card) => card.concept_id === concept.id);
    const answerPoints = conceptCards
      .map((card) => card.target_answer)
      .filter(Boolean)
      .slice(0, 4);
    const checks = conceptCards.slice(0, 4).map((card) => ({
      prompt: card.prompt,
      answer: card.target_answer,
    }));
    const flashcards = conceptCards.slice(0, 4).map((card) => ({
      front: card.prompt,
      back: card.target_answer,
    }));

    return {
      id: concept.id,
      topic_id: concept.id,
      topic_title: concept.title,
      title: concept.title,
      summary: concept.summary,
      recall_prompt: conceptCards[0]?.prompt || `Explain ${concept.title} from memory.`,
      answer_points: answerPoints,
      key_terms: [],
      checks,
      mini_quiz: checks,
      flashcards,
      common_traps: concept.misconception_tags,
      visual: null,
      ai_helpers: { simpler: '', example: '', mnemonic: '' },
      card_ids: conceptCards.map((card) => card.id),
    };
  })
);

const normalizeStatus = (value) => {
  const allowed = new Set(['unseen', 'active', 'retry', 'needs_review', 'mastered', 'completed']);
  return allowed.has(value) ? value : 'unseen';
};

const normalizeOutcome = (value) => {
  const allowed = new Set(['correct', 'partial', 'incorrect', 'misconception', 'empty', null]);
  return allowed.has(value) ? value : null;
};

export const normalizeStudyGuideData = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  if (!raw.session_meta || !raw.river || !raw.knowledge_map || !raw.cards) {
    return null;
  }

  const knowledgeMap = normalizeKnowledgeMap(raw.knowledge_map ?? raw.knowledgeMap);
  if (!knowledgeMap || knowledgeMap.concepts.length === 0) return null;

  const conceptIds = new Set(knowledgeMap.concepts.map((concept) => concept.id));
  const usedCardIds = new Set();
  const cards = Array.isArray(raw.cards)
    ? raw.cards
      .map((card, index) => normalizeCard(card, index, usedCardIds, conceptIds))
      .filter(Boolean)
    : [];

  if (cards.length === 0) return null;

  const sections = deriveSections(knowledgeMap.concepts, cards);

  return {
    version: 4,
    session_meta: normalizeSessionMeta(raw.session_meta ?? raw.sessionMeta),
    river: normalizeRiver(raw.river),
    knowledge_map: knowledgeMap,
    cards,
    evaluation_rules: normalizeEvaluationRules(raw.evaluation_rules ?? raw.evaluationRules),
    adaptation_rules: normalizeAdaptationRules(raw.adaptation_rules ?? raw.adaptationRules),
    completion: normalizeCompletion(raw.completion),
    sections,
  };
};

const buildDefaultCardState = () => ({
  attempts: 0,
  hints_used: 0,
  status: 'unseen',
  last_outcome: null,
  completed: false,
});

const buildDefaultConceptMastery = () => ({
  score: 0,
  status: 'unseen',
  attempts: 0,
  correct_attempts: 0,
  last_outcome: null,
});

const getNextActiveCardId = (cards, cardStates) => (
  cards.find((card) => !cardStates[card.id]?.completed)?.id ?? null
);

export const createDefaultStudyGuideState = (guideData) => {
  const normalizedGuideData = normalizeStudyGuideData(guideData);
  if (!normalizedGuideData) {
    return {
      current_card_id: null,
      session_phase: null,
      card_states: {},
      concept_mastery: {},
      last_interaction_at: null,
      completed_at: null,
      last_reviewed_at: null,
    };
  }

  const cardStates = Object.fromEntries(
    normalizedGuideData.cards.map((card) => [card.id, buildDefaultCardState()]),
  );
  const conceptMastery = Object.fromEntries(
    normalizedGuideData.knowledge_map.concepts.map((concept) => [
      concept.id,
      buildDefaultConceptMastery(),
    ]),
  );

  return {
    current_card_id: normalizedGuideData.cards[0]?.id ?? null,
    session_phase: normalizedGuideData.cards[0]?.phase ?? null,
    card_states: cardStates,
    concept_mastery: conceptMastery,
    last_interaction_at: null,
    completed_at: null,
    last_reviewed_at: null,
  };
};

export const normalizeStudyGuideState = (guideData, value) => {
  const normalizedGuideData = normalizeStudyGuideData(guideData);
  const defaults = createDefaultStudyGuideState(normalizedGuideData);
  if (!normalizedGuideData) return defaults;

  const raw = value && typeof value === 'object' ? value : {};
  const cardStates = Object.fromEntries(
    normalizedGuideData.cards.map((card) => {
      const incoming = raw.card_states?.[card.id] ?? raw.section_states?.[card.id] ?? {};
      return [card.id, {
        ...buildDefaultCardState(),
        attempts: clampNumber(incoming.attempts, { min: 0, max: 99, fallback: 0 }),
        hints_used: clampNumber(incoming.hints_used ?? incoming.hintsUsed, { min: 0, max: 99, fallback: 0 }),
        status: normalizeStatus(incoming.status),
        last_outcome: normalizeOutcome(incoming.last_outcome ?? incoming.lastOutcome),
        completed: Boolean(incoming.completed),
      }];
    }),
  );

  const conceptMastery = Object.fromEntries(
    normalizedGuideData.knowledge_map.concepts.map((concept) => {
      const incoming = raw.concept_mastery?.[concept.id] ?? {};
      return [concept.id, {
        ...buildDefaultConceptMastery(),
        score: clampNumber(incoming.score, { min: 0, max: 100, fallback: 0 }),
        status: normalizeText(incoming.status, 'unseen'),
        attempts: clampNumber(incoming.attempts, { min: 0, max: 99, fallback: 0 }),
        correct_attempts: clampNumber(
          incoming.correct_attempts ?? incoming.correctAttempts,
          { min: 0, max: 99, fallback: 0 },
        ),
        last_outcome: normalizeOutcome(incoming.last_outcome ?? incoming.lastOutcome),
      }];
    }),
  );

  const requestedCardId = normalizeOptionalText(raw.current_card_id ?? raw.currentCardId);
  const currentCardId = requestedCardId && cardStates[requestedCardId]
    ? requestedCardId
    : getNextActiveCardId(normalizedGuideData.cards, cardStates);
  const currentCard = normalizedGuideData.cards.find((card) => card.id === currentCardId) ?? null;

  return {
    current_card_id: currentCardId,
    session_phase: normalizeOptionalText(raw.session_phase ?? raw.sessionPhase) || currentCard?.phase || null,
    card_states: cardStates,
    concept_mastery: conceptMastery,
    last_interaction_at: normalizeOptionalText(raw.last_interaction_at ?? raw.lastInteractionAt),
    completed_at: normalizeOptionalText(raw.completed_at ?? raw.completedAt),
    last_reviewed_at: normalizeOptionalText(raw.last_reviewed_at ?? raw.lastReviewedAt),
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

export const buildStudyGuideSummaryDoc = (guideData) => {
  const normalized = normalizeStudyGuideData(guideData);
  if (!normalized) {
    return { type: 'doc', content: [] };
  }

  const content = [
    headingNode(1, 'River Session'),
    paragraphNode([
      textNode(`${normalized.session_meta.subject}: `, [{ type: 'bold' }]),
      textNode(normalized.session_meta.student_goal),
    ]),
  ];

  normalized.sections.forEach((section, index) => {
    content.push(headingNode(2, `${index + 1}. ${section.title}`));

    if (section.summary) {
      content.push(paragraphNode([textNode(section.summary)]));
    }

    content.push(paragraphNode([
      textNode('Recall target: ', [{ type: 'bold' }]),
      textNode(section.recall_prompt),
    ]));

    if (section.answer_points.length > 0) {
      content.push(headingNode(3, 'Core Answers'));
      content.push(bulletListNode(section.answer_points));
    }

    if (section.common_traps.length > 0) {
      content.push(headingNode(3, 'Common Mix-Ups'));
      content.push(bulletListNode(section.common_traps));
    }
  });

  return { type: 'doc', content };
};

export const studyGuideDataToPlainText = (guideData) => {
  const normalized = normalizeStudyGuideData(guideData);
  if (!normalized) return '';

  return [
    `Subject: ${normalized.session_meta.subject}`,
    `Goal: ${normalized.session_meta.student_goal}`,
    ...normalized.sections.map((section, index) => {
      const lines = [
        `Concept ${index + 1}: ${section.title}`,
        `Recall Prompt: ${section.recall_prompt}`,
      ];

      if (section.summary) {
        lines.push(`Summary: ${section.summary}`);
      }

      if (section.answer_points.length > 0) {
        lines.push(`Answer Points:\n${section.answer_points.map((point) => `- ${point}`).join('\n')}`);
      }

      if (section.common_traps.length > 0) {
        lines.push(`Common Traps:\n${section.common_traps.map((trap) => `- ${trap}`).join('\n')}`);
      }

      return lines.join('\n');
    }),
  ].join('\n\n');
};
