import { extractTextFromDoc } from './sharedResources.js';

export const STUDY_GUIDE_FORMAT_VERSION = 4;
export const ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION = 4;
export const STUDY_GUIDE_CONFIDENCE_OPTIONS = [];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
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

    return {
        subject: normalizeText(raw.subject, 'General Study'),
        student_goal: normalizeText(raw.student_goal ?? raw.goal, 'Build durable understanding'),
        student_level: normalizeText(raw.student_level ?? raw.level, 'intermediate'),
        exam_context: {
            label: normalizeText(examContextRaw.label, ''),
            date: normalizeText(examContextRaw.date, ''),
        },
        source_mode: ['setup', 'source', 'hybrid'].includes(sourceMode) ? sourceMode : 'hybrid',
        estimated_minutes: clampNumber(
            raw.estimated_minutes ?? raw.estimatedMinutes,
            { min: 1, max: 240, fallback: DEFAULT_ESTIMATED_MINUTES },
        ),
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
        name: normalizeText(raw.name, 'River'),
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
        misconception_tags: normalizeStringArray(value.misconception_tags ?? value.misconceptions),
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
        required_idea_tags: normalizeStringArray(value.required_idea_tags ?? value.requiredIdeaTags),
        optional_idea_tags: normalizeStringArray(value.optional_idea_tags ?? value.optionalIdeaTags),
        misconception_tags: normalizeStringArray(value.misconception_tags ?? value.misconceptions),
        hints: Array.isArray(value.hints)
            ? value.hints.map(normalizeCardHint).filter(Boolean).slice(0, 4)
            : [],
        feedback: normalizeCardFeedback(value.feedback),
        river: {
            intro: normalizeText(value.river?.intro, ''),
            success: normalizeText(value.river?.success, ''),
            struggle: normalizeText(value.river?.struggle, ''),
        },
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
        trigger_phrases: normalizeStringArray(value.trigger_phrases ?? value.triggerPhrases, 12),
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
        const checks = conceptCards.slice(0, 4).map((card) => ({
            prompt: card.prompt,
            answer: card.target_answer,
        }));

        return {
            id: concept.id,
            topic_id: concept.id,
            topic_title: concept.title,
            title: concept.title,
            summary: concept.summary,
            recall_prompt: conceptCards[0]?.prompt || `Explain ${concept.title} from memory.`,
            answer_points: conceptCards.map((card) => card.target_answer).filter(Boolean).slice(0, 4),
            key_terms: [],
            checks,
            mini_quiz: checks,
            flashcards: conceptCards.slice(0, 4).map((card) => ({
                front: card.prompt,
                back: card.target_answer,
            })),
            common_traps: concept.misconception_tags,
            visual: null,
            ai_helpers: { simpler: '', example: '', mnemonic: '' },
            card_ids: conceptCards.map((card) => card.id),
        };
    })
);

export const normalizeGuideData = (guideData) => {
    const raw = guideData && typeof guideData === 'object' ? guideData : {};
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

    return {
        version: 4,
        session_meta: normalizeSessionMeta(raw.session_meta ?? raw.sessionMeta),
        river: normalizeRiver(raw.river),
        knowledge_map: knowledgeMap,
        cards,
        evaluation_rules: normalizeEvaluationRules(raw.evaluation_rules ?? raw.evaluationRules),
        adaptation_rules: normalizeAdaptationRules(raw.adaptation_rules ?? raw.adaptationRules),
        completion: normalizeCompletion(raw.completion),
        sections: deriveSections(knowledgeMap.concepts, cards),
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

const buildDefaultConceptState = () => ({
    score: 0,
    status: 'unseen',
    attempts: 0,
    correct_attempts: 0,
    last_outcome: null,
});

const normalizeCardStatus = (value) => {
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

const getNextIncompleteCardId = (cards, cardStates) => (
    cards.find((card) => !cardStates[card.id]?.completed)?.id ?? null
);

export const isActiveRecallGuide = (guide) => (
    Number(guide?.format_version) >= ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION
    && Boolean(normalizeGuideData(guide?.guide_data))
);

export const normalizeGuideStudyState = (guideData, studyState) => {
    const normalizedGuideData = normalizeGuideData(guideData);
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

    const raw = studyState && typeof studyState === 'object' ? studyState : {};
    const cardStates = Object.fromEntries(
        normalizedGuideData.cards.map((card) => {
            const incoming = raw.card_states?.[card.id] ?? raw.section_states?.[card.id] ?? {};
            const skipped = Boolean(incoming.skipped);
            return [card.id, {
                ...buildDefaultCardState(),
                attempts: clampNumber(incoming.attempts, { min: 0, max: 99, fallback: 0 }),
                hints_used: clampNumber(incoming.hints_used ?? incoming.hintsUsed, { min: 0, max: 99, fallback: 0 }),
                status: skipped ? 'skipped' : normalizeCardStatus(incoming.status),
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
            const score = clampNumber(incoming.score, { min: 0, max: 100, fallback: 0 });
            return [concept.id, {
                ...buildDefaultConceptState(),
                score,
                status: normalizeText(incoming.status, getConceptStatus(score)),
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
        : getNextIncompleteCardId(normalizedGuideData.cards, cardStates) ?? normalizedGuideData.cards[0]?.id ?? null;
    const currentCard = normalizedGuideData.cards.find((card) => card.id === currentCardId) || null;

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

const normalizeForMatch = (value) => normalizeText(value).toLowerCase().replace(/\s+/g, ' ');

const getTagCandidates = (guideData, tag) => {
    const tagSynonyms = guideData?.evaluation_rules?.tag_synonyms?.[tag] || [];
    const prettyTag = tag.replace(/-/g, ' ');
    return Array.from(new Set([tag, prettyTag, ...tagSynonyms].map((item) => normalizeForMatch(item)).filter(Boolean)));
};

const pickFeedbackText = (messages, fallback = '') => messages?.find(Boolean) || fallback;

export const evaluateTutorCardResponse = (guideData, cardLike, answer) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    if (!normalizedGuideData) {
        return {
            outcome: 'incorrect',
            score: 0,
            matchedTags: [],
            missingTags: [],
            misconceptionId: null,
            feedback: '',
            cue: { expression: 'soft_concern_mistake', animation: 'paw_point_hint' },
        };
    }

    const card = normalizedGuideData.cards.find((item) => item.id === cardLike?.id) || cardLike;
    const answerText = normalizeText(answer, '');
    const answerNormalized = normalizeForMatch(answerText);
    const emptyPatterns = (normalizedGuideData.evaluation_rules.empty_patterns || []).map(normalizeForMatch);

    if (!answerNormalized || emptyPatterns.includes(answerNormalized)) {
        return {
            outcome: 'empty',
            score: 0,
            matchedTags: [],
            missingTags: card?.required_idea_tags || [],
            misconceptionId: null,
            feedback: pickFeedbackText(card?.feedback?.empty, 'Start with one precise idea.'),
            cue: normalizedGuideData.river.cue_map.recover,
        };
    }

    const misconceptionRule = normalizedGuideData.evaluation_rules.misconception_rules.find((rule) => {
        if (!rule?.id) return false;
        const cardAllowsRule = (card?.misconception_tags || []).includes(rule.id)
            || rule.concept_id === card?.concept_id;
        return cardAllowsRule
            && (rule.trigger_phrases || []).some((phrase) => answerNormalized.includes(normalizeForMatch(phrase)));
    }) || null;

    if (misconceptionRule) {
        const misconceptionFeedback = card?.feedback?.misconception?.find(
            (entry) => entry.misconception_id === misconceptionRule.id,
        );

        return {
            outcome: 'misconception',
            score: 0.1,
            matchedTags: [],
            missingTags: card?.required_idea_tags || [],
            misconceptionId: misconceptionRule.id,
            feedback: pickFeedbackText(
                misconceptionFeedback?.responses,
                misconceptionRule.correction || 'That answer is mixing concepts.',
            ),
            cue: normalizedGuideData.river.cue_map.recover,
        };
    }

    const requiredTags = card?.required_idea_tags || [];
    const optionalTags = card?.optional_idea_tags || [];
    const matchedRequiredTags = requiredTags.filter((tag) => (
        getTagCandidates(normalizedGuideData, tag).some((candidate) => answerNormalized.includes(candidate))
    ));
    const matchedOptionalTags = optionalTags.filter((tag) => (
        getTagCandidates(normalizedGuideData, tag).some((candidate) => answerNormalized.includes(candidate))
    ));
    const requiredRatio = requiredTags.length > 0 ? matchedRequiredTags.length / requiredTags.length : 1;
    const optionalRatio = optionalTags.length > 0 ? matchedOptionalTags.length / optionalTags.length : 0;
    const score = optionalTags.length > 0
        ? (requiredRatio * 0.9) + (optionalRatio * 0.1)
        : requiredRatio;
    const correctThreshold = normalizedGuideData.evaluation_rules.score_bands.correct;
    const partialThreshold = normalizedGuideData.evaluation_rules.score_bands.partial;
    const missingTags = requiredTags.filter((tag) => !matchedRequiredTags.includes(tag));

    let outcome = 'incorrect';
    if (requiredRatio >= 1 && score >= correctThreshold) {
        outcome = 'correct';
    } else if (matchedRequiredTags.length > 0 || score >= partialThreshold) {
        outcome = 'partial';
    }

    const cue = outcome === 'correct'
        ? normalizedGuideData.river.cue_map.mastery
        : outcome === 'partial'
            ? normalizedGuideData.river.cue_map.focus
            : normalizedGuideData.river.cue_map.recover;

    return {
        outcome,
        score,
        matchedTags: [...matchedRequiredTags, ...matchedOptionalTags],
        missingTags,
        misconceptionId: null,
        feedback: outcome === 'correct'
            ? pickFeedbackText(card?.feedback?.correct, 'That is correct.')
            : outcome === 'partial'
                ? pickFeedbackText(card?.feedback?.partial, 'You have part of it. Tighten the missing idea.')
                : pickFeedbackText(card?.feedback?.incorrect, 'Reset around the main idea and try again.'),
        cue,
    };
};

const getConceptCards = (guideData, conceptId) => (
    (guideData?.cards || []).filter((card) => card.concept_id === conceptId)
);

const getSectionCompletion = (guideData, normalizedStudyState, section) => {
    const conceptState = normalizedStudyState.concept_mastery?.[section.id];
    if ((conceptState?.score || 0) >= 80) return true;

    const conceptCards = getConceptCards(guideData, section.id);
    return conceptCards.length > 0 && conceptCards.every((card) => normalizedStudyState.card_states?.[card.id]?.completed);
};

export const getGuideProgress = (guideData, studyState) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    const sections = normalizedGuideData?.sections || [];

    const completedCount = sections.filter((section) => getSectionCompletion(normalizedGuideData, normalizedStudyState, section)).length;
    const revealedCount = Object.values(normalizedStudyState.card_states || {}).filter((cardState) => (cardState?.attempts || 0) > 0).length;
    const totalSections = sections.length;

    return {
        totalSections,
        completedCount,
        revealedCount,
        completionPercent: totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0,
        currentSectionId: normalizedStudyState.current_card_id,
        nextSectionId: normalizedGuideData?.sections.find(
            (section) => !getSectionCompletion(normalizedGuideData, normalizedStudyState, section),
        )?.id || sections[0]?.id || null,
    };
};

export const guideDataToPlainText = (guideData) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    if (!normalizedGuideData) return '';

    return [
        `Subject: ${normalizedGuideData.session_meta.subject}`,
        `Goal: ${normalizedGuideData.session_meta.student_goal}`,
        ...normalizedGuideData.sections.map((section, index) => {
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

export const getGuideStudySourceText = (guide) => {
    if (isActiveRecallGuide(guide)) {
        return guideDataToPlainText(guide.guide_data);
    }

    return extractTextFromDoc(guide?.content).replace(/\s+/g, ' ').trim();
};

export const getSectionStatus = (sectionState, sectionLastReviewedAt) => {
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

export const getSectionMasteryScore = (section, sectionState) => clampNumber(
    sectionState?.score ?? sectionState?.mastery_score,
    { min: 0, max: 100, fallback: 0 },
);

export const estimateNextReviewAt = (sectionState, options = {}) => {
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

export const getGuideMasterySnapshot = (guideData, studyState, options = {}) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
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
        const conceptState = normalizedStudyState.concept_mastery?.[section.id] || buildDefaultConceptState();
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

export const getWeakSections = (guideData, studyState) => {
    const snapshot = getGuideMasterySnapshot(guideData, studyState);
    return snapshot.recommendedSections.filter((section) => section.masteryScore < 80);
};

export const estimateSectionEffortMinutes = (section) => {
    const cardCount = Array.isArray(section?.card_ids) ? section.card_ids.length : 1;
    return Math.max(3, Math.min(12, cardCount * 2 + 1));
};

export const estimateSessionEffortMinutes = (sections = []) => (
    sections.reduce((total, section) => total + estimateSectionEffortMinutes(section), 0)
);

export const getSessionSections = (guideData, studyState, durationMinutes) => {
    const snapshot = getGuideMasterySnapshot(guideData, studyState);
    const ranked = snapshot.recommendedSections;
    const selected = [];
    let remaining = durationMinutes;

    for (const section of ranked) {
        const cost = estimateSectionEffortMinutes(section);
        if (remaining >= cost || selected.length === 0) {
            selected.push(section);
            remaining -= cost;
        }
        if (remaining <= 0) break;
    }

    return selected;
};

export const updateSection = (guideData, sectionId, updates) => {
    const normalized = normalizeGuideData(guideData);
    if (!normalized) return guideData;

    const nextKnowledgeMap = {
        ...normalized.knowledge_map,
        concepts: normalized.knowledge_map.concepts.map((concept) => (
            concept.id === sectionId
                ? {
                    ...concept,
                    title: updates.title ?? concept.title,
                    summary: updates.summary ?? concept.summary,
                    misconception_tags: updates.common_traps ?? concept.misconception_tags,
                }
                : concept
        )),
    };

    return normalizeGuideData({
        ...normalized,
        knowledge_map: nextKnowledgeMap,
    });
};

export const getRecommendedSession = (guideData, studyState) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const weak = getWeakSections(guideData, studyState);
    if (!normalizedGuideData) return { type: 'full', sections: [], label: 'Start Session', detail: '' };

    if (weak.length > 0) {
        return {
            type: 'weak',
            sections: weak.slice(0, 3),
            label: 'Review weak concepts',
            detail: `${weak.length} concept${weak.length === 1 ? '' : 's'} need support`,
        };
    }

    const progress = getGuideProgress(guideData, studyState);
    if (progress.completedCount < progress.totalSections) {
        const incomplete = normalizedGuideData.sections.filter((section) => {
            const conceptState = normalizeGuideStudyState(guideData, studyState).concept_mastery?.[section.id];
            return (conceptState?.score || 0) < 80;
        });

        return {
            type: 'continue',
            sections: incomplete,
            label: 'Continue session',
            detail: `${incomplete.length} concept${incomplete.length === 1 ? '' : 's'} still in progress`,
        };
    }

    return {
        type: 'full',
        sections: normalizedGuideData.sections,
        label: 'Full review',
        detail: `All ${normalizedGuideData.sections.length} concepts`,
    };
};

export const getSessionDelta = (guideData, stateBefore, stateAfter) => {
    const beforeSnapshot = getGuideMasterySnapshot(guideData, stateBefore);
    const afterSnapshot = getGuideMasterySnapshot(guideData, stateAfter);
    const beforeState = normalizeGuideStudyState(guideData, stateBefore);
    const afterState = normalizeGuideStudyState(guideData, stateAfter);
    const sectionIds = Object.keys(afterState.concept_mastery || {});

    const reviewedSections = sectionIds.filter((sectionId) => {
        const beforeConcept = beforeState.concept_mastery?.[sectionId] || buildDefaultConceptState();
        const afterConcept = afterState.concept_mastery?.[sectionId] || buildDefaultConceptState();
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
