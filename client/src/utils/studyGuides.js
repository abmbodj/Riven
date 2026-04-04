import { extractTextFromDoc } from './sharedResources';

export const STUDY_GUIDE_FORMAT_VERSION = 3;
export const ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION = 2;
export const STUDY_GUIDE_CONFIDENCE_OPTIONS = [
    { value: 'need_work', label: 'Need Work' },
    { value: 'okay', label: 'Okay' },
    { value: 'know_it', label: 'Know It' },
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SECTION_PRIORITY = ['review_now', 'coming_up', 'review_soon', 'good'];
const MINUTES_PER_SECTION = 3;
const QUIZ_EXTRA_MINUTES = 1;
const FLASHCARD_EXTRA_MINUTES = 1;

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

const normalizeStringArray = (value) => (
    Array.isArray(value)
        ? value
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        : []
);

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

const normalizeQuizItems = (value) => (
    Array.isArray(value)
        ? value.map((item, index) => {
            if (typeof item === 'string') {
                const prompt = item.trim();
                return prompt ? { prompt, answer: '' } : null;
            }
            if (!item || typeof item !== 'object') return null;
            const prompt = normalizeText(
                item.prompt ?? item.question,
                `Checkpoint ${index + 1}`,
            );
            const answer = normalizeText(item.answer, '');
            return { prompt, answer };
        }).filter(Boolean)
        : []
);

const normalizeFlashcards = (value) => (
    Array.isArray(value)
        ? value.map((item, index) => {
            if (typeof item === 'string') {
                const front = item.trim();
                return front ? { front, back: '' } : null;
            }
            if (!item || typeof item !== 'object') return null;
            const front = normalizeText(item.front ?? item.prompt, `Flashcard ${index + 1}`);
            const back = normalizeText(item.back ?? item.answer, '');
            return { front, back };
        }).filter(Boolean)
        : []
);

const normalizeKeyTerms = (value) => (
    Array.isArray(value)
        ? value.map((item) => {
            if (typeof item === 'string') {
                const term = item.trim();
                return term ? { term, definition: '' } : null;
            }
            if (!item || typeof item !== 'object') return null;
            const term = normalizeOptionalText(item.term ?? item.title ?? item.label);
            if (!term) return null;
            return {
                term,
                definition: normalizeText(item.definition, ''),
            };
        }).filter(Boolean)
        : []
);

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

    const steps = normalizeStringArray(value.steps ?? value.items ?? value.points);
    if (steps.length === 0) return null;

    return {
        type,
        title: normalizeText(value.title, ''),
        steps,
    };
};

const normalizeSectionState = (incoming = {}) => ({
    revealed: Boolean(incoming.revealed),
    confidence: typeof incoming.confidence === 'string' ? incoming.confidence : null,
    completed: Boolean(incoming.completed),
    note: typeof incoming.note === 'string' ? incoming.note : '',
    last_reviewed_at: typeof incoming.last_reviewed_at === 'string' ? incoming.last_reviewed_at : null,
    next_review_at: typeof incoming.next_review_at === 'string' ? incoming.next_review_at : null,
    quiz_correct: Number.isFinite(Number(incoming.quiz_correct)) ? Number(incoming.quiz_correct) : 0,
    quiz_total: Number.isFinite(Number(incoming.quiz_total)) ? Number(incoming.quiz_total) : 0,
    current_difficulty: normalizeText(incoming.current_difficulty, ''),
    mastery_score: Number.isFinite(Number(incoming.mastery_score)) ? Number(incoming.mastery_score) : null,
});

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

const buildV2Section = (section, index, usedIds) => {
    if (!section || typeof section !== 'object') return null;
    const title = normalizeText(section.title, `Section ${index + 1}`);
    const id = ensureUniqueId(section.id ?? title, usedIds, `section-${index + 1}`);

    return {
        id,
        topic_id: 'topic-general',
        topic_title: 'Study Guide',
        title,
        summary: normalizeText(
            section.summary,
            normalizeText(section.answer_points?.[0], ''),
        ),
        recall_prompt: normalizeText(
            section.recall_prompt,
            `Explain ${title} from memory before revealing the answer.`,
        ),
        answer_points: normalizeStringArray(section.answer_points),
        key_terms: normalizeKeyTerms(section.key_terms),
        mini_quiz: normalizeQuizItems(section.mini_quiz),
        checks: normalizeQuizItems(section.mini_quiz),
        flashcards: normalizeFlashcards(section.flashcards),
        common_traps: normalizeStringArray(section.common_traps),
        visual: normalizeVisual(section.visual),
        ai_helpers: normalizeAiHelpers(section.ai_helpers),
    };
};

const buildV3Subtopic = (topic, subtopic, topicIndex, subtopicIndex, topicUsedIds, sectionUsedIds) => {
    if (!subtopic || typeof subtopic !== 'object') return null;

    const topicTitle = normalizeText(topic?.title, `Topic ${topicIndex + 1}`);
    const topicId = ensureUniqueId(topic?.id ?? topicTitle, topicUsedIds, `topic-${topicIndex + 1}`);
    const title = normalizeText(subtopic.title, `Subtopic ${subtopicIndex + 1}`);
    const id = ensureUniqueId(subtopic.id ?? title, sectionUsedIds, `subtopic-${subtopicIndex + 1}`);
    const checks = normalizeQuizItems(subtopic.checks ?? subtopic.mini_quiz);

    return {
        id,
        topic_id: topicId,
        topic_title: topicTitle,
        title,
        summary: normalizeText(
            subtopic.summary,
            normalizeText(subtopic.answer_points?.[0], ''),
        ),
        recall_prompt: normalizeText(
            subtopic.recall_prompt,
            `Explain ${title} from memory before revealing the answer.`,
        ),
        answer_points: normalizeStringArray(subtopic.answer_points),
        key_terms: normalizeKeyTerms(subtopic.key_terms),
        checks,
        mini_quiz: checks,
        flashcards: normalizeFlashcards(subtopic.flashcards),
        common_traps: normalizeStringArray(subtopic.common_traps),
        visual: normalizeVisual(subtopic.visual),
        ai_helpers: normalizeAiHelpers(subtopic.ai_helpers),
    };
};

const buildV2Topics = (sections) => (
    [{
        id: 'topic-general',
        title: 'Study Guide',
        subtopics: sections.map((section) => ({
            ...section,
            checks: section.mini_quiz,
        })),
    }]
);

export const normalizeGuideData = (guideData) => {
    if (!guideData || typeof guideData !== 'object') return null;

    const overview = normalizeText(
        guideData.overview,
        'Review each section actively before revealing the answers.',
    );

    if (Array.isArray(guideData.topics) && guideData.topics.length > 0) {
        const topicUsedIds = new Set();
        const sectionUsedIds = new Set();
        const topics = guideData.topics.map((topic, topicIndex) => {
            if (!topic || typeof topic !== 'object') return null;
            const topicTitle = normalizeText(topic.title, `Topic ${topicIndex + 1}`);
            const topicId = ensureUniqueId(topic.id ?? topicTitle, topicUsedIds, `topic-${topicIndex + 1}`);
            const subtopics = Array.isArray(topic.subtopics)
                ? topic.subtopics.map((subtopic, subtopicIndex) => (
                    buildV3Subtopic(
                        { ...topic, id: topicId, title: topicTitle },
                        subtopic,
                        topicIndex,
                        subtopicIndex,
                        topicUsedIds,
                        sectionUsedIds,
                    )
                )).filter(Boolean)
                : [];

            if (subtopics.length === 0) return null;

            return {
                id: topicId,
                title: topicTitle,
                summary: normalizeText(topic.summary, ''),
                subtopics,
            };
        }).filter(Boolean);

        const sections = topics.flatMap((topic) => (
            topic.subtopics.map((subtopic) => ({
                ...subtopic,
                topic_id: topic.id,
                topic_title: topic.title,
            }))
        ));

        if (sections.length === 0) return null;

        return {
            version: 3,
            overview,
            topics,
            sections,
        };
    }

    const usedIds = new Set();
    const sections = Array.isArray(guideData.sections)
        ? guideData.sections.map((section, index) => buildV2Section(section, index, usedIds)).filter(Boolean)
        : [];

    if (sections.length === 0) return null;

    return {
        version: 2,
        overview,
        topics: buildV2Topics(sections),
        sections,
    };
};

export const isActiveRecallGuide = (guide) => (
    Number(guide?.format_version) >= ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION
    && Boolean(normalizeGuideData(guide?.guide_data))
);

export const normalizeGuideStudyState = (guideData, studyState) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    if (!normalizedGuideData) {
        return {
            current_section_id: null,
            section_states: {},
            last_reviewed_at: null,
        };
    }

    const raw = studyState && typeof studyState === 'object' ? studyState : {};
    const sectionStates = Object.fromEntries(
        normalizedGuideData.sections.map((section) => {
            const incoming = raw.section_states?.[section.id] ?? {};
            return [section.id, {
                ...buildDefaultSectionState(),
                ...normalizeSectionState(incoming),
            }];
        }),
    );

    const currentSectionId = (
        typeof raw.current_section_id === 'string' && sectionStates[raw.current_section_id]
            ? raw.current_section_id
            : normalizedGuideData.sections.find((section) => !sectionStates[section.id]?.completed)?.id
                || normalizedGuideData.sections[0]?.id
                || null
    );

    return {
        current_section_id: currentSectionId,
        section_states: sectionStates,
        last_reviewed_at: typeof raw.last_reviewed_at === 'string' ? raw.last_reviewed_at : null,
    };
};

export const getGuideProgress = (guideData, studyState) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    const sections = normalizedGuideData?.sections || [];
    const completedCount = sections.filter((section) => normalizedStudyState.section_states[section.id]?.completed).length;
    const revealedCount = sections.filter((section) => normalizedStudyState.section_states[section.id]?.revealed).length;
    const totalSections = sections.length;
    const completionPercent = totalSections > 0
        ? Math.round((completedCount / totalSections) * 100)
        : 0;

    return {
        totalSections,
        completedCount,
        revealedCount,
        completionPercent,
        currentSectionId: normalizedStudyState.current_section_id,
        nextSectionId: normalizedStudyState.current_section_id
            || sections.find((section) => !normalizedStudyState.section_states[section.id]?.completed)?.id
            || sections[0]?.id
            || null,
    };
};

const formatKeyTermsPlainText = (keyTerms) => (
    (keyTerms ?? [])
        .map((item) => {
            if (typeof item === 'string') return item;
            if (!item || typeof item !== 'object') return '';
            if (item.definition) return `${item.term}: ${item.definition}`;
            return item.term || '';
        })
        .filter(Boolean)
        .join(', ')
);

export const guideDataToPlainText = (guideData) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    if (!normalizedGuideData) return '';

    return [
        `Overview:\n${normalizedGuideData.overview}`,
        ...normalizedGuideData.sections.map((section, index) => {
            const lines = [
                `Section ${index + 1}: ${section.title}`,
                `Recall Prompt: ${section.recall_prompt}`,
            ];

            if (section.summary) {
                lines.push(`Summary: ${section.summary}`);
            }

            if (section.answer_points.length > 0) {
                lines.push(`Answer Points:\n${section.answer_points.map((point) => `- ${point}`).join('\n')}`);
            }

            if (section.key_terms.length > 0) {
                lines.push(`Key Terms: ${formatKeyTermsPlainText(section.key_terms)}`);
            }

            if (section.mini_quiz.length > 0) {
                lines.push(`Mini Quiz:\n${section.mini_quiz.map((item) => `- ${item.prompt}${item.answer ? ` -> ${item.answer}` : ''}`).join('\n')}`);
            }

            if (section.flashcards.length > 0) {
                lines.push(`Flashcards:\n${section.flashcards.map((item) => `- ${item.front}${item.back ? ` -> ${item.back}` : ''}`).join('\n')}`);
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
    const confidence = sectionState?.confidence ?? null;
    if (!confidence) return 'review_now';
    if (confidence === 'need_work') return 'review_now';
    if (confidence === 'okay') return 'coming_up';
    if (confidence === 'know_it') {
        if (!sectionLastReviewedAt) return 'review_soon';
        const daysSince = (Date.now() - new Date(sectionLastReviewedAt).getTime()) / DAY_IN_MS;
        return daysSince > 3 ? 'review_soon' : 'good';
    }
    return 'review_now';
};

const getDaysSince = (value, now = Date.now()) => {
    if (!value) return Number.POSITIVE_INFINITY;
    const date = new Date(value).getTime();
    if (Number.isNaN(date)) return Number.POSITIVE_INFINITY;
    return Math.max(0, (now - date) / DAY_IN_MS);
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

const getConfidenceBaseScore = (confidence) => {
    if (confidence === 'know_it') return 80;
    if (confidence === 'okay') return 56;
    if (confidence === 'need_work') return 28;
    return 18;
};

export const getSectionMasteryScore = (section, sectionState, options = {}) => {
    const nowValue = options.now ? new Date(options.now).getTime() : Date.now();
    const quizTotal = Math.max(0, Number(sectionState?.quiz_total) || 0);
    const quizCorrect = Math.max(0, Number(sectionState?.quiz_correct) || 0);
    const quizRatio = quizTotal > 0 ? quizCorrect / quizTotal : null;
    const daysSince = getDaysSince(sectionState?.last_reviewed_at ?? null, nowValue);
    const hasChecks = (section?.mini_quiz?.length ?? 0) > 0 || (section?.checks?.length ?? 0) > 0;

    let score = getConfidenceBaseScore(sectionState?.confidence);

    if (sectionState?.completed) score += 8;
    if (sectionState?.revealed) score += 4;

    if (quizRatio != null) {
        score += ((quizRatio * 100) - 50) * 0.28;
    } else if (hasChecks && sectionState?.confidence === 'need_work') {
        score -= 6;
    }

    if (!Number.isFinite(daysSince)) {
        score -= 4;
    } else if (daysSince > 14) {
        score -= 18;
    } else if (daysSince > 7) {
        score -= 11;
    } else if (daysSince > 3) {
        score -= 5;
    }

    if (sectionState?.next_review_at) {
        const nextReviewAt = new Date(sectionState.next_review_at).getTime();
        if (!Number.isNaN(nextReviewAt) && nextReviewAt < nowValue) {
            score -= 6;
        }
    }

    return clampScore(score);
};

const getMasteryBand = (score) => {
    if (score < 40) return 'support';
    if (score < 75) return 'standard';
    return 'challenge';
};

export const estimateNextReviewAt = (sectionState, options = {}) => {
    const nowValue = options.now ? new Date(options.now).getTime() : Date.now();
    const confidence = sectionState?.confidence ?? null;
    const quizTotal = Math.max(0, Number(sectionState?.quiz_total) || 0);
    const quizCorrect = Math.max(0, Number(sectionState?.quiz_correct) || 0);
    const quizRatio = quizTotal > 0 ? quizCorrect / quizTotal : null;

    let offsetDays = 1;
    if (confidence === 'know_it') offsetDays = 5;
    else if (confidence === 'okay') offsetDays = 2;
    else if (confidence === 'need_work') offsetDays = 1;

    if (quizRatio != null) {
        if (quizRatio >= 0.8) offsetDays += 2;
        else if (quizRatio < 0.5) offsetDays = Math.max(1, offsetDays - 1);
    }

    return new Date(nowValue + (offsetDays * DAY_IN_MS)).toISOString();
};

export const getGuideMasterySnapshot = (guideData, studyState, options = {}) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    if (!normalizedGuideData) {
        return {
            averageMastery: 0,
            weakCount: 0,
            masteryBands: { support: [], standard: [], challenge: [] },
            recommendedSections: [],
            nextReviewAt: null,
        };
    }

    const nowValue = options.now ? new Date(options.now).getTime() : Date.now();
    const linkedExamAt = options.linkedExamAt ? new Date(options.linkedExamAt).getTime() : null;
    const examIsSoon = Number.isFinite(linkedExamAt)
        ? linkedExamAt - nowValue <= (3 * DAY_IN_MS)
        : false;

    const entries = normalizedGuideData.sections.map((section) => {
        const sectionState = normalizedStudyState.section_states[section.id] || buildDefaultSectionState();
        const masteryScore = getSectionMasteryScore(section, sectionState, { now: nowValue });
        const status = getSectionStatus(sectionState, sectionState.last_reviewed_at);
        const weakScore = 100 - masteryScore;
        const daysSince = getDaysSince(sectionState.last_reviewed_at, nowValue);
        const quizPressure = Math.max(0, (Number(sectionState.quiz_total) || 0) - (Number(sectionState.quiz_correct) || 0));
        const priorityScore = weakScore
            + (status === 'review_now' ? 25 : status === 'coming_up' ? 14 : 0)
            + (!sectionState.completed ? 8 : 0)
            + (Number.isFinite(daysSince) ? Math.min(18, Math.round(daysSince * 2)) : 10)
            + (sectionState.confidence === 'need_work' ? 24 : sectionState.confidence === 'okay' ? 8 : 0)
            + quizPressure * 16
            + (examIsSoon ? 30 : 0);

        return {
            ...section,
            masteryScore,
            masteryBand: getMasteryBand(masteryScore),
            status,
            nextReviewAt: sectionState.next_review_at || estimateNextReviewAt(sectionState, { now: nowValue }),
            priorityScore,
            priorityReason: examIsSoon && masteryScore < 75
                ? 'Upcoming exam increases urgency for this weak area.'
                : masteryScore < 40
                    ? 'Low mastery and recent struggle make this the best next review target.'
                    : !sectionState.completed
                        ? 'This checkpoint is still incomplete.'
                        : 'This area is due for another pass soon.',
        };
    });

    const masteryBands = {
        support: entries.filter((entry) => entry.masteryBand === 'support'),
        standard: entries.filter((entry) => entry.masteryBand === 'standard'),
        challenge: entries.filter((entry) => entry.masteryBand === 'challenge'),
    };

    const recommendedSections = [...entries].sort((left, right) => right.priorityScore - left.priorityScore);
    const averageMastery = entries.length
        ? Math.round(entries.reduce((total, entry) => total + entry.masteryScore, 0) / entries.length)
        : 0;

    const nextReviewAt = entries
        .map((entry) => entry.nextReviewAt)
        .filter(Boolean)
        .sort()[0] || null;

    return {
        averageMastery,
        weakCount: masteryBands.support.length + entries.filter((entry) => entry.status === 'coming_up').length,
        masteryBands,
        recommendedSections,
        nextReviewAt,
    };
};

export const getWeakSections = (guideData, studyState) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    if (!normalizedGuideData) return [];
    return normalizedGuideData.sections.filter((section) => {
        const sectionState = normalizedStudyState.section_states[section.id];
        const status = getSectionStatus(sectionState, sectionState?.last_reviewed_at ?? null);
        return status === 'review_now' || status === 'coming_up';
    });
};

export const estimateSectionEffortMinutes = (section) => (
    MINUTES_PER_SECTION
    + (((section?.mini_quiz?.length ?? 0) > 0) ? QUIZ_EXTRA_MINUTES : 0)
    + (((section?.flashcards?.length ?? 0) > 0) ? FLASHCARD_EXTRA_MINUTES : 0)
);

export const estimateSessionEffortMinutes = (sections = []) => (
    sections.reduce((total, section) => total + estimateSectionEffortMinutes(section), 0)
);

export const getSessionSections = (guideData, studyState, durationMinutes) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    if (!normalizedGuideData) return [];

    const ranked = normalizedGuideData.sections
        .map((section) => {
            const sectionState = normalizedStudyState.section_states[section.id];
            const status = getSectionStatus(sectionState, sectionState?.last_reviewed_at ?? null);
            return { section, status, priority: SECTION_PRIORITY.indexOf(status) };
        })
        .sort((left, right) => left.priority - right.priority);

    const selected = [];
    let budget = durationMinutes;

    for (const { section } of ranked) {
        const cost = estimateSectionEffortMinutes(section);
        if (budget >= cost) {
            selected.push(section);
            budget -= cost;
        }
        if (budget < MINUTES_PER_SECTION) break;
    }

    return selected;
};

export const updateSection = (guideData, sectionId, updates) => {
    const normalized = normalizeGuideData(guideData);
    if (!normalized) return guideData;

    const nextSections = normalized.sections.map((section) => (
        section.id === sectionId
            ? {
                ...section,
                ...updates,
                checks: updates.checks ?? updates.mini_quiz ?? section.checks,
                mini_quiz: updates.mini_quiz ?? updates.checks ?? section.mini_quiz,
            }
            : section
    ));

    const nextTopics = normalized.topics.map((topic) => ({
        ...topic,
        subtopics: topic.subtopics.map((subtopic) => (
            subtopic.id === sectionId
                ? nextSections.find((section) => section.id === sectionId)
                : subtopic
        )),
    }));

    return {
        ...normalized,
        topics: nextTopics,
        sections: nextSections,
    };
};

export const getRecommendedSession = (guideData, studyState) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    if (!normalizedGuideData) return { type: 'full', sections: [], label: 'Start Session', detail: '' };

    const weak = getWeakSections(guideData, studyState);
    if (weak.length > 0) {
        const names = weak.slice(0, 2).map((section) => section.title).join(' + ');
        const extra = weak.length > 2 ? ` + ${weak.length - 2} more` : '';
        return {
            type: 'weak',
            sections: weak,
            label: 'Review Weak Sections',
            detail: `${names}${extra} · ~${estimateSessionEffortMinutes(weak)} min`,
        };
    }

    const incomplete = normalizedGuideData.sections.filter(
        (section) => !normalizedStudyState.section_states[section.id]?.completed,
    );
    if (incomplete.length > 0) {
        return {
            type: 'continue',
            sections: incomplete,
            label: 'Continue Session',
            detail: `${incomplete.length} section${incomplete.length !== 1 ? 's' : ''} remaining`,
        };
    }

    return {
        type: 'full',
        sections: normalizedGuideData.sections,
        label: 'Full Review',
        detail: `All ${normalizedGuideData.sections.length} sections`,
    };
};

export const getSessionDelta = (guideData, stateBefore, stateAfter) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    if (!normalizedGuideData) {
        return {
            masteryDeltaPercent: 0,
            weakCountBefore: 0,
            weakCountAfter: 0,
            sectionsReviewed: 0,
        };
    }

    const normalizedBefore = normalizeGuideStudyState(guideData, stateBefore);
    const normalizedAfter = normalizeGuideStudyState(guideData, stateAfter);
    const sections = normalizedGuideData.sections;
    const total = sections.length;

    const completedBefore = sections.filter((section) => normalizedBefore.section_states[section.id]?.completed).length;
    const completedAfter = sections.filter((section) => normalizedAfter.section_states[section.id]?.completed).length;

    const masteryBefore = total > 0 ? Math.round((completedBefore / total) * 100) : 0;
    const masteryAfter = total > 0 ? Math.round((completedAfter / total) * 100) : 0;

    const weakBefore = getWeakSections(guideData, stateBefore).length;
    const weakAfter = getWeakSections(guideData, stateAfter).length;

    const sectionsReviewed = sections.filter((section) => {
        const before = normalizedBefore.section_states[section.id];
        const after = normalizedAfter.section_states[section.id];
        return !before?.completed && after?.completed;
    }).length;

    return {
        masteryDeltaPercent: masteryAfter - masteryBefore,
        weakCountBefore: weakBefore,
        weakCountAfter: weakAfter,
        sectionsReviewed,
    };
};
