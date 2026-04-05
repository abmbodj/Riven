import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import {
    ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION,
    evaluateTutorCardResponse,
    normalizeGuideData,
    normalizeGuideStudyState,
} from '../utils/studyGuides';

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
    const [completionPayload, setCompletionPayload] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const sessionStartStateRef = useRef(null);
    const completionStartedRef = useRef(false);

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
            setCompletionPayload(null);
            sessionStartStateRef.current = normalizedStudyState;
            completionStartedRef.current = false;
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
        ? studyState.card_states?.[currentCard.id] || null
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

    const handleStart = () => {
        setSessionScreen('card');
        setResult(null);
        setAnswer('');
    };

    const handleSubmit = async () => {
        if (!guideData || !currentCard || submitting) return;

        setSubmitting(true);
        try {
            const evaluation = evaluateTutorCardResponse(guideData, currentCard, answer);
            const nowIso = new Date().toISOString();
            const cardState = currentCardState || {
                attempts: 0,
                hints_used: 0,
                status: 'unseen',
                last_outcome: null,
                completed: false,
            };
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
            const nextHintCount = evaluation.outcome === 'correct'
                ? cardState.hints_used || 0
                : Math.min(
                    (cardState.hints_used || 0) + 1,
                    guideData.adaptation_rules.max_hints_per_card,
                );
            const nextCardState = {
                ...cardState,
                attempts: (cardState.attempts || 0) + 1,
                hints_used: nextHintCount,
                status: evaluation.outcome === 'correct'
                    ? 'mastered'
                    : evaluation.outcome === 'partial'
                        ? 'needs_review'
                        : 'retry',
                last_outcome: evaluation.outcome,
                completed: evaluation.outcome === 'correct',
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
            const hintText = evaluation.outcome === 'correct'
                ? null
                : currentCard.hints?.[(nextCardState.hints_used || 1) - 1]?.text || null;

            setResult({
                ...evaluation,
                hintText,
                nextCardId: transitionCardId,
                sessionComplete,
                persistedState,
            });
        } catch (error) {
            toastRef.current.error('Failed to update tutor session');
        } finally {
            setSubmitting(false);
        }
    };

    const handleContinue = async () => {
        if (!guideData || !result || completionStartedRef.current) return;

        if (result.nextCardId) {
            const nextCard = guideData.cards.find((card) => card.id === result.nextCardId) || null;
            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                current_card_id: result.nextCardId,
                session_phase: nextCard?.phase || studyState.session_phase,
            });

            try {
                await persistStudyState(nextState);
                setAnswer('');
                setResult(null);
            } catch {
                toastRef.current.error('Failed to move to the next card');
            }
            return;
        }

        if (result.sessionComplete) {
            completionStartedRef.current = true;
            try {
                const payload = await api.completeStudyCoachSession({
                    guideId: id,
                    guideData,
                    studyStateBefore: sessionStartStateRef.current || studyState,
                    studyStateAfter: result.persistedState || studyState,
                    mode: 'guided',
                    source: 'guide_view',
                    classId: guide?.class_id || null,
                });
                setCompletionPayload(payload);
                setSessionScreen('complete');
                setResult(null);
            } catch (error) {
                toastRef.current.error('Failed to complete tutor session');
                completionStartedRef.current = false;
            }
            return;
        }

        setResult(null);
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

    const riverName = guideData.river?.name || 'River';
    const title = guide?.title || 'Tutor Session';

    return (
        <div className="min-h-screen bg-claude-bg text-claude-text px-4 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-3xl">
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
                        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">River Session</p>
                        <h1 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold">{title}</h1>
                        <p className="mt-4 text-sm leading-6 text-claude-secondary">
                            One card at a time. We start with recall, adapt when you miss, and finish on a clear sense of mastery.
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
                        <div className="mt-6 rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-4 py-4">
                            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-accent">Tutor companion</p>
                            <p className="mt-2 text-sm leading-6">{guideData.river?.dialogue_variants?.opening?.[0] || 'We will train this, not skim it.'}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleStart}
                            className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                        >
                            Start Session
                        </button>
                    </section>
                ) : null}

                {sessionScreen === 'card' && currentCard ? (
                    <section
                        data-testid="river-session-card"
                        className="mt-8 rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                                    {riverName} • {currentCard.phase}
                                </p>
                                <h1 className="mt-3 text-2xl sm:text-3xl font-serif italic font-bold">{currentCard.prompt}</h1>
                            </div>
                            <div className="rounded-2xl border border-claude-border/70 bg-claude-bg/60 px-4 py-3 text-right">
                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Concept</p>
                                <p className="mt-1 text-sm font-medium">{currentConcept?.title || 'Current concept'}</p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-4 py-4">
                            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-accent">{riverName}</p>
                            <p className="mt-2 text-sm leading-6">{currentCard.river?.intro || 'Try it before I help.'}</p>
                        </div>

                        <label htmlFor="river-answer" className="mt-6 block text-[11px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                            Your answer
                        </label>
                        <textarea
                            id="river-answer"
                            aria-label="Your answer"
                            value={answer}
                            onChange={(event) => setAnswer(event.target.value)}
                            disabled={submitting || Boolean(result)}
                            className="mt-3 min-h-[140px] w-full rounded-2xl border border-claude-border bg-claude-bg px-4 py-4 text-sm leading-6 outline-none transition-colors focus:border-claude-accent"
                            placeholder="Answer from memory first."
                        />

                        {result ? (
                            <div className="mt-6 rounded-2xl border border-claude-border/80 bg-claude-bg/70 px-4 py-4">
                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">River feedback</p>
                                <p className="mt-2 text-sm leading-6">{result.feedback}</p>
                                {result.hintText ? (
                                    <p className="mt-3 text-sm leading-6 text-claude-secondary">Hint: {result.hintText}</p>
                                ) : null}
                                <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.16em] text-claude-accent">
                                    {result.cue?.animation} • {result.cue?.expression}
                                </p>
                            </div>
                        ) : null}

                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            {!result ? (
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
                                >
                                    {submitting ? 'Checking...' : 'Submit Answer'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleContinue}
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                >
                                    Continue
                                </button>
                            )}
                            <p className="text-sm text-claude-secondary">
                                Attempts: {currentCardState?.attempts || 0}
                            </p>
                        </div>
                    </section>
                ) : null}

                {sessionScreen === 'complete' ? (
                    <section
                        data-testid="river-session-complete"
                        className="mt-8 rounded-[2rem] border border-claude-border bg-claude-surface p-6 sm:p-8"
                    >
                        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                            {guideData.completion?.river_cue?.animation || 'sparkle_mastery'}
                        </p>
                        <h1 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold">
                            {guideData.completion?.title || 'Session complete'}
                        </h1>
                        <p className="mt-4 text-sm leading-6 text-claude-secondary">
                            {guideData.completion?.mastery_message || 'You converted recall into structure.'}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-claude-secondary">
                            {guideData.completion?.confidence_close || 'You are ready for the next retrieval pass.'}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-claude-secondary">
                            {completionPayload?.nextReviewAt
                                ? `Next review: ${new Date(completionPayload.nextReviewAt).toLocaleString()}`
                                : guideData.completion?.next_review_message || ''}
                        </p>
                    </section>
                ) : null}
            </div>
        </div>
    );
}
