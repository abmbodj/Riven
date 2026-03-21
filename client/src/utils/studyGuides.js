import { extractTextFromDoc } from './sharedResources';

export const STUDY_GUIDE_FORMAT_VERSION = 2;
export const STUDY_GUIDE_CONFIDENCE_OPTIONS = [
    { value: 'need_work', label: 'Need Work' },
    { value: 'okay', label: 'Okay' },
    { value: 'know_it', label: 'Know It' },
];

const normalizeText = (value, fallback = '') => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};

const normalizeStringArray = (value) => (
    Array.isArray(value)
        ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
        : []
);

const normalizeMiniQuiz = (value) => (
    Array.isArray(value)
        ? value.map((item, index) => {
            if (typeof item === 'string') {
                const prompt = item.trim();
                return prompt ? { prompt, answer: '' } : null;
            }
            if (!item || typeof item !== 'object') return null;
            const prompt = normalizeText(item.prompt ?? item.question, `Checkpoint ${index + 1}`);
            const answer = typeof item.answer === 'string' ? item.answer.trim() : '';
            return { prompt, answer };
        }).filter(Boolean)
        : []
);

export const normalizeGuideData = (guideData) => {
    if (!guideData || typeof guideData !== 'object') return null;
    const sections = Array.isArray(guideData.sections)
        ? guideData.sections.map((section, index) => {
            if (!section || typeof section !== 'object') return null;
            const title = normalizeText(section.title, `Section ${index + 1}`);
            const id = normalizeText(section.id, `section-${index + 1}`);
            return {
                id,
                title,
                recall_prompt: normalizeText(section.recall_prompt, `Explain ${title} from memory before revealing the answer.`),
                answer_points: normalizeStringArray(section.answer_points),
                key_terms: normalizeStringArray(section.key_terms),
                mini_quiz: normalizeMiniQuiz(section.mini_quiz),
                common_traps: normalizeStringArray(section.common_traps),
            };
        }).filter(Boolean)
        : [];

    if (sections.length === 0) return null;

    return {
        overview: normalizeText(guideData.overview, 'Review each section actively before revealing the answers.'),
        sections,
    };
};

export const isActiveRecallGuide = (guide) => (
    Number(guide?.format_version) >= STUDY_GUIDE_FORMAT_VERSION
    && Boolean(normalizeGuideData(guide?.guide_data))
);

const buildDefaultSectionState = () => ({
    revealed: false,
    confidence: null,
    completed: false,
    note: '',
});

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
                revealed: Boolean(incoming.revealed),
                confidence: typeof incoming.confidence === 'string' ? incoming.confidence : null,
                completed: Boolean(incoming.completed),
                note: typeof incoming.note === 'string' ? incoming.note : '',
            }];
        })
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

            if (section.answer_points.length > 0) {
                lines.push(`Answer Points:\n${section.answer_points.map((point) => `- ${point}`).join('\n')}`);
            }

            if (section.key_terms.length > 0) {
                lines.push(`Key Terms: ${section.key_terms.join(', ')}`);
            }

            if (section.mini_quiz.length > 0) {
                lines.push(`Mini Quiz:\n${section.mini_quiz.map((item) => `- ${item.prompt}${item.answer ? ` -> ${item.answer}` : ''}`).join('\n')}`);
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

