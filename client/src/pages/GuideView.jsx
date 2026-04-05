import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import RiverMascot from '../components/study/RiverMascot.jsx';
import {
    ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION,
    evaluateTutorCardResponse,
    normalizeGuideData,
    normalizeGuideStudyState,
} from '../utils/studyGuides.js';

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
    if (outcome === 'partial') return 14 * weight;
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

const getFallbackCaption = (kind) => {
    if (kind === 'intro') return 'We can take this one card at a time. You stay in control of the pace.';
    if (kind === 'focus') return 'Answer from memory first. If you want help, I can step in without taking over.';
    if (kind === 'encourage') return 'You have part of it. Want to tighten it or keep moving for now?';
    if (kind === 'recover') return 'No trap here. We can retry, reveal the answer, or leave it for later.';
    if (kind === 'misconception') return 'That is a common mix-up. We can correct it gently and keep going.';
    if (kind === 'hint') return 'Want the answer, a hint, or a clean reset? Your call.';
    if (kind === 'mastery') return 'That answer is solid. Keep the same standard on the next one.';
    if (kind === 'celebrate') return 'You made real progress. We can stop here or come back stronger later.';
    return 'We can take this one step at a time.';
};

const getRiverReaction = (outcome) => {
    if (outcome === 'correct') return 'mastery';
    if (outcome === 'partial') return 'encourage';
    if (outcome === 'misconception') return 'misconception';
    if (outcome === 'incorrect') return 'recover';
    if (outcome === 'empty') return 'hint';
    if (outcome === 'revealed') return 'hint';
    if (outcome === 'skipped') return 'encourage';
    return 'focus';
};

const getIntroCaption = (guideData) => (
    guideData?.river?.dialogue_variants?.opening?.[0]
    || getFallbackCaption('intro')
);

const getFocusCaption = (currentCard) => (
    currentCard?.river?.intro
    || getFallbackCaption('focus')
);

const getResultCaption = ({ outcome, currentCard, feedback }) => {
    if (outcome === 'correct') {
        return currentCard?.river?.success
            || feedback
            || getFallbackCaption('mastery');
    }

    if (outcome === 'partial') {
        return feedback || getFallbackCaption('encourage');
    }

    if (outcome === 'revealed') {
        return 'The clean answer is here when you want it. You can retry or move on without pressure.';
    }

    if (outcome === 'skipped') {
        return 'We can leave that one marked for later and keep the momentum up.';
    }

    return currentCard?.river?.struggle
        || feedback
        || getFallbackCaption(outcome === 'misconception' ? 'misconception' : 'recover');
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
    const [sessionScreen, setSessionScreen] = useState('intro');
    const [answer, setAnswer] = useState('');
    const [result, setResult] = useState(null);
    const [assistResponse, setAssistResponse] = useState(null);
    const [completionPayload, setCompletionPayload] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [assisting, setAssisting] = useState(false);
    const [riverState, setRiverState] = useState('idle');
    const [riverCaption, setRiverCaption] = useState(getFallbackCaption('intro'));

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
            setSessionScreen(normalizedStudyState.completed_at ? 'complete' : 'intro');
            setAnswer('');
            setResult(null);
            setAssistResponse(null);
            setCompletionPayload(null);
            setRiverState(normalizedStudyState.completed_at ? 'celebrate' : 'idle');
            setRiverCaption(normalizedGuideData ? getIntroCaption(normalizedGuideData) : getFallbackCaption('intro'));
            sessionStartStateRef.current = normalizedStudyState;
            finalizingRef.current = false;
        } catch (error) {
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

    useEffect(() => {
        if (!guideData) return;

        if (sessionScreen === 'intro') {
            setRiverState('idle');
            setRiverCaption(getIntroCaption(guideData));
            return;
        }

        if (sessionScreen === 'complete') {
            setRiverState('celebrate');
            if (completionPayload?.sessionOutcome === 'stopped_early') {
                setRiverCaption('Session saved. You can come back exactly where you left off.');
            } else {
                setRiverCaption(guideData?.completion?.confidence_close || getFallbackCaption('celebrate'));
            }
            return;
        }

        if (sessionScreen === 'card' && currentCard && !result && !assistResponse) {
            setRiverState('focus');
            setRiverCaption(getFocusCaption(currentCard));
        }
    }, [assistResponse, completionPayload, currentCard, guideData, result, sessionScreen]);

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
            setAssistResponse(null);
            setResult(null);
            setRiverState('celebrate');
            setRiverCaption(
                sessionOutcome === 'stopped_early'
                    ? 'Session saved. You can come back exactly where you left off.'
                    : (guideData?.completion?.confidence_close || getFallbackCaption('celebrate')),
            );
            setSessionScreen('complete');
        } catch (error) {
            toastRef.current.error('Failed to complete tutor session');
            finalizingRef.current = false;
        }
    }, [guide?.class_id, guideData, id, studyState]);

    const moveToNextCard = useCallback(async (baseState) => {
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
                sessionOutcome: 'stopped_early',
                exitReason: 'skipped_remaining',
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
        setAssistResponse(null);
        setRiverState('focus');
        setRiverCaption(getFocusCaption(nextCard));
        return persistedState;
    }, [currentCard, finalizeSession, guideData, persistStudyState]);

    const handleStart = () => {
        setSessionScreen('card');
        setResult(null);
        setAssistResponse(null);
        setAnswer('');
        setRiverState('focus');
        setRiverCaption(getFocusCaption(currentCard));
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
                correct_attempts: (conceptState.correct_attempts || 0) + (evaluation.outcome === 'correct' ? 1 : 0),
                last_outcome: evaluation.outcome,
            };
            const nextCardState = {
                ...cardState,
                attempts: (cardState.attempts || 0) + 1,
                status: evaluation.outcome === 'correct'
                    ? 'mastered'
                    : evaluation.outcome === 'partial'
                        ? 'needs_review'
                        : 'retry',
                last_outcome: evaluation.outcome,
                completed: evaluation.outcome === 'correct',
                skipped: false,
            };

            const provisionalCardStates = {
                ...studyState.card_states,
                [currentCard.id]: nextCardState,
            };
            const transitionCardId = evaluation.outcome === 'correct'
                ? getNextCardId(
                    guideData,
                    currentCard.id,
                    currentCard.transitions?.on_correct || null,
                    provisionalCardStates,
                )
                : null;
            const sessionComplete = evaluation.outcome === 'correct' && !transitionCardId;

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
            setAssistResponse(null);
            setResult({
                type: 'evaluation',
                ...evaluation,
                hintText: evaluation.outcome === 'correct'
                    ? null
                    : currentCard.hints?.[(nextCardState.hints_used || 0)]?.text || currentCard.hints?.[0]?.text || null,
                persistedState,
                sessionComplete,
                nextCardId: transitionCardId,
            });
            setRiverState(getRiverReaction(evaluation.outcome));
            setRiverCaption(getResultCaption({
                outcome: evaluation.outcome,
                currentCard,
                feedback: evaluation.feedback,
            }));
        } catch (error) {
            toastRef.current.error('Failed to update tutor session');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAskRiver = async () => {
        if (!guideData || !currentCard || assisting || submitting) return;

        setAssisting(true);
        try {
            const nowIso = new Date().toISOString();
            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                card_states: {
                    ...studyState.card_states,
                    [currentCard.id]: {
                        ...buildDefaultCardState(currentCardState),
                        assist_count: (currentCardState?.assist_count || 0) + 1,
                        last_assist_at: nowIso,
                    },
                },
                last_interaction_at: nowIso,
            });

            const persistedState = await persistStudyState(nextState);
            const response = await api.assistStudyCoach({
                guideId: id,
                guideData,
                cardId: currentCard.id,
                sectionId: currentConcept?.id || currentCard.concept_id,
                question: answer.trim() || currentCard.prompt,
            });

            setAssistResponse({
                ...response,
                persistedState,
            });
            setRiverState('hint');
            setRiverCaption(response?.answer || getFallbackCaption('hint'));
        } catch (error) {
            toastRef.current.error('River could not help just now');
        } finally {
            setAssisting(false);
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
            setAssistResponse(null);
            setResult({
                type: 'reveal',
                outcome: 'revealed',
                feedback: currentCard.target_answer,
                persistedState,
                sessionComplete: false,
                nextCardId: null,
            });
            setRiverState('hint');
            setRiverCaption(getResultCaption({
                outcome: 'revealed',
                currentCard,
            }));
        } catch (error) {
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
            setAssistResponse(null);
            setRiverState('encourage');
            setRiverCaption(getResultCaption({
                outcome: 'skipped',
                currentCard,
            }));
        } catch (error) {
            toastRef.current.error('Failed to skip this card');
        }
    };

    const handleTryAgain = () => {
        setResult(null);
        setAssistResponse(null);
        setRiverState('focus');
        setRiverCaption(getFocusCaption(currentCard));
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

        if (result.nextCardId) {
            const nextCard = guideData.cards.find((card) => card.id === result.nextCardId) || null;
            const nextState = normalizeGuideStudyState(guideData, {
                ...(result.persistedState || studyState),
                current_card_id: result.nextCardId,
                session_phase: nextCard?.phase || studyState.session_phase,
            });
            await persistStudyState(nextState);
            setAnswer('');
            setResult(null);
            setAssistResponse(null);
            setRiverState('focus');
            setRiverCaption(getFocusCaption(nextCard));
            return;
        }

        await moveToNextCard(result.persistedState || studyState);
    };

    const handleContinueAnyway = async () => {
        await moveToNextCard((result?.persistedState || assistResponse?.persistedState || studyState));
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
        setAssistResponse(null);
        setSessionScreen('card');
        setRiverState('focus');
        setRiverCaption(getFocusCaption(currentCard));
    };

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
    const actionPanelVisible = Boolean(result || assistResponse);
    const completionIsPartial = completionPayload?.sessionOutcome === 'stopped_early';

    return (
        <div className="min-h-screen bg-claude-bg text-claude-text px-4 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-5xl">
                <button
                    type="button"
                    onClick={() => navigate('/guides')}
                    className="inline-flex items-center gap-2 text-sm text-claude-secondary hover:text-claude-text transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Tutor Sessions
                </button>

                {sessionScreen === 'intro' ? (
                    <section
                        data-testid="river-session-intro"
                        className="mt-8 rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                    >
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                            <div>
                                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">River Session</p>
                                <h1 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold">{title}</h1>
                                <p className="mt-4 text-sm leading-6 text-claude-secondary">
                                    River is here to coach, not corner you. Answer from memory, ask for help when you want it, and leave anytime without losing your place.
                                </p>
                                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-claude-border/70 bg-claude-bg/60 px-4 py-4">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Subject</p>
                                        <p className="mt-2 text-lg font-semibold">{guideData.session_meta.subject}</p>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border/70 bg-claude-bg/60 px-4 py-4">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Goal</p>
                                        <p className="mt-2 text-sm leading-6">{guideData.session_meta.student_goal}</p>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border/70 bg-claude-bg/60 px-4 py-4">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Cards</p>
                                        <p className="mt-2 text-lg font-semibold">{guideData.cards.length}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleStart}
                                    className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                >
                                    Start Session
                                </button>
                            </div>

                            <RiverMascot
                                state={riverState}
                                caption={riverCaption}
                            />
                        </div>
                    </section>
                ) : null}

                {sessionScreen === 'card' && currentCard ? (
                    <section
                        data-testid="river-session-card"
                        className="mt-8 rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                    >
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                            <div>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                                            River • {currentCard.phase}
                                        </p>
                                        <h1 className="mt-3 text-2xl sm:text-3xl font-serif italic font-bold">{currentCard.prompt}</h1>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border/70 bg-claude-bg/60 px-4 py-3 text-right">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Concept</p>
                                        <p className="mt-1 text-sm font-medium">{currentConcept?.title || 'Current concept'}</p>
                                    </div>
                                </div>

                                <label htmlFor="river-answer" className="mt-6 block text-[11px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                    Your answer
                                </label>
                                <textarea
                                    id="river-answer"
                                    aria-label="Your answer"
                                    value={answer}
                                    onChange={(event) => setAnswer(event.target.value)}
                                    disabled={submitting || actionPanelVisible}
                                    className="mt-3 min-h-[140px] w-full rounded-2xl border border-claude-border bg-claude-bg px-4 py-4 text-sm leading-6 outline-none transition-colors focus:border-claude-accent disabled:opacity-80"
                                    placeholder="Answer from memory first."
                                />

                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={submitting || assisting}
                                        className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
                                    >
                                        {submitting ? 'Checking...' : 'Submit Answer'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAskRiver}
                                        disabled={submitting || assisting}
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-claude-accent/30 bg-claude-accent/8 px-4 py-2 text-sm font-medium text-claude-text transition-colors hover:bg-claude-accent/14 disabled:opacity-60"
                                    >
                                        {assisting ? 'Asking River...' : 'Ask River'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleShowAnswer}
                                        disabled={submitting || assisting}
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-claude-border px-4 py-2 text-sm font-medium text-claude-text transition-colors hover:border-claude-accent/35 hover:bg-claude-bg/60 disabled:opacity-60"
                                    >
                                        Show Answer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSkipForNow}
                                        disabled={submitting || assisting}
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-claude-border px-4 py-2 text-sm font-medium text-claude-text transition-colors hover:border-claude-accent/35 hover:bg-claude-bg/60 disabled:opacity-60"
                                    >
                                        Skip for now
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAndLeave}
                                        disabled={submitting || assisting}
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-claude-border px-4 py-2 text-sm font-medium text-claude-secondary transition-colors hover:text-claude-text disabled:opacity-60"
                                    >
                                        Save and leave
                                    </button>
                                </div>

                                {(result || assistResponse) ? (
                                    <div className="mt-6 rounded-2xl border border-claude-border/80 bg-claude-bg/70 px-4 py-4">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">River feedback</p>
                                        {result ? (
                                            <>
                                                <p className="mt-2 text-sm leading-6">{result.feedback}</p>
                                                {result.hintText ? (
                                                    <p className="mt-3 text-sm leading-6 text-claude-secondary">Hint: {result.hintText}</p>
                                                ) : null}
                                                <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.16em] text-claude-accent">
                                                    {riverState}
                                                </p>
                                            </>
                                        ) : null}
                                        {assistResponse ? (
                                            <p className="mt-2 text-sm leading-6">{assistResponse.answer}</p>
                                        ) : null}
                                    </div>
                                ) : null}

                                <div className="mt-6 flex flex-wrap items-center gap-3">
                                    {actionPanelVisible ? (
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
                                                onClick={result?.outcome === 'correct' ? handleAdvance : handleContinueAnyway}
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                            >
                                                {result?.outcome === 'correct' ? 'Continue' : 'Continue anyway'}
                                            </button>
                                        </>
                                    ) : null}
                                    <p className="text-sm text-claude-secondary">
                                        Attempts: {currentCardState?.attempts || 0}
                                    </p>
                                </div>
                            </div>

                            <RiverMascot
                                state={riverState}
                                caption={riverCaption}
                            />
                        </div>
                    </section>
                ) : null}

                {sessionScreen === 'complete' ? (
                    <section
                        data-testid="river-session-complete"
                        className="mt-8 rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                    >
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                            <div>
                                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                                    {completionIsPartial ? 'Session saved' : (guideData.completion?.river_cue?.animation || 'sparkle_mastery')}
                                </p>
                                <h1 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold">
                                    {completionIsPartial ? 'Session saved' : (guideData.completion?.title || 'Session complete')}
                                </h1>
                                <p className="mt-4 text-sm leading-6 text-claude-secondary">
                                    {completionIsPartial
                                        ? 'You are leaving with your place preserved. River will bring you back to the current card when you resume.'
                                        : (guideData.completion?.mastery_message || 'You converted recall into structure.')}
                                </p>
                                <p className="mt-3 text-sm leading-6 text-claude-secondary">
                                    {completionIsPartial
                                        ? 'You can resume now, or come back later without losing your progress.'
                                        : (guideData.completion?.confidence_close || 'You are ready for the next retrieval pass.')}
                                </p>
                                {completionPayload ? (
                                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                        <div className="rounded-2xl border border-claude-border/70 bg-claude-bg/60 px-4 py-4">
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">XP</p>
                                            <p className="mt-2 text-lg font-semibold">{completionPayload.xpEarned || 0}</p>
                                        </div>
                                        <div className="rounded-2xl border border-claude-border/70 bg-claude-bg/60 px-4 py-4">
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Mastery</p>
                                            <p className="mt-2 text-lg font-semibold">{completionPayload.masteryDelta || 0}%</p>
                                        </div>
                                        <div className="rounded-2xl border border-claude-border/70 bg-claude-bg/60 px-4 py-4">
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Next review</p>
                                            <p className="mt-2 text-sm font-medium">
                                                {completionPayload.nextReviewAt
                                                    ? new Date(completionPayload.nextReviewAt).toLocaleDateString()
                                                    : 'When you are ready'}
                                            </p>
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

                            <RiverMascot
                                state={riverState}
                                caption={riverCaption}
                            />
                        </div>
                    </section>
                ) : null}
            </div>
        </div>
    );
}
