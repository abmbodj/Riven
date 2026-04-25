import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import SubjectRenderer from '../components/ui/SubjectRenderer';
import RiverMascot from '../components/study/RiverMascot.jsx';
import {
    ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION,
    evaluateTutorCardResponse,
    normalizeGuideData,
    normalizeGuideStudyState,
} from '../utils/studyGuides.js';

const PANEL_EASE = [0.22, 1, 0.36, 1];

// Explain chunking: keep paragraphs whole when short; otherwise pack ~1-2 sentences per beat.
const CHUNK_MIN_CHARS = 180;
const CHUNK_TARGET_CHARS = 280;
const CHUNK_MAX_CHARS = 380;

const chunkExplain = (raw) => {
    if (!raw || typeof raw !== 'string') return [];
    const paragraphs = raw.split('\n\n').map((p) => p.trim()).filter(Boolean);
    const out = [];
    for (const para of paragraphs) {
        if (para.length <= CHUNK_MAX_CHARS) {
            out.push(para);
            continue;
        }
        const sentences = (para.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [para])
            .map((s) => s.trim())
            .filter(Boolean);
        let buf = '';
        for (const s of sentences) {
            if (!buf) {
                buf = s;
                continue;
            }
            if ((`${buf} ${s}`).length > CHUNK_TARGET_CHARS && buf.length >= CHUNK_MIN_CHARS) {
                out.push(buf);
                buf = s;
            } else {
                buf = `${buf} ${s}`;
            }
        }
        if (buf) out.push(buf);
    }
    return out;
};

// Mirrors POSES.accent values from RiverMascot — drives surface tinting on feedback
const RIVER_POSE_ACCENT = {
    idle: '#8fb27c',
    teach: '#79ad75',
    point: '#c5b56d',
    encourage: '#dcb679',
    thinking: '#8ea9a0',
    'gentle-correct': '#d59678',
    celebrate: '#e7c86f',
};

const EMPTY_STATE = {
    current_card_id: null,
    session_phase: null,
    card_states: {},
    concept_mastery: {},
    last_interaction_at: null,
    completed_at: null,
    last_reviewed_at: null,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getConceptStatus = (score) => {
    if (score >= 80) return 'mastered';
    if (score >= 65) return 'secure';
    if (score >= 45) return 'developing';
    if (score > 0) return 'struggling';
    return 'unseen';
};

const getScoreDelta = (outcome, weight = 1) => {
    if (outcome === 'correct') return 32 * weight;
    if (outcome === 'partial') return 18 * weight;
    if (outcome === 'misconception') return -10;
    if (outcome === 'incorrect') return -6;
    if (outcome === 'empty') return -4;
    return 0;
};

const getNextCardId = (guideData, currentCardId, transitionCardId, cardStates) => {
    if (transitionCardId && !['retry', 'hint'].includes(transitionCardId)) {
        return transitionCardId;
    }

    return guideData.cards.find((card) => (
        card.id !== currentCardId && !cardStates[card.id]?.completed
    ))?.id || null;
};

const buildDefaultCardState = (cardState = {}) => ({
    attempts: cardState.attempts || 0,
    hints_used: cardState.hints_used || 0,
    status: cardState.status || 'unseen',
    last_outcome: cardState.last_outcome || null,
    completed: Boolean(cardState.completed),
    assist_count: cardState.assist_count || 0,
    last_assist_at: cardState.last_assist_at || null,
    revealed_answer: Boolean(cardState.revealed_answer),
    skipped: Boolean(cardState.skipped),
});

const getIntroCaption = (guideData) => (
    guideData?.lecture?.opening
    || guideData?.river?.dialogue_variants?.opening?.[0]
    || 'River is ready to teach this lesson one clean idea at a time.'
);

const getTeachCaption = (currentCard) => (
    currentCard?.teaching?.explain
    || currentCard?.river?.intro
    || 'River is setting the frame before the recall check.'
);

const getCheckCaption = (currentCard) => (
    currentCard?.presentation?.emphasis_target
    ? `Hold onto this anchor: ${currentCard.presentation.emphasis_target}`
    : 'Answer from memory first, then let River tighten the frame.'
);

const getFeedbackState = (outcome) => {
    if (outcome === 'correct' || outcome === 'partial') return 'encourage';
    if (outcome === 'revealed') return 'point';
    return 'gentle-correct';
};

const getFeedbackCaption = (currentCard, result) => {
    if (!result) return getTeachCaption(currentCard);
    if (result.outcome === 'correct') {
        return currentCard?.river?.success || result.feedback;
    }
    if (result.outcome === 'partial') {
        return 'You\'re close! Let me help you get the rest.';
    }
    if (result.outcome === 'revealed') {
        return 'River has revealed the clean answer. Take it in, then decide whether to retry or move on.';
    }
    if (result.followUpQuestion) {
        return 'Don\'t worry, let\'s try again.';
    }
    return currentCard?.river?.struggle || result.feedback;
};

const getCompleteCaption = (guideData, completionPayload) => {
    if (completionPayload?.sessionOutcome === 'stopped_early') {
        return 'Your place is saved. River can pick this lecture back up exactly where you stopped.';
    }

    return guideData?.lecture?.closing
        || guideData?.completion?.confidence_close
        || 'That was a clean pass. Come back tomorrow and retrieve it again.';
};

/**
 * Animates a number from 0 to `target` over `duration` ms with ease-out cubic.
 * Immediately returns `target` when prefers-reduced-motion is active.
 */
function useCountUp(target, duration = 600) {
    const [value, setValue] = useState(0);
    const prefersReduced = useRef(
        typeof window !== 'undefined'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    useEffect(() => {
        if (!target) { setValue(0); return; }
        if (prefersReduced.current) { setValue(target); return; }
        const start = performance.now();
        let raf;
        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            setValue(Math.round((1 - Math.pow(1 - t, 3)) * target));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return value;
}

export default function GuideView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const toastRef = useRef(toast);

    const [loading, setLoading] = useState(true);
    const [guide, setGuide] = useState(null);
    const [guideData, setGuideData] = useState(null);
    const [studyState, setStudyState] = useState(EMPTY_STATE);
    const [formatVersion, setFormatVersion] = useState(0);
    const [sessionStage, setSessionStage] = useState('intro');
    const [answer, setAnswer] = useState('');
    const [result, setResult] = useState(null);
    const [completionPayload, setCompletionPayload] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [riverState, setRiverState] = useState('idle');
    const [riverCaption, setRiverCaption] = useState('River is ready to teach.');
    const [activeAssistOption, setActiveAssistOption] = useState(null);
    const [refinedAnswer, setRefinedAnswer] = useState('');
    const [teachSection, setTeachSection] = useState(0);
    const [expandedSteps, setExpandedSteps] = useState({});
    const [explainRevealed, setExplainRevealed] = useState(1);
    const [fuzzyPeek, setFuzzyPeek] = useState(false);

    const sessionStartStateRef = useRef(null);
    const finalizingRef = useRef(false);
    const sectionRefs = useRef({});

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    const loadGuide = useCallback(async () => {
        setLoading(true);
        try {
            const nextGuide = await api.getStudyGuide(id);
            const normalizedGuideData = normalizeGuideData(nextGuide.guide_data);
            const normalizedStudyState = normalizedGuideData
                ? normalizeGuideStudyState(normalizedGuideData, nextGuide.study_state)
                : EMPTY_STATE;
            const nextFormatVersion = Number(nextGuide.format_version) || 0;

            setGuide(nextGuide);
            setGuideData(normalizedGuideData);
            setStudyState(normalizedStudyState);
            setFormatVersion(nextFormatVersion);
            setSessionStage(normalizedStudyState.completed_at ? 'complete' : 'intro');
            setAnswer('');
            setResult(null);
            setCompletionPayload(null);
            setActiveAssistOption(null);
            setRefinedAnswer('');
            setRiverState(normalizedStudyState.completed_at ? 'celebrate' : 'idle');
            setRiverCaption(normalizedGuideData ? getIntroCaption(normalizedGuideData) : 'River is ready to teach.');
            sessionStartStateRef.current = normalizedStudyState;
            finalizingRef.current = false;
        } catch {
            toastRef.current.error('Failed to load tutor session');
            navigate('/guides');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        loadGuide();
        api.warmupAiFunctions('study-session-complete');
    }, [loadGuide]);

    const unsupported = formatVersion < ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION || !guideData;
    const currentCard = useMemo(() => (
        guideData?.cards.find((card) => card.id === studyState.current_card_id) || guideData?.cards[0] || null
    ), [guideData, studyState.current_card_id]);
    const currentCardState = currentCard
        ? buildDefaultCardState(studyState.card_states?.[currentCard.id] || null)
        : null;
    const currentConcept = currentCard
        ? guideData?.knowledge_map?.concepts.find((concept) => concept.id === currentCard.concept_id) || null
        : null;

    const isToctStyleCard = currentCard?.teaching?.worked_examples?.length > 0
        || Boolean(currentCard?.teaching?.intuition);

    const teachSections = useMemo(() => {
        if (!currentCard?.teaching) return [];
        const t = currentCard.teaching;
        const sections = [];
        sections.push({ key: 'explain', label: 'Explanation', type: 'explain' });
        if (t.intuition) {
            sections.push({ key: 'intuition', label: 'The Why', type: 'intuition' });
        }
        if (t.worked_examples?.length > 0) {
            t.worked_examples.forEach((ex, i) => {
                sections.push({ key: `example-${i}`, label: ex.title || `Example ${i + 1}`, type: 'worked_example', data: ex });
            });
        }
        if (t.common_mistakes?.length > 0) {
            sections.push({ key: 'mistakes', label: 'Watch Out', type: 'common_mistakes' });
        }
        // Fallback for old guides without TOCT fields
        if (sections.length === 1) {
            if (t.steps?.length > 0) sections.push({ key: 'steps', label: 'Breakdown', type: 'legacy_steps' });
            if (t.why_it_matters) sections.push({ key: 'why', label: 'Why It Matters', type: 'legacy_why' });
        }
        return sections;
    }, [currentCard]);

    const explainParagraphs = useMemo(
        () => chunkExplain(currentCard?.teaching?.explain),
        [currentCard],
    );

    const onExplainSection = teachSections[teachSection]?.type === 'explain';
    const explainTotal = explainParagraphs.length;
    const explainFullyRevealed = !onExplainSection || explainRevealed >= explainTotal;
    const showFuzzyPrompt = (
        onExplainSection
        && explainRevealed >= 3
        && explainRevealed < explainTotal
        && explainTotal > 4
    );

    const persistStudyState = useCallback(async (nextState) => {
        const updatedGuide = await api.updateStudyGuide(id, { study_state: nextState });
        const normalizedGuideData = normalizeGuideData(updatedGuide?.guide_data ?? guideData);
        const normalizedStudyState = normalizeGuideStudyState(
            normalizedGuideData,
            updatedGuide?.study_state ?? nextState,
        );

        setGuide((prev) => ({ ...(prev || {}), ...(updatedGuide || {}), guide_data: normalizedGuideData }));
        setGuideData(normalizedGuideData);
        setStudyState(normalizedStudyState);
        return normalizedStudyState;
    }, [guideData, id]);

    const finalizeSession = useCallback(async ({
        nextState,
        sessionOutcome,
        exitReason,
    }) => {
        if (!guideData || finalizingRef.current) return;
        finalizingRef.current = true;

        try {
            const payload = await api.completeStudyCoachSession({
                guideId: id,
                guideData,
                studyStateBefore: sessionStartStateRef.current || studyState,
                studyStateAfter: nextState || studyState,
                mode: 'guided',
                source: 'guide_view',
                classId: guide?.class_id || null,
                sessionOutcome,
                exitReason,
            });

            const normalizedAfter = normalizeGuideStudyState(guideData, nextState || studyState);
            setStudyState(normalizedAfter);
            setCompletionPayload({
                ...payload,
                sessionOutcome,
                exitReason,
            });
            setResult(null);
            setActiveAssistOption(null);
            setRiverState('celebrate');
            setRiverCaption(getCompleteCaption(guideData, {
                ...payload,
                sessionOutcome,
                exitReason,
            }));
            setSessionStage('complete');
        } catch (error) {
            const isNetworkError = error instanceof TypeError && !error.status;
            const message = error?.body?.error
                || (isNetworkError
                    ? 'Unable to save your session — check your connection and try again.'
                    : error?.message)
                || 'Failed to complete tutor session';
            toastRef.current.error(message);
            finalizingRef.current = false;
        }
    }, [guide?.class_id, guideData, id, studyState]);

    const moveToNextCard = useCallback(async (baseState, { allowIncompleteFinish = true } = {}) => {
        if (!guideData || !currentCard) return;

        const nextCardId = getNextCardId(
            guideData,
            currentCard.id,
            null,
            baseState.card_states,
        );

        if (!nextCardId) {
            await finalizeSession({
                nextState: baseState,
                sessionOutcome: allowIncompleteFinish ? 'stopped_early' : 'complete',
                exitReason: allowIncompleteFinish ? 'skipped_remaining' : 'finished',
            });
            return;
        }

        const nextCard = guideData.cards.find((card) => card.id === nextCardId) || null;
        const nextState = normalizeGuideStudyState(guideData, {
            ...baseState,
            current_card_id: nextCardId,
            session_phase: nextCard?.phase || baseState.session_phase,
        });

        const persistedState = await persistStudyState(nextState);
        setAnswer('');
        setResult(null);
        setActiveAssistOption(null);
        setTeachSection(0);
        setExpandedSteps({});
        setExplainRevealed(1);
        setFuzzyPeek(false);
        setRiverState(nextCard?.presentation?.pose || 'teach');
        setRiverCaption(getTeachCaption(nextCard));
        setSessionStage('teach');
        return persistedState;
    }, [currentCard, finalizeSession, guideData, persistStudyState]);

    const handleStart = () => {
        setAnswer('');
        setResult(null);
        setActiveAssistOption(null);
        setTeachSection(0);
        setExpandedSteps({});
        setExplainRevealed(1);
        setFuzzyPeek(false);
        setSessionStage('teach');
        setRiverState(currentCard?.presentation?.pose || 'teach');
        setRiverCaption(getTeachCaption(currentCard));
    };

    const handleSelectAssist = (option) => {
        setActiveAssistOption(option);
        setRiverState(option.pose || 'point');
        setRiverCaption(option.text);
    };

    const handleAdvanceTeach = () => {
        // On the explain section, advance the progressive reveal first; only
        // move to the next teaching section once all paragraphs are revealed.
        if (onExplainSection && explainRevealed < explainTotal) {
            handleRevealNext();
            return;
        }
        const nextIndex = teachSection + 1;
        if (nextIndex >= teachSections.length) {
            handleBeginCheck();
            return;
        }
        setTeachSection(nextIndex);
        setFuzzyPeek(false);
        const section = teachSections[nextIndex];
        const captions = {
            intuition: 'Let me show you why this works...',
            worked_example: 'Watch how this plays out step by step.',
            common_mistakes: 'Before you try \u2014 watch out for these.',
            legacy_steps: 'Let me break this down.',
            legacy_why: currentCard?.teaching?.why_it_matters?.slice(0, 100) || 'Here is why this matters.',
        };
        const poses = {
            explain: 'teach',
            intuition: 'thinking',
            worked_example: 'point',
            common_mistakes: 'gentle-correct',
            legacy_steps: 'teach',
            legacy_why: 'thinking',
        };
        setRiverState(poses[section.type] || 'teach');
        setRiverCaption(captions[section.type] || 'River is teaching.');
        requestAnimationFrame(() => {
            sectionRefs.current[section.key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    const toggleStep = (exampleIndex, stepIndex) => {
        const key = `${exampleIndex}-${stepIndex}`;
        setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleRevealNext = useCallback(() => {
        setFuzzyPeek(false);
        setExplainRevealed((prev) => {
            const next = Math.min(prev + 1, explainTotal);
            const reachedEnd = next >= explainTotal;
            setRiverState(reachedEnd ? 'point' : 'thinking');
            setRiverCaption(reachedEnd
                ? 'That’s the whole thought. Ready for the why?'
                : 'Take a beat. Then keep going.');
            return next;
        });
    }, [explainTotal]);

    const handleFuzzy = useCallback(() => {
        setFuzzyPeek(true);
        setRiverState('thinking');
        setRiverCaption('No rush. Let me put it another way.');
    }, []);

    const handleGotIt = useCallback(() => {
        setRiverState('encourage');
        setRiverCaption('Good — keep that.');
        handleRevealNext();
    }, [handleRevealNext]);

    useEffect(() => {
        if (sessionStage !== 'teach' || !onExplainSection || explainFullyRevealed) return undefined;
        const onKey = (e) => {
            if (e.key !== ' ' && e.key !== 'ArrowDown') return;
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
            e.preventDefault();
            handleRevealNext();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [sessionStage, onExplainSection, explainFullyRevealed, handleRevealNext]);

    const handleBeginCheck = () => {
        setActiveAssistOption(null);
        setSessionStage('check');
        setRiverState('thinking');
        setRiverCaption(getCheckCaption(currentCard));
    };

    const handleSubmit = async () => {
        if (!guideData || !currentCard || submitting) return;

        setSubmitting(true);
        try {
            const evaluation = evaluateTutorCardResponse(guideData, currentCard, answer);
            const nowIso = new Date().toISOString();
            const cardState = buildDefaultCardState(currentCardState);
            const conceptState = studyState.concept_mastery?.[currentCard.concept_id] || {
                score: 0,
                status: 'unseen',
                attempts: 0,
                correct_attempts: 0,
                last_outcome: null,
            };

            const nextScore = clamp(
                conceptState.score + getScoreDelta(evaluation.outcome, currentCard.mastery_weight || 1),
                0,
                100,
            );
            const nextConceptState = {
                ...conceptState,
                score: nextScore,
                status: getConceptStatus(nextScore),
                attempts: (conceptState.attempts || 0) + 1,
                correct_attempts: (conceptState.correct_attempts || 0) + (evaluation.shouldAdvance ? 1 : 0),
                last_outcome: evaluation.outcome,
            };
            const nextCardState = {
                ...cardState,
                attempts: (cardState.attempts || 0) + 1,
                status: evaluation.outcome === 'correct'
                    ? 'mastered'
                    : evaluation.shouldAdvance
                        ? 'needs_review'
                        : evaluation.outcome === 'misconception'
                            ? 'retry'
                            : 'needs_review',
                last_outcome: evaluation.outcome,
                completed: Boolean(evaluation.shouldAdvance),
                skipped: false,
            };

            const provisionalCardStates = {
                ...studyState.card_states,
                [currentCard.id]: nextCardState,
            };
            const transitionCardId = evaluation.shouldAdvance
                ? getNextCardId(
                    guideData,
                    currentCard.id,
                    currentCard.transitions?.on_correct || null,
                    provisionalCardStates,
                )
                : null;
            const sessionComplete = evaluation.shouldAdvance && !transitionCardId;

            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                card_states: provisionalCardStates,
                concept_mastery: {
                    ...studyState.concept_mastery,
                    [currentCard.concept_id]: nextConceptState,
                },
                last_interaction_at: nowIso,
                last_reviewed_at: nowIso,
                completed_at: sessionComplete ? nowIso : studyState.completed_at,
            });

            const persistedState = await persistStudyState(nextState);
            const nextResult = {
                ...evaluation,
                feedback: evaluation.feedback,
                persistedState,
                sessionComplete,
                nextCardId: transitionCardId,
                modelAnswer: currentCard.target_answer,
            };
            setResult(nextResult);
            setSessionStage('feedback');
            setRiverState(getFeedbackState(evaluation.outcome));
            setRiverCaption(getFeedbackCaption(currentCard, nextResult));
        } catch {
            toastRef.current.error('Failed to update tutor session');
        } finally {
            setSubmitting(false);
        }
    };

    const handleShowAnswer = async () => {
        if (!guideData || !currentCard || submitting) return;

        try {
            const nowIso = new Date().toISOString();
            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                card_states: {
                    ...studyState.card_states,
                    [currentCard.id]: {
                        ...buildDefaultCardState(currentCardState),
                        status: 'needs_review',
                        last_outcome: 'revealed',
                        completed: false,
                        revealed_answer: true,
                        skipped: false,
                    },
                },
                last_interaction_at: nowIso,
                last_reviewed_at: nowIso,
            });

            const persistedState = await persistStudyState(nextState);
            const nextResult = {
                outcome: 'revealed',
                shouldAdvance: false,
                feedback: "Here's the answer — take a moment to study it, then decide whether to try again or move on.",
                persistedState,
                sessionComplete: false,
                nextCardId: null,
                modelAnswer: currentCard.target_answer,
            };
            setResult(nextResult);
            setSessionStage('feedback');
            setRiverState('point');
            setRiverCaption(getFeedbackCaption(currentCard, nextResult));
        } catch {
            toastRef.current.error('Failed to reveal the answer');
        }
    };

    const handleSkipForNow = async () => {
        if (!guideData || !currentCard || submitting) return;

        try {
            const nowIso = new Date().toISOString();
            const provisionalCardStates = {
                ...studyState.card_states,
                [currentCard.id]: {
                    ...buildDefaultCardState(currentCardState),
                    status: 'skipped',
                    last_outcome: 'skipped',
                    completed: false,
                    skipped: true,
                },
            };
            const nextCardId = getNextCardId(guideData, currentCard.id, null, provisionalCardStates);

            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                card_states: provisionalCardStates,
                current_card_id: nextCardId || studyState.current_card_id,
                session_phase: nextCardId
                    ? (guideData.cards.find((card) => card.id === nextCardId)?.phase || studyState.session_phase)
                    : studyState.session_phase,
                last_interaction_at: nowIso,
                last_reviewed_at: nowIso,
            });

            if (!nextCardId) {
                const persistedState = await persistStudyState(nextState);
                await finalizeSession({
                    nextState: persistedState,
                    sessionOutcome: 'stopped_early',
                    exitReason: 'skipped_remaining',
                });
                return;
            }

            await persistStudyState(nextState);
            setAnswer('');
            setResult(null);
            setActiveAssistOption(null);
            setRiverState('encourage');
            setRiverCaption('River has marked this for later so you can keep your momentum.');
            setSessionStage('teach');
        } catch {
            toastRef.current.error('Failed to skip this card');
        }
    };

    const handleTryAgain = () => {
        setResult(null);
        setActiveAssistOption(null);
        setRefinedAnswer('');
        setSessionStage('check');
        setRiverState('thinking');
        setRiverCaption(getCheckCaption(currentCard));
    };

    const handleRefinedSubmit = async () => {
        if (!guideData || !currentCard || submitting || !refinedAnswer.trim()) return;

        setSubmitting(true);
        try {
            const evaluation = evaluateTutorCardResponse(guideData, currentCard, refinedAnswer);
            const nowIso = new Date().toISOString();
            const cardState = buildDefaultCardState(currentCardState);
            const conceptState = studyState.concept_mastery?.[currentCard.concept_id] || {
                score: 0,
                status: 'unseen',
                attempts: 0,
                correct_attempts: 0,
                last_outcome: null,
            };

            const nextScore = clamp(
                conceptState.score + getScoreDelta(evaluation.outcome, currentCard.mastery_weight || 1),
                0,
                100,
            );
            const nextConceptState = {
                ...conceptState,
                score: nextScore,
                status: getConceptStatus(nextScore),
                attempts: (conceptState.attempts || 0) + 1,
                correct_attempts: (conceptState.correct_attempts || 0) + (evaluation.shouldAdvance ? 1 : 0),
                last_outcome: evaluation.outcome,
            };
            const nextCardState = {
                ...cardState,
                attempts: (cardState.attempts || 0) + 1,
                status: evaluation.outcome === 'correct'
                    ? 'mastered'
                    : evaluation.shouldAdvance
                        ? 'needs_review'
                        : evaluation.outcome === 'misconception'
                            ? 'retry'
                            : 'needs_review',
                last_outcome: evaluation.outcome,
                completed: Boolean(evaluation.shouldAdvance),
                skipped: false,
            };

            const provisionalCardStates = {
                ...studyState.card_states,
                [currentCard.id]: nextCardState,
            };
            const transitionCardId = evaluation.shouldAdvance
                ? getNextCardId(
                    guideData,
                    currentCard.id,
                    currentCard.transitions?.on_correct || null,
                    provisionalCardStates,
                )
                : null;
            const sessionComplete = evaluation.shouldAdvance && !transitionCardId;

            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                card_states: provisionalCardStates,
                concept_mastery: {
                    ...studyState.concept_mastery,
                    [currentCard.concept_id]: nextConceptState,
                },
                last_interaction_at: nowIso,
                last_reviewed_at: nowIso,
                completed_at: sessionComplete ? nowIso : studyState.completed_at,
            });

            const persistedState = await persistStudyState(nextState);
            const nextResult = {
                ...evaluation,
                feedback: evaluation.feedback,
                persistedState,
                sessionComplete,
                nextCardId: transitionCardId,
                modelAnswer: currentCard.target_answer,
            };
            setResult(nextResult);
            setAnswer(refinedAnswer);
            setRefinedAnswer('');
            setSessionStage('feedback');
            setRiverState(getFeedbackState(evaluation.outcome));
            setRiverCaption(getFeedbackCaption(currentCard, nextResult));
        } catch {
            toastRef.current.error('Failed to update tutor session');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAdvance = async () => {
        if (!guideData || !result) return;

        if (result.sessionComplete) {
            await finalizeSession({
                nextState: result.persistedState || studyState,
                sessionOutcome: 'complete',
                exitReason: 'finished',
            });
            return;
        }

        await moveToNextCard(result.persistedState || studyState, {
            allowIncompleteFinish: !result.shouldAdvance,
        });
    };

    const handleSaveAndLeave = async () => {
        await finalizeSession({
            nextState: studyState,
            sessionOutcome: 'stopped_early',
            exitReason: 'user_left',
        });
    };

    const handleResumeFromWrapUp = () => {
        finalizingRef.current = false;
        setCompletionPayload(null);
        setResult(null);
        setActiveAssistOption(null);
        setTeachSection(0);
        setExpandedSteps({});
        setSessionStage('teach');
        setRiverState(currentCard?.presentation?.pose || 'teach');
        setRiverCaption(getTeachCaption(currentCard));
    };

    // Hooks must be called before any conditional returns (Rules of Hooks)
    const currentCardIndex = useMemo(
        () => (guideData && currentCard
            ? guideData.cards.findIndex((c) => c.id === currentCard.id) + 1
            : 0),
        [guideData, currentCard],
    );
    const animatedXP = useCountUp(completionPayload?.xpEarned ?? 0, 700);
    const animatedMastery = useCountUp(completionPayload?.masteryDelta ?? 0, 600);

    if (loading) {
        return (
            <div className="min-h-screen bg-claude-bg text-claude-text flex items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-claude-secondary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading River Session...
                </div>
            </div>
        );
    }

    if (unsupported) {
        return (
            <div className="min-h-screen bg-claude-bg text-claude-text px-4 py-10">
                <button
                    type="button"
                    onClick={() => navigate('/guides')}
                    className="inline-flex items-center gap-2 text-sm text-claude-secondary hover:text-claude-text transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Tutor Sessions
                </button>

                <div data-testid="river-session-unsupported" className="mx-auto mt-12 max-w-2xl">
                    <div
                        className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                        style={{
                            padding: 'clamp(6px, 1vw, 12px)',
                            background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                            boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                        }}
                    >
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.1]"
                            style={{
                                backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                            }}
                        />
                        <div
                            className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-6 py-6 sm:px-8 sm:py-8"
                            style={{
                                background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                style={{
                                    backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                }}
                            />
                            <div
                                className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                style={{
                                    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                }}
                            />

                            <p className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.78)' }}>River Session</p>
                            <h1 className="mt-3 text-3xl font-serif italic font-bold" style={{ color: '#efe4d1' }}>This guide is no longer supported</h1>
                            <p className="mt-4 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                River Tutor Session v4 is a hard cutover. Older study-guide and exam-coach artifacts no longer run inside this route.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const title = guide?.title || 'Tutor Session';
    const completionIsPartial = completionPayload?.sessionOutcome === 'stopped_early';
    const assistOptions = currentCard?.assist_options || [];

    // Current River pose accent color — drives surface tinting on feedback stage
    const poseAccent = RIVER_POSE_ACCENT[riverState] ?? '#8fb27c';

    // Card position for pip track
    const totalCards = guideData?.cards?.length ?? 0;

    return (
        <div className="min-h-screen bg-claude-bg text-claude-text px-4 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-6xl">
                <button
                    type="button"
                    onClick={() => navigate('/guides')}
                    className="inline-flex items-center gap-2 text-sm text-claude-secondary hover:text-claude-text transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Tutor Sessions
                </button>

                {['teach', 'check', 'feedback'].includes(sessionStage) && totalCards > 1 ? (
                    <motion.div
                        key={`pip-${currentCard?.id}-${sessionStage}`}
                        className="mt-5 flex items-center gap-1.5"
                        aria-label={`Concept ${currentCardIndex} of ${totalCards}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, ease: PANEL_EASE }}
                    >
                        {guideData.cards.map((card) => {
                            const done = studyState.card_states?.[card.id]?.completed;
                            const active = card.id === currentCard?.id;
                            return (
                                <div
                                    key={card.id}
                                    className={`h-[5px] rounded-full transition-all duration-500 ${
                                        done
                                            ? 'w-5 bg-claude-accent'
                                            : active
                                                ? 'w-5 bg-claude-accent/55'
                                                : 'w-[5px] bg-claude-border'
                                    }`}
                                />
                            );
                        })}
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary">
                            {sessionStage === 'teach' && (
                                isToctStyleCard && teachSections.length > 1
                                    ? <span>Teach <span className="text-claude-accent">{teachSection + 1}/{teachSections.length}</span></span>
                                    : <span>Teach</span>
                            )}
                            {sessionStage === 'check' && (
                                <><span className="opacity-40">Teach &rarr;</span>{' '}<span className="text-claude-accent">Check</span></>
                            )}
                            {sessionStage === 'feedback' && (
                                <><span className="opacity-40">Check &rarr;</span>{' '}<span className="text-claude-accent">Feedback</span></>
                            )}
                        </span>
                    </motion.div>
                ) : null}

                {sessionStage === 'intro' ? (
                    <motion.section
                        data-testid="river-session-intro"
                        className="mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.42, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />
                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-6 py-6 sm:px-8 sm:py-8"
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                                    <div>
                                        <p className="text-[11px] font-mono uppercase tracking-[0.2em]" style={{ color: 'rgba(222,185,106,0.78)' }}>Today's lecture</p>
                                        <h1 className="mt-3 text-4xl sm:text-5xl font-serif italic font-bold tracking-tight" style={{ color: '#efe4d1' }}>{title}</h1>
                                        <p className="mt-4 max-w-2xl text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                            {guideData.lecture.opening}
                                        </p>
                                        <div className="mt-6 grid gap-3 md:grid-cols-3">
                                            <div className="rounded-[1.4rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Subject</p>
                                                <p className="mt-2 text-lg font-semibold" style={{ color: '#efe4d1' }}>{guideData.session_meta.subject}</p>
                                            </div>
                                            <div className="rounded-[1.4rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Goal</p>
                                                <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.88)' }}>{guideData.session_meta.student_goal}</p>
                                            </div>
                                            <div className="rounded-[1.4rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Style</p>
                                                <p className="mt-2 text-sm leading-6 capitalize" style={{ color: 'rgba(228,219,201,0.88)' }}>{guideData.session_meta.lecture_style}</p>
                                            </div>
                                        </div>
                                        {guideData.lecture.agenda.length > 0 ? (
                                            <div className="mt-6 rounded-[1.6rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Agenda</p>
                                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                    {guideData.lecture.agenda.map((item, index) => (
                                                        <div key={`${item}-${index}`} className="rounded-[1rem] border px-3 py-3 text-sm leading-6" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)', color: 'rgba(228,219,201,0.9)' }}>
                                                            <span className="mr-2" style={{ color: 'rgba(222,185,106,0.85)' }}>{index + 1}.</span>
                                                            {item}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="mt-6 flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={handleStart}
                                                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                            >
                                                Start with River
                                            </button>
                                        </div>
                                    </div>

                                    <RiverMascot state={riverState} caption={riverCaption} />
                                </div>
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {sessionStage === 'teach' && currentCard ? (
                    isToctStyleCard ? (
                    /* ── Blackboard Lecture (TOCT-style cards) ── */
                    <motion.section
                        data-testid="river-session-teach"
                        className="mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: PANEL_EASE }}
                    >
                        {/* Wooden frame */}
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1.2vw, 14px)',
                                background: 'linear-gradient(165deg, #5c3d2e 0%, #4a2f20 30%, #3d251a 70%, #2e1c13 100%)',
                                boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                            }}
                        >
                            {/* Wood grain texture */}
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.12]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(95deg, transparent, transparent 8px, rgba(255,220,180,0.15) 8px, rgba(255,220,180,0.15) 9px)',
                                }}
                            />

                            {/* Chalkboard surface */}
                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-5 py-6 sm:px-8 sm:py-8"
                                style={{
                                    background: 'linear-gradient(175deg, #2a4a3a 0%, #243f33 40%, #1e362c 70%, #1a3028 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.35), inset 0 0 60px rgba(0,0,0,0.15)',
                                }}
                            >
                                {/* Chalk dust particles overlay */}
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.04]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 70% 15%, rgba(255,255,255,0.6), transparent), radial-gradient(1.5px 1.5px at 45% 80%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 85% 60%, rgba(255,255,255,0.7), transparent)',
                                    }}
                                />

                                {/* Chalk tray line at bottom */}
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.06) 80%, transparent)',
                                    }}
                                />

                                {/* River + section progress header */}
                                <div className="flex items-start gap-4 sm:gap-6 mb-6 sm:mb-8">
                                    <div className="shrink-0 w-[100px] sm:w-[140px]">
                                        <RiverMascot state={riverState} caption={riverCaption} compact />
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <p
                                            className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.2em]"
                                            style={{ color: 'rgba(222,185,106,0.7)' }}
                                        >
                                            {guideData.session_meta.river_role} &middot; {teachSection + 1}/{teachSections.length}
                                        </p>
                                        <h2
                                            className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-serif italic font-bold leading-tight"
                                            style={{ color: '#e8dcc8' }}
                                        >
                                            <SubjectRenderer content={currentConcept?.title || currentCard.prompt} />
                                        </h2>
                                        {/* Chalk progress dots */}
                                        <div className="mt-3 flex items-center gap-1.5">
                                            {teachSections.map((section, i) => (
                                                <div
                                                    key={section.key}
                                                    className="transition-all duration-500"
                                                    style={{
                                                        width: i <= teachSection ? 20 : 6,
                                                        height: 4,
                                                        borderRadius: 2,
                                                        backgroundColor: i <= teachSection
                                                            ? 'rgba(222,185,106,0.65)'
                                                            : 'rgba(255,255,255,0.12)',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Lecture sections ── */}
                                <div className="space-y-6">
                                    {teachSections.map((section, sectionIndex) => {
                                        if (sectionIndex > teachSection) return null;

                                        return (
                                            <motion.div
                                                key={section.key}
                                                ref={(el) => { sectionRefs.current[section.key] = el; }}
                                                initial={{ opacity: 0, y: 12 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.5, ease: PANEL_EASE }}
                                            >
                                                {/* Section label */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span
                                                        className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em]"
                                                        style={{ color: 'rgba(222,185,106,0.55)' }}
                                                    >
                                                        {section.label}
                                                    </span>
                                                    <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
                                                </div>

                                                {/* ── Explain section (progressive reveal) ── */}
                                                {section.type === 'explain' && (
                                                    <div className="space-y-3">
                                                        {explainParagraphs.slice(0, explainRevealed).map((paragraph, pi) => {
                                                            const isCurrent = pi === explainRevealed - 1;
                                                            return (
                                                                <motion.p
                                                                    key={pi}
                                                                    className="text-[15px] sm:text-base leading-[1.8] max-w-[72ch] transition-[color,opacity] duration-500 ease-out"
                                                                    initial={{ opacity: 0, y: 8 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ duration: 0.45, ease: PANEL_EASE }}
                                                                    style={{
                                                                        color: isCurrent
                                                                            ? '#e8dcc8'
                                                                            : 'color-mix(in oklab, #d4ccb8 55%, transparent)',
                                                                    }}
                                                                >
                                                                    <SubjectRenderer content={paragraph} inline />
                                                                </motion.p>
                                                            );
                                                        })}

                                                        {/* Mid-reveal checkpoint */}
                                                        {showFuzzyPrompt && !fuzzyPeek && (
                                                            <motion.div
                                                                key="fuzzy-prompt"
                                                                initial={{ opacity: 0, y: 6 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.35, ease: PANEL_EASE, delay: 0.15 }}
                                                                className="mt-5 flex flex-wrap items-center gap-3 pt-4"
                                                                style={{ borderTop: '1px dashed rgba(222,185,106,0.18)' }}
                                                            >
                                                                <span
                                                                    className="text-[10px] font-mono uppercase tracking-[0.2em]"
                                                                    style={{ color: 'rgba(222,185,106,0.55)' }}
                                                                >
                                                                    Does this click?
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleGotIt}
                                                                    className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
                                                                    style={{
                                                                        backgroundColor: 'rgba(222,185,106,0.12)',
                                                                        color: '#deb96a',
                                                                        border: '1px solid rgba(222,185,106,0.22)',
                                                                    }}
                                                                >
                                                                    Got it
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleFuzzy}
                                                                    className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
                                                                    style={{
                                                                        backgroundColor: 'rgba(255,255,255,0.04)',
                                                                        color: 'rgba(212,204,184,0.7)',
                                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                                    }}
                                                                >
                                                                    Still fuzzy
                                                                </button>
                                                            </motion.div>
                                                        )}

                                                        {/* Fuzzy peek: show intuition inline as an alternate framing */}
                                                        {fuzzyPeek && currentCard?.teaching?.intuition && (
                                                            <motion.div
                                                                key="fuzzy-peek"
                                                                initial={{ opacity: 0, y: 6 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.4, ease: PANEL_EASE }}
                                                                className="mt-4 rounded-xl px-5 py-4"
                                                                style={{
                                                                    backgroundColor: 'rgba(222,185,106,0.06)',
                                                                    border: '1px solid rgba(222,185,106,0.14)',
                                                                }}
                                                            >
                                                                <p className="text-[10px] font-mono uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(222,185,106,0.6)' }}>
                                                                    Another way to see it
                                                                </p>
                                                                <p
                                                                    className="text-[15px] sm:text-base leading-[1.8] italic max-w-[68ch]"
                                                                    style={{ color: '#e8dcc8' }}
                                                                >
                                                                    <SubjectRenderer content={currentCard.teaching.intuition} inline />
                                                                </p>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ── Intuition section ── */}
                                                {section.type === 'intuition' && (
                                                    <div
                                                        className="rounded-xl px-5 py-4"
                                                        style={{
                                                            backgroundColor: 'rgba(222,185,106,0.06)',
                                                            border: '1px solid rgba(222,185,106,0.12)',
                                                        }}
                                                    >
                                                        <p
                                                            className="text-[15px] sm:text-base leading-[1.8] italic max-w-[68ch]"
                                                            style={{ color: '#d4ccb8' }}
                                                        >
                                                            <SubjectRenderer content={currentCard.teaching.intuition} inline />
                                                        </p>
                                                    </div>
                                                )}

                                                {/* ── Worked example section ── */}
                                                {section.type === 'worked_example' && section.data && (
                                                    <div
                                                        className="rounded-xl overflow-hidden"
                                                        style={{
                                                            backgroundColor: 'rgba(0,0,0,0.18)',
                                                            border: '1px solid rgba(255,255,255,0.06)',
                                                        }}
                                                    >
                                                        {/* Problem statement */}
                                                        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.55)' }}>
                                                                Problem
                                                            </p>
                                                            <p className="mt-2 text-[15px] sm:text-base leading-[1.7] font-medium" style={{ color: '#e8dcc8' }}>
                                                                <SubjectRenderer content={section.data.problem} inline />
                                                            </p>
                                                        </div>

                                                        {/* Steps */}
                                                        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                                                            {section.data.steps.map((exStep, si) => {
                                                                const stepKey = `${sectionIndex}-${si}`;
                                                                const isExpanded = expandedSteps[stepKey];
                                                                return (
                                                                    <div key={si}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleStep(sectionIndex, si)}
                                                                            className="w-full text-left px-5 py-3 flex items-start gap-3 transition-colors hover:bg-white/[0.02]"
                                                                        >
                                                                            <span
                                                                                className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-medium"
                                                                                style={{
                                                                                    backgroundColor: 'rgba(222,185,106,0.15)',
                                                                                    color: 'rgba(222,185,106,0.8)',
                                                                                }}
                                                                            >
                                                                                {si + 1}
                                                                            </span>
                                                                            <span className="flex-1 text-sm leading-6" style={{ color: '#d4ccb8' }}>
                                                                                <SubjectRenderer content={exStep.step} inline />
                                                                            </span>
                                                                            <ChevronLeft
                                                                                className="shrink-0 mt-0.5 w-4 h-4 transition-transform duration-200"
                                                                                style={{
                                                                                    color: 'rgba(255,255,255,0.25)',
                                                                                    transform: isExpanded ? 'rotate(-90deg)' : 'rotate(0)',
                                                                                }}
                                                                            />
                                                                        </button>
                                                                        {isExpanded && exStep.detail && (
                                                                            <motion.div
                                                                                initial={{ opacity: 0, height: 0 }}
                                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                                exit={{ opacity: 0, height: 0 }}
                                                                                transition={{ duration: 0.25, ease: PANEL_EASE }}
                                                                                className="px-5 pb-3 pl-13"
                                                                            >
                                                                                <p className="text-sm leading-6" style={{ color: 'rgba(212,204,184,0.7)', paddingLeft: 32 }}>
                                                                                    <SubjectRenderer content={exStep.detail} inline />
                                                                                </p>
                                                                            </motion.div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Result + Takeaway */}
                                                        {(section.data.result || section.data.takeaway) && (
                                                            <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(222,185,106,0.04)' }}>
                                                                {section.data.result && (
                                                                    <p className="text-sm leading-6 font-medium" style={{ color: '#e8dcc8' }}>
                                                                        <SubjectRenderer content={section.data.result} inline />
                                                                    </p>
                                                                )}
                                                                {section.data.takeaway && (
                                                                    <p className="mt-1 text-sm leading-6 italic" style={{ color: 'rgba(222,185,106,0.6)' }}>
                                                                        {section.data.takeaway}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ── Common mistakes section ── */}
                                                {section.type === 'common_mistakes' && (
                                                    <div className="space-y-2.5">
                                                        {currentCard.teaching.common_mistakes.map((mistake, mi) => (
                                                            <div
                                                                key={mi}
                                                                className="flex items-start gap-3 rounded-xl px-4 py-3"
                                                                style={{
                                                                    backgroundColor: 'rgba(213,150,120,0.08)',
                                                                    border: '1px solid rgba(213,150,120,0.15)',
                                                                }}
                                                            >
                                                                <span className="shrink-0 mt-0.5 text-sm" style={{ color: 'rgba(213,150,120,0.7)' }}>&times;</span>
                                                                <p className="text-sm leading-6" style={{ color: '#d4ccb8' }}>
                                                                    <SubjectRenderer content={mistake} inline />
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* ── Legacy: steps ── */}
                                                {section.type === 'legacy_steps' && (
                                                    <div className="space-y-2.5">
                                                        {currentCard.teaching.steps.map((step, si) => (
                                                            <div
                                                                key={si}
                                                                className="flex items-start gap-3 rounded-xl px-4 py-3"
                                                                style={{
                                                                    backgroundColor: 'rgba(0,0,0,0.15)',
                                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                                }}
                                                            >
                                                                <span className="shrink-0 mt-0.5 text-sm font-mono" style={{ color: 'rgba(222,185,106,0.6)' }}>{si + 1}.</span>
                                                                <p className="text-sm leading-6" style={{ color: '#d4ccb8' }}>
                                                                    <SubjectRenderer content={step} inline />
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* ── Legacy: why it matters ── */}
                                                {section.type === 'legacy_why' && (
                                                    <div>
                                                        <p className="text-sm leading-7" style={{ color: 'rgba(212,204,184,0.75)' }}>
                                                            <SubjectRenderer content={currentCard.teaching.why_it_matters} />
                                                        </p>
                                                        {currentCard.teaching.example && (
                                                            <div
                                                                className="mt-3 rounded-xl px-4 py-3"
                                                                style={{
                                                                    backgroundColor: 'rgba(0,0,0,0.15)',
                                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                                }}
                                                            >
                                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] mb-2" style={{ color: 'rgba(222,185,106,0.45)' }}>
                                                                    Example
                                                                </p>
                                                                <p className="text-sm leading-6" style={{ color: '#d4ccb8' }}>
                                                                    <SubjectRenderer content={currentCard.teaching.example} inline />
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* ── Bottom actions ── */}
                                <div className="mt-8 flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleAdvanceTeach}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200"
                                        style={{
                                            backgroundColor: teachSection < teachSections.length - 1
                                                ? 'rgba(222,185,106,0.15)'
                                                : 'rgba(222,185,106,0.9)',
                                            color: teachSection < teachSections.length - 1 ? '#deb96a' : '#1a3028',
                                            border: teachSection < teachSections.length - 1 ? '1px solid rgba(222,185,106,0.25)' : 'none',
                                        }}
                                    >
                                        {onExplainSection && explainRevealed < explainTotal
                                            ? `Go on \u2192  (${explainRevealed}/${explainTotal})`
                                            : (teachSection < teachSections.length - 1
                                                ? `Continue \u2192 ${teachSections[teachSection + 1]?.label}`
                                                : 'I\u2019m ready to answer')}
                                    </button>
                                    {teachSection < teachSections.length - 1 && (
                                        <button
                                            type="button"
                                            onClick={handleBeginCheck}
                                            className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-sm transition-colors"
                                            style={{ color: 'rgba(212,204,184,0.45)' }}
                                        >
                                            Skip to question
                                        </button>
                                    )}
                                    <span className="flex-1" aria-hidden="true" />
                                    <button
                                        type="button"
                                        onClick={handleSaveAndLeave}
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-xs transition-colors"
                                        style={{ color: 'rgba(212,204,184,0.35)' }}
                                    >
                                        Save and leave
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                    ) : (
                    /* ── Legacy teach layout (old v4 cards without TOCT fields) ── */
                    <motion.section
                        data-testid="river-session-teach"
                        className="mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.32, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />

                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-6 py-6 sm:px-8 sm:py-8"
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
                                    <RiverMascot state={riverState} caption={riverCaption} />

                                    <div className="space-y-4">
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, ease: PANEL_EASE }}
                                >
                                    <div className="rounded-[1.8rem] border p-5" style={{ borderColor: 'rgba(255,255,255,0.16)', background: 'linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))' }}>
                                        <p className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.8)' }}>
                                            {guideData.session_meta.river_role}
                                        </p>
                                        <h2 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold leading-tight" style={{ color: '#efe4d1' }}><SubjectRenderer content={currentConcept?.title || currentCard.prompt} /></h2>
                                        <div className="mt-4 text-base leading-7" style={{ color: 'rgba(228,219,201,0.9)' }}>
                                            <SubjectRenderer content={currentCard.teaching.explain} />
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: 0.08, ease: PANEL_EASE }}
                                >
                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                                        <div className="rounded-[1.6rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Breakdown</p>
                                            <div className="mt-3 space-y-2.5">
                                                {currentCard.teaching.steps.map((step, index) => (
                                                    <div key={`${step}-${index}`} className="rounded-[1rem] border px-3 py-3 text-sm leading-6" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)', color: 'rgba(228,219,201,0.9)' }}>
                                                        <span className="mr-2" style={{ color: 'rgba(222,185,106,0.85)' }}>{index + 1}.</span>
                                                        <SubjectRenderer content={step} inline />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-[1.6rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Why it matters</p>
                                            <div className="mt-3 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}><SubjectRenderer content={currentCard.teaching.why_it_matters} /></div>
                                            <div className="mt-4 rounded-[1rem] border px-3 py-3" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Anchor example</p>
                                                <div className="mt-2 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.9)' }}><SubjectRenderer content={currentCard.teaching.example} /></div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: 0.16, ease: PANEL_EASE }}
                                >
                                <div className="rounded-[1.6rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Ask River</p>
                                    <div className="mt-3 flex flex-wrap gap-2.5">
                                        {assistOptions.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => handleSelectAssist(option)}
                                                className="inline-flex min-h-[40px] items-center justify-center rounded-full border px-4 py-2 text-sm transition-colors hover:border-claude-accent/40 hover:bg-claude-accent/10"
                                                style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(228,219,201,0.9)' }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    {activeAssistOption ? (
                                        <div className="mt-4 rounded-[1.2rem] border border-claude-accent/20 bg-claude-accent/8 px-4 py-4 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.92)' }}>
                                            <SubjectRenderer content={activeAssistOption.text} />
                                        </div>
                                    ) : null}
                                </div>
                                </motion.div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={handleBeginCheck}
                                        className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                    >
                                        I'm ready to answer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAndLeave}
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors"
                                        style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(228,219,201,0.82)' }}
                                    >
                                        Save and leave
                                    </button>
                                </div>
                            </div>
                        </div>
                            </div>
                        </div>
                    </motion.section>
                    )
                ) : null}

                {sessionStage === 'check' && currentCard ? (
                    <motion.section
                        data-testid="river-session-check"
                        className="mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />

                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-5 py-6 sm:px-10 sm:py-10"
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
                                    <RiverMascot state={riverState} caption={riverCaption} />

                                    <div className="max-w-2xl">
                                        <p className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.78)' }}>
                                            Check understanding
                                        </p>
                                        <h2 className="mt-4 text-4xl sm:text-5xl font-serif italic font-bold leading-tight" style={{ color: '#efe4d1' }}>
                                            <SubjectRenderer content={currentCard.prompt} />
                                        </h2>
                                        {riverCaption ? (
                                            <p className="mt-3 max-w-prose text-sm italic leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                                {riverCaption}
                                            </p>
                                        ) : null}

                                        <label htmlFor="river-answer" className="mt-8 block text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.66)' }}>
                                            Your answer
                                        </label>
                                        <textarea
                                            id="river-answer"
                                            aria-label="Your answer"
                                            value={answer}
                                            onChange={(event) => setAnswer(event.target.value)}
                                            disabled={submitting}
                                            className="mt-3 min-h-[260px] w-full rounded-[1.4rem] border px-5 py-4 text-sm leading-7 outline-none transition-colors focus:border-claude-accent"
                                            style={{
                                                color: '#f1e8d8',
                                                backgroundColor: 'rgba(15, 35, 28, 0.34)',
                                                borderColor: answer.length > 0 ? 'rgba(255,255,255,0.2)' : `${poseAccent}45`,
                                                boxShadow: 'inset 0 1px 8px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.05)',
                                            }}
                                            placeholder="Answer from memory first."
                                        />

                                        <div className="mt-5 flex flex-wrap items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={handleSubmit}
                                                disabled={submitting}
                                                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
                                            >
                                                {submitting ? 'Checking...' : 'Submit Answer'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleShowAnswer}
                                                disabled={submitting}
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium text-claude-text transition-colors disabled:opacity-60"
                                                style={{
                                                    borderColor: 'rgba(255,255,255,0.22)',
                                                    backgroundColor: 'rgba(0,0,0,0.16)',
                                                }}
                                            >
                                                Show Answer
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSkipForNow}
                                                disabled={submitting}
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                                                style={{ color: 'rgba(228,219,201,0.78)' }}
                                            >
                                                Skip for now
                                            </button>
                                            <span className="flex-1" aria-hidden="true" />
                                            <button
                                                type="button"
                                                onClick={handleSaveAndLeave}
                                                disabled={submitting}
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-xs transition-colors disabled:opacity-60"
                                                style={{ color: 'rgba(228,219,201,0.62)' }}
                                            >
                                                Save and leave
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {sessionStage === 'feedback' && currentCard && result ? (
                    <motion.section
                        data-testid="river-session-feedback"
                        className="mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />

                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-6 py-6 sm:px-8 sm:py-8"
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
                                    <RiverMascot state={riverState} caption={riverCaption} />

                                    <div className="space-y-4">
                                        <div
                                            className="rounded-[1.6rem] border p-5 transition-colors duration-500"
                                            style={{
                                                borderColor: `${poseAccent}48`,
                                                backgroundColor: 'rgba(0,0,0,0.16)',
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>River's feedback</p>
                                                {result.outcome && result.outcome !== 'revealed' ? (
                                                    <span
                                                        className="rounded-full px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em]"
                                                        style={{
                                                            color: '#efe4d1',
                                                            backgroundColor: `${poseAccent}26`,
                                                            border: `1px solid ${poseAccent}4a`,
                                                        }}
                                                    >
                                                        {result.outcome}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-3 text-base leading-7" style={{ color: 'rgba(228,219,201,0.9)' }}>{result.feedback}</p>
                                        </div>

                                        {(result.shouldAdvance || result.outcome === 'revealed') && (
                                            <div className="rounded-[1.6rem] border p-5" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Model answer</p>
                                                <p className="mt-3 text-base leading-7" style={{ color: 'rgba(228,219,201,0.9)' }}>{result.modelAnswer}</p>
                                            </div>
                                        )}

                                        {result.missingTags?.length ? (
                                            <div
                                                className="rounded-[1.4rem] border p-4"
                                                style={{
                                                    borderColor: 'rgba(255,255,255,0.16)',
                                                    backgroundColor: 'rgba(0,0,0,0.16)',
                                                }}
                                            >
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>
                                                    Concepts to revisit
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {result.missingTags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full px-3 py-1.5 text-xs"
                                                            style={{
                                                                border: `1px solid ${poseAccent}40`,
                                                                backgroundColor: `${poseAccent}20`,
                                                                color: '#efe4d1',
                                                            }}
                                                        >
                                                            {tag.replace(/-/g, ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}

                                        {result.followUpQuestion && !result.shouldAdvance ? (
                                            <motion.div
                                                className="rounded-[1.6rem] border p-5"
                                                style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.35, delay: 0.12, ease: PANEL_EASE }}
                                            >
                                                <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.72)' }}>River's hint</p>
                                                <p className="mt-3 text-base leading-7 italic" style={{ color: 'rgba(228,219,201,0.9)' }}>
                                                    {result.followUpQuestion}
                                                </p>
                                                <label
                                                    htmlFor="river-refined-answer"
                                                    className="mt-4 block text-[10px] font-mono uppercase tracking-[0.16em]"
                                                    style={{ color: 'rgba(222,185,106,0.62)' }}
                                                >
                                                    Refine your answer
                                                </label>
                                                <textarea
                                                    id="river-refined-answer"
                                                    aria-label="Refine your answer"
                                                    value={refinedAnswer}
                                                    onChange={(event) => setRefinedAnswer(event.target.value)}
                                                    disabled={submitting}
                                                    className="mt-2 min-h-[120px] w-full rounded-[1.2rem] border px-4 py-3 text-sm leading-7 outline-none transition-colors focus:border-claude-accent"
                                                    style={{
                                                        color: '#f1e8d8',
                                                        backgroundColor: 'rgba(15, 35, 28, 0.28)',
                                                        borderColor: `${poseAccent}42`,
                                                        boxShadow: 'inset 0 1px 6px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.04)',
                                                    }}
                                                    placeholder="Try again with River's hint in mind..."
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleRefinedSubmit}
                                                    disabled={submitting || !refinedAnswer.trim()}
                                                    className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                                                >
                                                    {submitting ? 'Checking...' : 'Submit refined answer'}
                                                </button>
                                            </motion.div>
                                        ) : null}

                                        <div className="flex flex-wrap gap-3">
                                            {result.shouldAdvance ? (
                                                <button
                                                    type="button"
                                                    onClick={handleAdvance}
                                                    className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                >
                                                    Keep going
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={handleTryAgain}
                                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors"
                                                        style={{ borderColor: 'rgba(255,255,255,0.22)', color: 'rgba(228,219,201,0.9)', backgroundColor: 'rgba(0,0,0,0.16)' }}
                                                    >
                                                        Try again
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleAdvance}
                                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                    >
                                                        Continue anyway
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {sessionStage === 'complete' ? (
                    <motion.section
                        data-testid="river-session-complete"
                        className="mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.34, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />

                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-6 py-6 sm:px-8 sm:py-8"
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                                    <div>
                                        <p className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.78)' }}>
                                            {completionIsPartial ? 'Session saved' : 'Session complete'}
                                        </p>
                                        <h1 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold" style={{ color: '#efe4d1' }}>
                                            {completionIsPartial ? 'Session saved' : (guideData.completion?.title || 'Session complete')}
                                        </h1>
                                        <p className="mt-4 max-w-2xl text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                            {completionIsPartial
                                                ? 'River has preserved this lecture exactly where you left it.'
                                                : (guideData.completion?.mastery_message || 'You converted recall into structure.')}
                                        </p>
                                        <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                            {getCompleteCaption(guideData, completionPayload)}
                                        </p>
                                        {completionPayload ? (
                                            <div className="mt-8 rounded-[1.4rem] border p-5" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>XP earned</p>
                                                <p className="mt-1 font-serif italic text-7xl font-bold tabular-nums leading-none" style={{ color: '#efe4d1' }}>
                                                    {animatedXP}
                                                </p>
                                                <div className="mt-6 flex flex-wrap gap-8">
                                                    <div>
                                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Mastery</p>
                                                        <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: '#efe4d1' }}>{animatedMastery}%</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Next review</p>
                                                        <p className="mt-1 text-base font-medium" style={{ color: 'rgba(228,219,201,0.92)' }}>
                                                            {completionPayload.nextReviewAt
                                                                ? new Date(completionPayload.nextReviewAt).toLocaleDateString()
                                                                : 'When you are ready'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="mt-6 flex flex-wrap gap-3">
                                            {completionIsPartial ? (
                                                <button
                                                    type="button"
                                                    onClick={handleResumeFromWrapUp}
                                                    className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                >
                                                    Resume session
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => navigate('/guides')}
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors"
                                                style={{ borderColor: 'rgba(255,255,255,0.22)', color: 'rgba(228,219,201,0.9)' }}
                                            >
                                                Back to Tutor Sessions
                                            </button>
                                        </div>
                                    </div>

                                    <RiverMascot state={riverState} caption={riverCaption} />
                                </div>
                            </div>
                        </div>
                    </motion.section>
                ) : null}
            </div>
        </div>
    );
}
