export const STUDY_GUIDE_FORMAT_VERSION = 5;

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

const normalizeBoolean = (value, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
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
    lecture_style: normalizeText(raw.lecture_style ?? raw.lectureStyle, 'storybook seminar'),
    preferred_tutor_tone: normalizeText(
      raw.preferred_tutor_tone ?? raw.preferredTutorTone,
      'calm, precise, encouraging',
    ),
    river_role: normalizeText(raw.river_role ?? raw.riverRole, 'friendly lecture cat'),
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
    teach: normalizeCue(raw.teach, { expression: 'focus_lean_in', animation: 'beanie_bob_teach' }),
    point: normalizeCue(raw.point, { expression: 'focus_lean_in', animation: 'paw_point_stage' }),
    encourage: normalizeCue(raw.encourage, { expression: 'blink_soft', animation: 'soft_nod_glow' }),
    thinking: normalizeCue(raw.thinking, { expression: 'ear_tilt_curious', animation: 'tail_think_loop' }),
    'gentle-correct': normalizeCue(raw['gentle-correct'] ?? raw.gentle_correct ?? raw.gentleCorrect, {
      expression: 'soft_concern_mistake',
      animation: 'paw_point_hint',
    }),
    celebrate: normalizeCue(raw.celebrate, { expression: 'whisker_pride', animation: 'sparkle_mastery' }),
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
    style: normalizeText(raw.style, 'storybook lecture mascot'),
    tone: normalizeText(raw.tone, 'friendly, witty, encouraging teacher'),
    default_expression: normalizeText(raw.default_expression, 'blink_soft'),
    default_animation: normalizeText(raw.default_animation, 'tail_sway_idle'),
    cue_map: normalizeCueMap(raw.cue_map ?? raw.cueMap),
    dialogue_variants: normalizeDialogueVariants(raw.dialogue_variants ?? raw.dialogueVariants),
  };
};

const normalizeLecture = (value, sessionMeta, concepts = [], river = { name: DEFAULT_RIVER_NAME }) => {
  const raw = value && typeof value === 'object' ? value : {};
  const agenda = normalizeStringArray(raw.agenda, 6);

  return {
    opening: normalizeText(
      raw.opening,
      `${river.name} is ready to guide this lesson on ${sessionMeta.subject}.`,
    ),
    agenda: agenda.length > 0
      ? agenda
      : concepts.slice(0, 4).map((concept) => concept.title),
    closing: normalizeText(
      raw.closing,
      'Take the next answer from memory, not from recognition.',
    ),
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
    cue: normalizeCue(value.cue, { expression: 'ear_tilt_curious', animation: 'paw_point_hint' }),
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

const getDefaultPoseForPhase = (phase) => {
  if (phase === 'apply' || phase === 'reinforce') return 'point';
  if (phase === 'recovery') return 'encourage';
  if (phase === 'mastery') return 'celebrate';
  return 'teach';
};

const normalizeCardRiver = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    intro: normalizeText(raw.intro, ''),
    success: normalizeText(raw.success, ''),
    struggle: normalizeText(raw.struggle, ''),
  };
};

const normalizeWorkedExampleStep = (value) => {
  if (!value || typeof value !== 'object') return null;
  const step = normalizeText(value.step, '');
  if (!step) return null;
  return {
    step,
    detail: normalizeText(value.detail, ''),
  };
};

const normalizeFigure = (value) => {
  if (!value || typeof value !== 'object') return null;
  const ALLOWED_TYPES = ['mermaid', 'plot', 'chart', 'code'];
  const type = ALLOWED_TYPES.includes(value.type) ? value.type : null;
  if (!type) return null;
  const spec = normalizeText(value.spec, '');
  if (!spec) return null;
  return { type, spec, lang: typeof value.lang === 'string' ? value.lang : undefined };
};

const normalizeWorkedExample = (value, index) => {
  if (!value || typeof value !== 'object') return null;
  const problem = normalizeText(value.problem, '');
  if (!problem) return null;

  const steps = Array.isArray(value.steps)
    ? value.steps.map(normalizeWorkedExampleStep).filter(Boolean).slice(0, 10)
    : [];

  return {
    title: normalizeText(value.title, `Example ${index + 1}`),
    problem,
    steps,
    result: normalizeText(value.result, ''),
    takeaway: normalizeText(value.takeaway, ''),
    figure: normalizeFigure(value.figure),
  };
};

const normalizeTeaching = (value, card, concept) => {
  const raw = value && typeof value === 'object' ? value : {};
  const steps = normalizeStringArray(raw.steps, 6);
  const fallbackExplain = concept?.summary || card.target_answer || card.prompt;
  const fallbackExample = concept?.weak_points?.[0]
    ? `${concept.title} shows up when you need to reason about ${concept.weak_points[0].replace(/-/g, ' ')}.`
    : `Use ${concept?.title || 'this concept'} in context: ${card.target_answer}`;
  const fallbackSteps = [
    concept?.summary,
    card.target_answer,
    card.hints?.[0]?.text,
  ].map((item) => normalizeOptionalText(item)).filter(Boolean);

  const workedExamples = Array.isArray(raw.worked_examples)
    ? raw.worked_examples.map(normalizeWorkedExample).filter(Boolean).slice(0, 5)
    : [];

  const normalizePredict = (v) => {
    if (!v || typeof v !== 'object') return null;
    const prompt = normalizeText(v.prompt, '');
    const answer = normalizeText(v.answer, '');
    if (!prompt || !answer) return null;
    const after_beat = typeof v.after_beat === 'number' && Number.isFinite(v.after_beat)
      ? Math.max(0, Math.min(20, Math.round(v.after_beat)))
      : undefined;
    return { prompt, answer, after_beat };
  };

  const normalizeBeat = (b) => {
    if (!b || typeof b !== 'object') return null;
    if (b.kind === 'text') return { kind: 'text', text: normalizeText(b.text, '') };
    if (b.kind === 'block') {
      const BLOCK_TYPES = ['code', 'mermaid', 'plot', 'chart', 'table', 'math'];
      if (!BLOCK_TYPES.includes(b.blockType)) return null;
      return { kind: 'block', blockType: b.blockType, raw: normalizeText(b.raw, '') };
    }
    if (b.kind === 'predict') {
      const p = normalizePredict(b);
      if (!p) return null;
      return { kind: 'predict', ...p };
    }
    return null;
  };

  return {
    learning_objective: normalizeText(
      raw.learning_objective ?? raw.learningObjective,
      `Understand and apply ${concept?.title || card.prompt} in exam-style reasoning.`,
    ),
    explain: normalizeText(raw.explain, fallbackExplain),
    intuition: normalizeText(raw.intuition, ''),
    worked_examples: workedExamples,
    common_mistakes: normalizeStringArray(raw.common_mistakes, 6),
    example: normalizeText(raw.example, fallbackExample),
    steps: steps.length > 0 ? steps : fallbackSteps.slice(0, 3),
    why_it_matters: normalizeText(
      raw.why_it_matters ?? raw.whyItMatters,
      concept?.weak_points?.[0]
        ? `This matters because students often miss ${concept.weak_points[0].replace(/-/g, ' ')} when the pressure rises.`
        : `This matters because ${concept?.title || 'this idea'} supports later questions and examples.`,
    ),
    predicts: Array.isArray(raw.predicts)
      ? raw.predicts.map(normalizePredict).filter(Boolean).slice(0, 3)
      : [],
    explain_beats: Array.isArray(raw.explain_beats)
      ? raw.explain_beats.map(normalizeBeat).filter(Boolean)
      : [],
  };
};

const normalizeAssistOptionId = (value, label, index) => {
  const normalized = normalizeText(value || label, `assist-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized.includes('explain')) return 'explain-simply';
  if (normalized.includes('example')) return 'show-example';
  if (normalized.includes('break')) return 'break-it-down';
  if (normalized.includes('why')) return 'why-it-matters';
  return normalized || `assist-${index + 1}`;
};

const buildDefaultAssistOptions = (teaching) => ([
  {
    id: 'explain-simply',
    label: 'Explain simply',
    text: teaching.explain,
    pose: 'encourage',
  },
  {
    id: 'show-example',
    label: 'Show another example',
    text: teaching.example,
    pose: 'point',
  },
  {
    id: 'break-it-down',
    label: 'Break it down',
    text: teaching.steps.join(' '),
    pose: 'point',
  },
  {
    id: 'why-it-matters',
    label: 'Why this matters',
    text: teaching.why_it_matters,
    pose: 'thinking',
  },
]);

const normalizeAssistOptions = (value, teaching) => {
  const raw = Array.isArray(value) ? value : [];
  const provided = raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const label = normalizeText(item.label, '');
      const text = normalizeText(item.text ?? item.response, '');
      if (!label || !text) return null;

      return {
        id: normalizeAssistOptionId(item.id, label, index),
        label,
        text,
        pose: normalizeText(item.pose, 'teach'),
        cue: normalizeCue(item.cue, { expression: 'focus_lean_in', animation: 'paw_point_stage' }),
      };
    })
    .filter(Boolean);

  const merged = new Map(buildDefaultAssistOptions(teaching).map((item) => [
    item.id,
    {
      ...item,
      cue: normalizeCue(null, { expression: 'focus_lean_in', animation: 'paw_point_stage' }),
    },
  ]));

  provided.forEach((item) => {
    merged.set(item.id, {
      ...(merged.get(item.id) || {}),
      ...item,
    });
  });

  return Array.from(merged.values()).slice(0, 4);
};

const normalizePresentation = (value, card) => {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    pose: normalizeText(raw.pose, getDefaultPoseForPhase(card.phase)),
    emphasis_target: normalizeText(raw.emphasis_target ?? raw.emphasisTarget, card.target_answer),
    reaction_cue: normalizeCue(raw.reaction_cue ?? raw.reactionCue, {
      expression: 'focus_lean_in',
      animation: 'ear_tilt_curious',
    }),
  };
};

const normalizeCard = (value, index, usedIds, conceptMap) => {
  if (!value || typeof value !== 'object') return null;

  const prompt = normalizeText(value.prompt, '');
  const targetAnswer = normalizeText(value.target_answer ?? value.targetAnswer, '');
  const conceptId = normalizeOptionalText(value.concept_id ?? value.conceptId);

  if (!prompt || !targetAnswer || !conceptId || !conceptMap.has(conceptId)) {
    return null;
  }

  const concept = conceptMap.get(conceptId);
  const baseCard = {
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

  const teaching = normalizeTeaching(value.teaching, baseCard, concept);

  return {
    ...baseCard,
    teaching,
    assist_options: normalizeAssistOptions(value.assist_options ?? value.assistOptions, teaching),
    presentation: normalizePresentation(value.presentation, baseCard),
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
    pass_threshold: clampNumber(
      raw.pass_threshold ?? raw.passThreshold,
      { min: 0, max: 1, fallback: 0.5 },
    ),
    partial_advances: normalizeBoolean(
      raw.partial_advances ?? raw.partialAdvances,
      true,
    ),
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
      ai_helpers: {
        simpler: conceptCards[0]?.assist_options?.find((option) => option.id === 'explain-simply')?.text || '',
        example: conceptCards[0]?.assist_options?.find((option) => option.id === 'show-example')?.text || '',
        mnemonic: conceptCards[0]?.assist_options?.find((option) => option.id === 'why-it-matters')?.text || '',
      },
      card_ids: conceptCards.map((card) => card.id),
    };
  })
);

const normalizeStatus = (value) => {
  const allowed = new Set(['unseen', 'active', 'retry', 'needs_review', 'mastered', 'completed', 'skipped']);
  return allowed.has(value) ? value : 'unseen';
};

const normalizeOutcome = (value) => {
  const allowed = new Set(['correct', 'partial', 'incorrect', 'misconception', 'empty', 'revealed', 'skipped', null]);
  return allowed.has(value) ? value : null;
};

const getPerformanceBand = (score) => {
  if (score < 45) return 'struggling';
  if (score < 80) return 'steady';
  return 'mastery';
};

const getConceptStatus = (score) => {
  if (score >= 80) return 'mastered';
  if (score >= 65) return 'secure';
  if (score >= 45) return 'developing';
  if (score > 0) return 'struggling';
  return 'unseen';
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const normalizeStudyGuideData = (value) => {
  const raw = value && typeof value === 'object' ? value : {};
  if (!raw.session_meta || !raw.river || !raw.knowledge_map || !raw.cards) {
    return null;
  }

  const knowledgeMap = normalizeKnowledgeMap(raw.knowledge_map ?? raw.knowledgeMap);
  if (!knowledgeMap || knowledgeMap.concepts.length === 0) return null;

  const conceptMap = new Map(knowledgeMap.concepts.map((concept) => [concept.id, concept]));
  const usedCardIds = new Set();
  const cards = Array.isArray(raw.cards)
    ? raw.cards
      .map((card, index) => normalizeCard(card, index, usedCardIds, conceptMap))
      .filter(Boolean)
    : [];

  if (cards.length === 0) return null;

  const sessionMeta = normalizeSessionMeta(raw.session_meta ?? raw.sessionMeta);
  const river = normalizeRiver(raw.river);
  const completion = normalizeCompletion(raw.completion);

  return {
    version: 4,
    session_meta: sessionMeta,
    lecture: normalizeLecture(raw.lecture, sessionMeta, knowledgeMap.concepts, river),
    river,
    knowledge_map: knowledgeMap,
    cards,
    evaluation_rules: normalizeEvaluationRules(raw.evaluation_rules ?? raw.evaluationRules),
    adaptation_rules: normalizeAdaptationRules(raw.adaptation_rules ?? raw.adaptationRules),
    completion,
    sections: deriveSections(knowledgeMap.concepts, cards),
  };
};

const QUALITY_MIN_EXPLAIN_WORDS = 100;
const QUALITY_MIN_EXPLAIN_PARAGRAPHS = 2;
const QUALITY_MIN_INTUITION_WORDS = 12;
const QUALITY_MIN_EXAMPLES = 2;
const QUALITY_MIN_EXAMPLE_STEPS = 2;
const QUALITY_MIN_MISTAKES = 2;
const QUALITY_MIN_STEP_DETAIL_WORDS = 6;
const LATEX_MATH_RE = /(\$\$[\s\S]+?\$\$|(^|[^$])\$(?!\$)[^$\n]+?\$(?!\$))/u;
const EQUATION_OPERATOR_RE = /(=|\\frac|\\sqrt|\\int|\\sum|\\lim|\\cdot|\\times|\\leq?|\\geq?|\^|[+\-*/])/u;
const MATH_REASONING_RE = /\b(add|subtract|multiply|divide|factor|expand|simplify|isolate|cancel|substitute|differentiate|integrate|derive|apply|use|move|combine|because|since|so that|therefore|to get|to keep|both sides|inverse operation)\b/iu;
const MATH_MISTAKE_RE = /\b(sign|negative|positive|factor|foil|distribute|cancel|divide|multiply|add|subtract|denominator|numerator|exponent|square root|derivative|integral|constant|unit|both sides|domain)\b/iu;

const normalizeForQuality = (value) => normalizeText(value, '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const qualityWords = (value) => (
  normalizeForQuality(value).split(' ').filter(Boolean)
);

const qualityWordCount = (value) => qualityWords(value).length;

// Count paragraphs tolerantly: a small model rarely emits literal blank lines
// inside a JSON string, so split on any newline run, not only `\n\n`. Short
// fragments are still merged into the preceding paragraph to avoid over-counting
// single wrapped lines.
const qualityParagraphs = (value) => {
  const text = normalizeText(value, '');
  const blocks = text
    .split(/\n+/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const paragraphs = [];
  for (const block of blocks) {
    if (qualityWordCount(block) < 8 && paragraphs.length > 0) {
      paragraphs[paragraphs.length - 1] = `${paragraphs[paragraphs.length - 1]} ${block}`;
    } else {
      paragraphs.push(block);
    }
  }
  return paragraphs;
};

const qualityContentWords = (value) => {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'in',
    'into', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'their', 'this', 'to',
    'with', 'will', 'you', 'your',
  ]);
  return qualityWords(value).filter((word) => word.length > 2 && !stopWords.has(word));
};

const qualityOverlap = (left, right) => {
  const leftWords = qualityContentWords(left);
  const rightWords = new Set(qualityContentWords(right));
  if (leftWords.length === 0 || rightWords.size === 0) return 0;
  const matches = leftWords.filter((word) => rightWords.has(word)).length;
  return matches / leftWords.length;
};

const hasCorrectionLanguage = (value) => (
  /\b(because|instead|rather than|not\b|avoid|fix|correct|should|means|confuses|misses|remember)\b/iu
    .test(normalizeText(value, ''))
);

const hasLatexMath = (value) => LATEX_MATH_RE.test(normalizeText(value, ''));

const extractLatexMath = (value) => {
  const text = normalizeText(value, '');
  const matches = [];
  for (const match of text.matchAll(/(\$\$[\s\S]+?\$\$|(^|[^$])\$(?!\$)([^$\n]+?)\$(?!\$))/gu)) {
    const fullMatch = match[0] || '';
    if (fullMatch.startsWith('$$')) {
      matches.push(fullMatch.slice(2, -2).trim());
    } else {
      matches.push((match[3] || fullMatch.replace(/^\s*\$/, '').replace(/\$\s*$/, '')).trim());
    }
  }
  return matches.filter(Boolean);
};

const hasEquationLatex = (value) => extractLatexMath(value).some((tex) => EQUATION_OPERATOR_RE.test(tex));

const hasMathReasoningLanguage = (value) => MATH_REASONING_RE.test(normalizeText(value, ''));

const validateMathTutorCardQuality = ({ card, label, teaching, workedExamples, mistakes, issues }) => {
  const mathText = [
    card.prompt,
    card.target_answer,
    teaching.learning_objective,
    teaching.explain,
    teaching.intuition,
    teaching.example,
    teaching.why_it_matters,
    ...workedExamples.flatMap((example) => [
      example.title,
      example.problem,
      example.result,
      example.takeaway,
      ...(Array.isArray(example.steps) ? example.steps.flatMap((step) => [step.step, step.detail]) : []),
    ]),
    ...mistakes,
  ].join('\n');

  if (!hasLatexMath(mathText)) {
    issues.push(`${label}: math tutor cards must use LaTeX notation for formulas and calculations.`);
  }

  if (!hasLatexMath(card.prompt)) {
    issues.push(`${label}: math recall prompt should include a similar LaTeX practice problem.`);
  }

  if (!hasLatexMath(teaching.explain)) {
    issues.push(`${label}: math explanation must include the formula or setup in LaTeX.`);
  }

  workedExamples.forEach((example, exampleIndex) => {
    const exampleLabel = `${label} example ${exampleIndex + 1}`;
    const steps = Array.isArray(example.steps) ? example.steps : [];
    const equationSteps = steps.filter((step) => hasEquationLatex(step.step));

    if (!hasLatexMath(example.problem)) {
      issues.push(`${exampleLabel}: math problem statement must include LaTeX.`);
    }

    if (equationSteps.length === 0) {
      issues.push(`${exampleLabel}: include at least one equation-bearing LaTeX step.`);
    }

    steps.forEach((step, stepIndex) => {
      if (hasLatexMath(step.step) && !hasMathReasoningLanguage(step.detail)) {
        issues.push(`${exampleLabel} step ${stepIndex + 1}: explain the operation, not just the next line.`);
      }
    });
  });

  mistakes.forEach((mistake, mistakeIndex) => {
    if (!hasLatexMath(mistake) && !MATH_MISTAKE_RE.test(normalizeText(mistake, ''))) {
      issues.push(`${label} mistake ${mistakeIndex + 1}: use an actual computational or algebraic error.`);
    }
  });
};

export const validateTutorSessionQuality = (guideData) => {
  const normalized = normalizeStudyGuideData(guideData);
  if (!normalized) {
    return {
      ok: false,
      fatal: true,
      issues: ['Tutor session is missing the required v4 structure.'],
    };
  }
  if (!Array.isArray(normalized.cards) || normalized.cards.length === 0) {
    return {
      ok: false,
      fatal: true,
      issues: ['Tutor session has no usable cards.'],
    };
  }

  const issues = [];
  const seenConceptIds = new Set();
  const isMathSession = normalized.session_meta.subject === 'Mathematics';

  normalized.cards.forEach((card, index) => {
    const label = card.id || `card ${index + 1}`;
    const teaching = card.teaching || {};
    const objective = normalizeText(teaching.learning_objective, '');
    const explain = normalizeText(teaching.explain, '');
    const paragraphs = qualityParagraphs(explain);
    const explainWordCount = qualityWordCount(explain);
    const intuition = normalizeText(teaching.intuition, '');
    const workedExamples = Array.isArray(teaching.worked_examples)
      ? teaching.worked_examples
      : [];
    const mistakes = Array.isArray(teaching.common_mistakes)
      ? teaching.common_mistakes
      : [];

    if (!objective || qualityWordCount(objective) < 5) {
      issues.push(`${label}: add a specific learning objective.`);
    }

    if (paragraphs.length < QUALITY_MIN_EXPLAIN_PARAGRAPHS) {
      issues.push(`${label}: explanation must be at least ${QUALITY_MIN_EXPLAIN_PARAGRAPHS} paragraphs.`);
    }

    if (explainWordCount < QUALITY_MIN_EXPLAIN_WORDS) {
      issues.push(`${label}: explanation is too shallow (${explainWordCount} words).`);
    }

    if (qualityWordCount(intuition) < QUALITY_MIN_INTUITION_WORDS) {
      issues.push(`${label}: intuition must be a real mental model, not a short restatement.`);
    } else if (qualityOverlap(intuition, explain) > 0.78) {
      issues.push(`${label}: intuition repeats the explanation too closely.`);
    }

    if (workedExamples.length < QUALITY_MIN_EXAMPLES) {
      issues.push(`${label}: include at least ${QUALITY_MIN_EXAMPLES} worked examples.`);
    }

    workedExamples.forEach((example, exampleIndex) => {
      const exampleLabel = `${label} example ${exampleIndex + 1}`;
      const steps = Array.isArray(example.steps) ? example.steps : [];
      if (qualityWordCount(example.problem) < 5) {
        issues.push(`${exampleLabel}: problem statement is too thin.`);
      }
      if (steps.length < QUALITY_MIN_EXAMPLE_STEPS) {
        issues.push(`${exampleLabel}: include at least ${QUALITY_MIN_EXAMPLE_STEPS} reasoning steps.`);
      }
      if (!normalizeText(example.result, '')) {
        issues.push(`${exampleLabel}: include a result.`);
      }
      if (qualityWordCount(example.takeaway) < 5) {
        issues.push(`${exampleLabel}: include a useful takeaway.`);
      }
      steps.forEach((step, stepIndex) => {
        if (qualityWordCount(step.detail) < QUALITY_MIN_STEP_DETAIL_WORDS) {
          issues.push(`${exampleLabel} step ${stepIndex + 1}: explain why the step works.`);
        }
      });
    });

    const firstExampleMath = extractLatexMath(workedExamples[0]?.problem).join('|');
    const secondExampleMath = extractLatexMath(workedExamples[1]?.problem).join('|');
    const examplesUseDifferentMath = Boolean(
      isMathSession
      && firstExampleMath
      && secondExampleMath
      && firstExampleMath !== secondExampleMath
    );
    if (
      workedExamples.length >= 2
      && qualityOverlap(workedExamples[0]?.problem, workedExamples[1]?.problem) > 0.82
      && !examplesUseDifferentMath
    ) {
      issues.push(`${label}: worked examples are too repetitive.`);
    }

    if (mistakes.length < QUALITY_MIN_MISTAKES) {
      issues.push(`${label}: include at least ${QUALITY_MIN_MISTAKES} common mistakes.`);
    }

    mistakes.forEach((mistake, mistakeIndex) => {
      if (qualityWordCount(mistake) < 8 || !hasCorrectionLanguage(mistake)) {
        issues.push(`${label} mistake ${mistakeIndex + 1}: name the error and explain the correction.`);
      }
    });

    if (!Array.isArray(card.required_idea_tags) || card.required_idea_tags.length === 0) {
      issues.push(`${label}: required idea tags are needed for grading.`);
    }

    if (qualityWordCount(card.prompt) > 36) {
      issues.push(`${label}: recall prompt should stay concise.`);
    }

    if (seenConceptIds.has(card.concept_id)) {
      issues.push(`${label}: each main tutor card should teach a distinct concept.`);
    }
    seenConceptIds.add(card.concept_id);

    // Soft check: predicts add active-recall beats mid-lecture. Non-fatal so a
    // repair pass can backfill them without blocking an otherwise valid session.
    const predicts = Array.isArray(teaching.predicts) ? teaching.predicts : [];
    if (predicts.length === 0) {
      issues.push(`${label}: add at least one predict-then-reveal beat to make the lecture active.`);
    }

    if (isMathSession) {
      validateMathTutorCardQuality({
        card,
        label,
        teaching,
        workedExamples,
        mistakes,
        issues,
      });
    }
  });

  // Depth/repetition issues are non-fatal: the structure is valid and usable,
  // so callers may repair-then-accept rather than hard-fail. `fatal` is reserved
  // for broken/unparseable structure handled in the early returns above.
  return {
    ok: issues.length === 0,
    fatal: false,
    issues,
  };
};

const buildDefaultCardState = () => ({
  attempts: 0,
  hints_used: 0,
  status: 'unseen',
  last_outcome: null,
  completed: false,
  assist_count: 0,
  last_assist_at: null,
  revealed_answer: false,
  skipped: false,
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
      const skipped = Boolean(incoming.skipped);
      return [card.id, {
        ...buildDefaultCardState(),
        attempts: clampNumber(incoming.attempts, { min: 0, max: 99, fallback: 0 }),
        hints_used: clampNumber(incoming.hints_used ?? incoming.hintsUsed, { min: 0, max: 99, fallback: 0 }),
        status: skipped ? 'skipped' : normalizeStatus(incoming.status),
        last_outcome: normalizeOutcome(incoming.last_outcome ?? incoming.lastOutcome),
        completed: Boolean(incoming.completed),
        assist_count: clampNumber(incoming.assist_count ?? incoming.assistCount, { min: 0, max: 99, fallback: 0 }),
        last_assist_at: normalizeOptionalText(incoming.last_assist_at ?? incoming.lastAssistAt),
        revealed_answer: Boolean(incoming.revealed_answer ?? incoming.revealedAnswer),
        skipped,
      }];
    }),
  );

  const conceptMastery = Object.fromEntries(
    normalizedGuideData.knowledge_map.concepts.map((concept) => {
      const incoming = raw.concept_mastery?.[concept.id] ?? {};
      return [concept.id, {
        ...buildDefaultConceptMastery(),
        score: clampNumber(incoming.score, { min: 0, max: 100, fallback: 0 }),
        status: normalizeText(
          incoming.status,
          getConceptStatus(clampNumber(incoming.score, { min: 0, max: 100, fallback: 0 })),
        ),
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

const estimateNextReviewAt = (sectionState, options = {}) => {
  const nowValue = options.now ? new Date(options.now).getTime() : Date.now();
  const score = clampNumber(
    sectionState?.score ?? sectionState?.mastery_score,
    { min: 0, max: 100, fallback: 0 },
  );

  let offsetDays = 1;
  if (score >= 80) offsetDays = 3;
  else if (score >= 45) offsetDays = 2;

  return new Date(nowValue + (offsetDays * DAY_IN_MS)).toISOString();
};

const getSectionStatus = (sectionState, sectionLastReviewedAt) => {
  const score = clampNumber(
    sectionState?.score ?? sectionState?.mastery_score,
    { min: 0, max: 100, fallback: 0 },
  );

  if (score < 45) return 'review_now';
  if (score < 80) return 'coming_up';

  if (!sectionLastReviewedAt) return 'review_soon';
  const daysSince = (Date.now() - new Date(sectionLastReviewedAt).getTime()) / DAY_IN_MS;
  return daysSince > 3 ? 'review_soon' : 'good';
};

export const getGuideMasterySnapshot = (guideData, studyState, options = {}) => {
  const normalizedGuideData = normalizeStudyGuideData(guideData);
  const normalizedStudyState = normalizeStudyGuideState(guideData, studyState);
  if (!normalizedGuideData) {
    return {
      averageMastery: 0,
      weakCount: 0,
      masteryBands: {
        struggling: [],
        steady: [],
        mastery: [],
        support: [],
        standard: [],
        challenge: [],
      },
      recommendedSections: [],
      nextReviewAt: null,
    };
  }

  const nowValue = options.now ? new Date(options.now).getTime() : Date.now();
  const entries = normalizedGuideData.sections.map((section) => {
    const conceptState = normalizedStudyState.concept_mastery?.[section.id] || buildDefaultConceptMastery();
    const masteryScore = clampNumber(conceptState.score, { min: 0, max: 100, fallback: 0 });
    const performanceBand = getPerformanceBand(masteryScore);
    const masteryBand = masteryScore < 45 ? 'support' : masteryScore < 80 ? 'standard' : 'challenge';
    const status = getSectionStatus(conceptState, normalizedStudyState.last_reviewed_at);
    const daysSince = normalizedStudyState.last_reviewed_at
      ? Math.max(0, (nowValue - new Date(normalizedStudyState.last_reviewed_at).getTime()) / DAY_IN_MS)
      : 0;
    const priorityScore = (100 - masteryScore)
      + (performanceBand === 'struggling' ? 30 : performanceBand === 'steady' ? 12 : 0)
      + Math.min(16, Math.round(daysSince * 2))
      + (conceptState.last_outcome === 'incorrect' || conceptState.last_outcome === 'misconception' ? 12 : 0);

    return {
      ...section,
      masteryScore,
      masteryBand,
      performanceBand,
      status,
      nextReviewAt: estimateNextReviewAt(conceptState, { now: nowValue }),
      priorityScore,
      priorityReason: performanceBand === 'struggling'
        ? 'This concept needs a recovery pass before adding difficulty.'
        : performanceBand === 'steady'
          ? 'One more clean retrieval should stabilize this concept.'
          : 'This concept is stable and ready for later reinforcement.',
    };
  }).sort((left, right) => right.priorityScore - left.priorityScore);

  const struggling = entries.filter((entry) => entry.performanceBand === 'struggling');
  const steady = entries.filter((entry) => entry.performanceBand === 'steady');
  const mastery = entries.filter((entry) => entry.performanceBand === 'mastery');

  return {
    averageMastery: entries.length
      ? Math.round(entries.reduce((total, entry) => total + entry.masteryScore, 0) / entries.length)
      : 0,
    weakCount: struggling.length,
    masteryBands: {
      struggling,
      steady,
      mastery,
      support: struggling,
      standard: steady,
      challenge: mastery,
    },
    recommendedSections: entries,
    nextReviewAt: entries.map((entry) => entry.nextReviewAt).filter(Boolean).sort()[0] || null,
  };
};

export const estimateSectionEffortMinutes = (section) => {
  const cardCount = Array.isArray(section?.card_ids) ? section.card_ids.length : 1;
  return Math.max(3, Math.min(12, cardCount * 2 + 1));
};

export const estimateSessionEffortMinutes = (sections = []) => (
  sections.reduce((total, section) => total + estimateSectionEffortMinutes(section), 0)
);

export const getSessionDelta = (guideData, stateBefore, stateAfter) => {
  const beforeSnapshot = getGuideMasterySnapshot(guideData, stateBefore);
  const afterSnapshot = getGuideMasterySnapshot(guideData, stateAfter);
  const beforeState = normalizeStudyGuideState(guideData, stateBefore);
  const afterState = normalizeStudyGuideState(guideData, stateAfter);
  const sectionIds = Object.keys(afterState.concept_mastery || {});

  const reviewedSections = sectionIds.filter((sectionId) => {
    const beforeConcept = beforeState.concept_mastery?.[sectionId] || buildDefaultConceptMastery();
    const afterConcept = afterState.concept_mastery?.[sectionId] || buildDefaultConceptMastery();
    return afterConcept.score > beforeConcept.score
      || afterConcept.correct_attempts > beforeConcept.correct_attempts
      || (beforeConcept.last_outcome !== 'correct' && afterConcept.last_outcome === 'correct');
  }).length;

  return {
    masteryDeltaPercent: (afterSnapshot.averageMastery || 0) - (beforeSnapshot.averageMastery || 0),
    weakCountBefore: beforeSnapshot.weakCount || 0,
    weakCountAfter: afterSnapshot.weakCount || 0,
    reviewedSections,
  };
};

// A concept counts as "mastered" at >=75, matching the threshold used by
// study-session-complete when counting topics_mastered.
export const COVERAGE_MASTERY_THRESHOLD = 75;

const coverageTopicKey = (title, fallbackId) => {
  const normalized = String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized || String(fallbackId || '');
};

/**
 * Aggregate per-topic coverage across many guides (optionally one class's worth) so the UI
 * can show how much of the material has been taught and mastered, and what to study next.
 *
 * A "topic" is a concept/section. The same-named topic taught across multiple guides is
 * merged and keeps its strongest mastery. Status per topic:
 *   - mastered: mastery score >= COVERAGE_MASTERY_THRESHOLD
 *   - taught:   engaged (any attempt or score) but below mastery
 *   - untaught: present in a guide but never practiced
 *
 * Pure and runtime-agnostic so it unit-tests from Node and runs in Deno edge functions.
 */
export const buildCoverageMap = ({ guides = [] } = {}) => {
  const topics = new Map();
  const statusRank = { untaught: 0, taught: 1, mastered: 2 };

  for (const guide of guides) {
    const guideData = normalizeStudyGuideData(guide?.guide_data);
    if (!guideData) continue;
    const studyState = normalizeStudyGuideState(guideData, guide?.study_state);
    const snapshot = getGuideMasterySnapshot(guideData, studyState);

    for (const section of snapshot.recommendedSections) {
      const conceptState = studyState.concept_mastery?.[section.id] || {};
      const attempts = Number(conceptState.attempts) || 0;
      const masteryScore = Number(section.masteryScore) || 0;
      const status = masteryScore >= COVERAGE_MASTERY_THRESHOLD
        ? 'mastered'
        : (attempts > 0 || masteryScore > 0)
          ? 'taught'
          : 'untaught';

      const key = coverageTopicKey(section.title, section.id);
      const existing = topics.get(key);
      if (!existing) {
        topics.set(key, {
          key,
          title: section.title || section.id,
          status,
          masteryScore,
          guideId: guide?.id || null,
          guideTitle: guide?.title || null,
        });
      } else if (masteryScore > existing.masteryScore || statusRank[status] > statusRank[existing.status]) {
        existing.status = statusRank[status] > statusRank[existing.status] ? status : existing.status;
        if (masteryScore > existing.masteryScore) {
          existing.masteryScore = masteryScore;
          existing.guideId = guide?.id || existing.guideId;
          existing.guideTitle = guide?.title || existing.guideTitle;
        }
      }
    }
  }

  const list = Array.from(topics.values());
  const counts = { total: list.length, mastered: 0, taught: 0, untaught: 0 };
  for (const topic of list) counts[topic.status] += 1;
  const masteredPct = counts.total ? Math.round((counts.mastered / counts.total) * 100) : 0;
  const coveredPct = counts.total
    ? Math.round(((counts.mastered + counts.taught) / counts.total) * 100)
    : 0;

  // Surface what to study next first: untaught, then weakest taught.
  list.sort((left, right) => (statusRank[left.status] - statusRank[right.status])
    || (left.masteryScore - right.masteryScore));

  return {
    totals: { ...counts, masteredPct, coveredPct },
    topics: list,
    nextTopics: list.filter((topic) => topic.status !== 'mastered').slice(0, 6).map((topic) => topic.title),
  };
};

export const normalizeGuideData = normalizeStudyGuideData;
export const normalizeGuideStudyState = normalizeStudyGuideState;

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
