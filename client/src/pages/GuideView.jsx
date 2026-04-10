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

    const sessionStartStateRef = useRef(null);
    const finalizingRef = useRef(false);

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
        } catch {
            toastRef.current.error('Failed to complete tutor session');
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
        setRiverState(nextCard?.presentation?.pose || 'teach');
        setRiverCaption(getTeachCaption(nextCard));
        setSessionStage('teach');
        return persistedState;
    }, [currentCard, finalizeSession, guideData, persistStudyState]);

    const handleStart = () => {
        setAnswer('');
        setResult(null);
        setActiveAssistOption(null);
        setSessionStage('teach');
        setRiverState(currentCard?.presentation?.pose || 'teach');
        setRiverCaption(getTeachCaption(currentCard));
    };

    const handleSelectAssist = (option) => {
        setActiveAssistOption(option);
        setRiverState(option.pose || 'point');
        setRiverCaption(option.text);
    };

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
                feedback: currentCard.target_answer,
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

                <div
                    data-testid="river-session-unsupported"
                    className="mx-auto mt-12 max-w-2xl rounded-[1.75rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                >
                    <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">River Session</p>
                    <h1 className="mt-3 text-3xl font-serif italic font-bold">This guide is no longer supported</h1>
                    <p className="mt-4 text-sm leading-6 text-claude-secondary">
                        River Tutor Session v4 is a hard cutover. Older study-guide and exam-coach artifacts no longer run inside this route.
                    </p>
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
                            {sessionStage === 'teach' && <span>Teach</span>}
                            {sessionStage === 'check' && (
                                <><span className="opacity-40">Teach →</span>{' '}<span className="text-claude-accent">Check</span></>
                            )}
                            {sessionStage === 'feedback' && (
                                <><span className="opacity-40">Check →</span>{' '}<span className="text-claude-accent">Feedback</span></>
                            )}
                        </span>
                    </motion.div>
                ) : null}

                {sessionStage === 'intro' ? (
                    <motion.section
                        data-testid="river-session-intro"
                        className="mt-8 overflow-hidden rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.42, ease: PANEL_EASE }}
                    >
                        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                            <div>
                                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-claude-accent">Today's lecture</p>
                                <h1 className="mt-3 text-4xl sm:text-5xl font-serif italic font-bold tracking-tight">{title}</h1>
                                <p className="mt-4 max-w-2xl text-sm leading-6 text-claude-secondary">
                                    {guideData.lecture.opening}
                                </p>
                                <div className="mt-6 grid gap-3 md:grid-cols-3">
                                    <div className="rounded-[1.4rem] border border-white/8 bg-black/20 p-4">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Subject</p>
                                        <p className="mt-2 text-lg font-semibold">{guideData.session_meta.subject}</p>
                                    </div>
                                    <div className="rounded-[1.4rem] border border-white/8 bg-black/20 p-4">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Goal</p>
                                        <p className="mt-2 text-sm leading-6">{guideData.session_meta.student_goal}</p>
                                    </div>
                                    <div className="rounded-[1.4rem] border border-white/8 bg-black/20 p-4">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Style</p>
                                        <p className="mt-2 text-sm leading-6 capitalize">{guideData.session_meta.lecture_style}</p>
                                    </div>
                                </div>
                                {guideData.lecture.agenda.length > 0 ? (
                                    <div className="mt-6 rounded-[1.6rem] border border-white/8 bg-[rgba(255,255,255,0.02)] p-4">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Agenda</p>
                                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                                            {guideData.lecture.agenda.map((item, index) => (
                                                <div key={`${item}-${index}`} className="rounded-[1rem] border border-white/6 bg-black/10 px-3 py-3 text-sm leading-6 text-claude-text">
                                                    <span className="mr-2 text-claude-accent">{index + 1}.</span>
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
                    </motion.section>
                ) : null}

                {sessionStage === 'teach' && currentCard ? (
                    <motion.section
                        data-testid="river-session-teach"
                        className="mt-8 overflow-hidden rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.32, ease: PANEL_EASE }}
                    >
                        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
                            <RiverMascot state={riverState} caption={riverCaption} />

                            <div className="space-y-4">
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: 0, ease: PANEL_EASE }}
                                >
                                    <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-5">
                                        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                                            {guideData.session_meta.river_role}
                                        </p>
                                        <h2 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold leading-tight"><SubjectRenderer content={currentConcept?.title || currentCard.prompt} /></h2>
                                        <div className="mt-4 text-base leading-7 text-claude-text">
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
                                        <div className="rounded-[1.6rem] border border-white/8 bg-black/20 p-4">
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Breakdown</p>
                                            <div className="mt-3 space-y-2.5">
                                                {currentCard.teaching.steps.map((step, index) => (
                                                    <div key={`${step}-${index}`} className="rounded-[1rem] border border-white/6 bg-black/10 px-3 py-3 text-sm leading-6 text-claude-text">
                                                        <span className="mr-2 text-claude-accent">{index + 1}.</span>
                                                        <SubjectRenderer content={step} inline />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-[1.6rem] border border-white/8 bg-black/20 p-4">
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Why it matters</p>
                                            <div className="mt-3 text-sm leading-6 text-claude-secondary"><SubjectRenderer content={currentCard.teaching.why_it_matters} /></div>
                                            <div className="mt-4 rounded-[1rem] border border-white/6 bg-black/10 px-3 py-3">
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Anchor example</p>
                                                <div className="mt-2 text-sm leading-6 text-claude-text"><SubjectRenderer content={currentCard.teaching.example} /></div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: 0.16, ease: PANEL_EASE }}
                                >
                                <div className="rounded-[1.6rem] border border-white/8 bg-black/20 p-4">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Ask River</p>
                                    <div className="mt-3 flex flex-wrap gap-2.5">
                                        {assistOptions.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => handleSelectAssist(option)}
                                                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-claude-text transition-colors hover:border-claude-accent/40 hover:bg-claude-accent/10"
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    {activeAssistOption ? (
                                        <div className="mt-4 rounded-[1.2rem] border border-claude-accent/20 bg-claude-accent/8 px-4 py-4 text-sm leading-6 text-claude-text">
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
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-claude-border px-4 py-2 text-sm font-medium text-claude-secondary transition-colors hover:text-claude-text"
                                    >
                                        Save and leave
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {sessionStage === 'check' && currentCard ? (
                    <motion.section
                        data-testid="river-session-check"
                        className="mt-8 overflow-hidden rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-10"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: PANEL_EASE }}
                    >
                        <div className="mx-auto max-w-2xl">
                            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                                Check understanding
                            </p>
                            <h2 className="mt-4 text-4xl sm:text-5xl font-serif italic font-bold leading-tight">
                                <SubjectRenderer content={currentCard.prompt} />
                            </h2>
                            {riverCaption ? (
                                <p className="mt-3 max-w-prose text-sm italic leading-6 text-claude-secondary">
                                    {riverCaption}
                                </p>
                            ) : null}

                            <label htmlFor="river-answer" className="mt-8 block text-[11px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                Your answer
                            </label>
                            <textarea
                                id="river-answer"
                                aria-label="Your answer"
                                value={answer}
                                onChange={(event) => setAnswer(event.target.value)}
                                disabled={submitting}
                                className="mt-3 min-h-[260px] w-full rounded-[1.6rem] border bg-claude-bg/70 px-5 py-4 text-sm leading-7 outline-none transition-colors focus:border-claude-accent"
                                style={{ borderColor: answer.length > 0 ? undefined : `${poseAccent}35` }}
                                placeholder="Answer from memory first."
                            />

                            <div className="mt-5 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
                                >
                                    {submitting ? 'Checking…' : 'Submit Answer'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleShowAnswer}
                                    disabled={submitting}
                                    className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-claude-border px-4 py-2 text-sm font-medium text-claude-text transition-colors hover:border-claude-accent/35 hover:bg-claude-bg/60 disabled:opacity-60"
                                >
                                    Show Answer
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkipForNow}
                                    disabled={submitting}
                                    className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium text-claude-secondary transition-colors hover:text-claude-text disabled:opacity-60"
                                >
                                    Skip for now
                                </button>
                                <span className="flex-1" aria-hidden="true" />
                                <button
                                    type="button"
                                    onClick={handleSaveAndLeave}
                                    disabled={submitting}
                                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-xs text-claude-secondary transition-colors hover:text-claude-text disabled:opacity-60"
                                >
                                    Save and leave
                                </button>
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {sessionStage === 'feedback' && currentCard && result ? (
                    <motion.section
                        data-testid="river-session-feedback"
                        className="mt-8 overflow-hidden rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: PANEL_EASE }}
                    >
                        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
                            <RiverMascot state={riverState} caption={riverCaption} />

                            <div className="space-y-4">
                                <div
                                    className="rounded-[1.6rem] border p-5 transition-colors duration-500"
                                    style={{
                                        borderColor: `${poseAccent}38`,
                                        backgroundColor: `${poseAccent}0e`,
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">River's feedback</p>
                                        {result.outcome && result.outcome !== 'revealed' ? (
                                            <span
                                                className="rounded-full px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em]"
                                                style={{
                                                    color: poseAccent,
                                                    backgroundColor: `${poseAccent}1a`,
                                                    border: `1px solid ${poseAccent}33`,
                                                }}
                                            >
                                                {result.outcome}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="mt-3 text-base leading-7 text-claude-text">{result.feedback}</p>
                                </div>

                                <div className="rounded-[1.6rem] border border-claude-accent/18 bg-claude-accent/8 p-5">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Model answer</p>
                                    <p className="mt-3 text-base leading-7 text-claude-text">{result.modelAnswer}</p>
                                </div>

                                {result.missingTags?.length ? (
                                    <div
                                        className="rounded-[1.4rem] border p-4"
                                        style={{
                                            borderColor: `${poseAccent}25`,
                                            backgroundColor: `${poseAccent}08`,
                                        }}
                                    >
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                            Concepts to revisit
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {result.missingTags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="rounded-full px-3 py-1.5 text-xs text-claude-text"
                                                    style={{
                                                        border: `1px solid ${poseAccent}2e`,
                                                        backgroundColor: `${poseAccent}12`,
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
                                        className="rounded-[1.6rem] border border-claude-accent/25 bg-claude-accent/6 p-5"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.35, delay: 0.12, ease: PANEL_EASE }}
                                    >
                                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">River's follow-up</p>
                                        <p className="mt-3 text-base leading-7 text-claude-text italic">
                                            {result.followUpQuestion}
                                        </p>
                                        <label
                                            htmlFor="river-refined-answer"
                                            className="mt-4 block text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary"
                                        >
                                            Refine your answer
                                        </label>
                                        <textarea
                                            id="river-refined-answer"
                                            aria-label="Refine your answer"
                                            value={refinedAnswer}
                                            onChange={(event) => setRefinedAnswer(event.target.value)}
                                            disabled={submitting}
                                            className="mt-2 min-h-[120px] w-full rounded-[1.2rem] border bg-claude-bg/70 px-4 py-3 text-sm leading-7 outline-none transition-colors focus:border-claude-accent"
                                            style={{ borderColor: `${poseAccent}30` }}
                                            placeholder="Try again with River's hint in mind…"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRefinedSubmit}
                                            disabled={submitting || !refinedAnswer.trim()}
                                            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                                        >
                                            {submitting ? 'Checking…' : 'Submit refined answer'}
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
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-claude-accent/30 bg-claude-accent/8 px-4 py-2 text-sm font-medium text-claude-text transition-colors hover:bg-claude-accent/14"
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
                    </motion.section>
                ) : null}

                {sessionStage === 'complete' ? (
                    <motion.section
                        data-testid="river-session-complete"
                        className="mt-8 overflow-hidden rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.34, ease: PANEL_EASE }}
                    >
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                            <div>
                                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                                    {completionIsPartial ? 'Session saved' : 'Session complete'}
                                </p>
                                <h1 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold">
                                    {completionIsPartial ? 'Session saved' : (guideData.completion?.title || 'Session complete')}
                                </h1>
                                <p className="mt-4 max-w-2xl text-sm leading-6 text-claude-secondary">
                                    {completionIsPartial
                                        ? 'River has preserved this lecture exactly where you left it.'
                                        : (guideData.completion?.mastery_message || 'You converted recall into structure.')}
                                </p>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-claude-secondary">
                                    {getCompleteCaption(guideData, completionPayload)}
                                </p>
                                {completionPayload ? (
                                    <div className="mt-8">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">XP earned</p>
                                        <p className="mt-1 font-serif italic text-7xl font-bold tabular-nums leading-none text-claude-text">
                                            {animatedXP}
                                        </p>
                                        <div className="mt-6 flex flex-wrap gap-8">
                                            <div>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Mastery</p>
                                                <p className="mt-1 text-2xl font-semibold tabular-nums">{animatedMastery}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Next review</p>
                                                <p className="mt-1 text-base font-medium">
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
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-claude-border px-4 py-2 text-sm font-medium text-claude-text transition-colors hover:border-claude-accent/35"
                                    >
                                        Back to Tutor Sessions
                                    </button>
                                </div>
                            </div>

                            <RiverMascot state={riverState} caption={riverCaption} />
                        </div>
                    </motion.section>
                ) : null}
            </div>
        </div>
    );
}
