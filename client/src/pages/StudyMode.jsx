import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCw, X, Shuffle, Brain, SkipForward } from 'lucide-react';
import { api } from '../api';
import { UserRating, isDue, sortForStudy } from '../utils/fsrs';
import { useStreakContext } from '../hooks/useStreakContext';
import useHaptics from '../hooks/useHaptics';
import useSwipeGesture from '../hooks/useSwipeGesture';
import OutOfHeartsModal from '../components/ui/OutOfHeartsModal';
import StudyHeartsDisplay from '../components/ui/StudyHeartsDisplay';
import gsap from 'gsap';
import { EASE, DURATION } from '../utils/animations';
import SubjectRenderer from '../components/ui/SubjectRenderer';

const SESSION_STORAGE_PREFIX = 'riven-study-session';

function getSessionStorageKey(deckId) {
    return `${SESSION_STORAGE_PREFIX}:${deckId}`;
}

function buildShuffledCards(cards, orderedCardIds = []) {
    if (!orderedCardIds.length) return cards;

    const cardMap = new Map(cards.map((card) => [String(card.id), card]));
    const orderedCards = orderedCardIds
        .map((cardId) => cardMap.get(String(cardId)))
        .filter(Boolean);
    const remainingCards = cards.filter((card) => !orderedCardIds.includes(String(card.id)));

    return [...orderedCards, ...remainingCards];
}

function getCurrentSessionDurationSeconds(activeDurationSeconds = 0, segmentStartedAt = null, now = Date.now()) {
    const savedSeconds = Number(activeDurationSeconds) || 0;
    const liveSeconds = segmentStartedAt
        ? Math.max(0, Math.round((now - segmentStartedAt) / 1000))
        : 0;

    return savedSeconds + liveSeconds;
}

function getElapsedMinutes(activeDurationSeconds = 0, segmentStartedAt = null, now = Date.now()) {
    return Math.max(1, Math.round(getCurrentSessionDurationSeconds(activeDurationSeconds, segmentStartedAt, now) / 60));
}

export default function StudyMode() {
    const { id } = useParams();
    const [deck, setDeck] = useState(null);
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isShuffled, setIsShuffled] = useState(false);
    const [spacedRepetitionMode, setSpacedRepetitionMode] = useState(false);
    const [cardsCorrect, setCardsCorrect] = useState(0);
    const [cardsStudied, setCardsStudied] = useState(0);
    const activeSegmentStartedAtRef = useRef(null);
    const sessionDataRef = useRef({ cardsStudied: 0, cardsCorrect: 0, activeDurationSeconds: 0 });
    const { incrementStreak } = useStreakContext();
    const haptics = useHaptics();
    const [heartsStatus, setHeartsStatus] = useState(null);
    const [showOutOfHearts, setShowOutOfHearts] = useState(false);
    const [isSessionComplete, setIsSessionComplete] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [requeuedCards, setRequeuedCards] = useState([]);
    const [requeueCount, setRequeueCount] = useState(0);
    const [activeDurationSeconds, setActiveDurationSeconds] = useState(0);
    const [elapsedMinutes, setElapsedMinutes] = useState(1);
    const [resumeAvailable, setResumeAvailable] = useState(false);
    const [didResumeSession, setDidResumeSession] = useState(false);
    const progressBarRef = useRef(null);
    const navigationTimeoutRef = useRef(null);
    const currentCard = cards[currentIndex] ?? null;

    const getFlipResetDelay = useCallback(() => {
        if (typeof window === 'undefined') return 0;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : 500;
    }, []);

    useEffect(() => {
        return () => {
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }
        };
    }, []);

    // Animate progress bar
    useEffect(() => {
        if (!progressBarRef.current || cards.length === 0) return;
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const progress = ((currentIndex + 1) / cards.length) * 100;

        if (motionQuery.matches) {
            gsap.set(progressBarRef.current, { width: `${progress}%` });
            return;
        }
        gsap.to(progressBarRef.current, {
            width: `${progress}%`,
            duration: DURATION.normal,
            ease: EASE.organic,
        });
    }, [currentIndex, cards.length]);


    useEffect(() => {
        if (loading) return undefined;

        const syncElapsedMinutes = () => {
            setElapsedMinutes(getElapsedMinutes(activeDurationSeconds, activeSegmentStartedAtRef.current));
        };

        syncElapsedMinutes();
        const intervalId = window.setInterval(syncElapsedMinutes, 30000);
        return () => window.clearInterval(intervalId);
    }, [activeDurationSeconds, loading]);

    // Keep ref in sync with state for cleanup
    useEffect(() => {
        sessionDataRef.current = { cardsStudied, cardsCorrect, activeDurationSeconds };
    }, [activeDurationSeconds, cardsStudied, cardsCorrect]);

    useEffect(() => {
        // Hearts are non-critical — fetch in parallel without blocking card render
        api.getHeartsStatus().then(heartsData => {
            setHeartsStatus(heartsData);
            if (!heartsData.isUnlimited && heartsData.hearts <= 0) {
                setShowOutOfHearts(true);
            }
        }).catch(() => {});

        // Deck is the critical path — show cards as soon as it arrives
        api.getDeck(id).then((data) => {
            const sortedCards = sortForStudy(data.cards);
            let nextCards = sortedCards;
            let nextIndex = 0;
            let nextShuffled = false;
            let nextSpacedMode = false;
            let nextCardsStudied = 0;
            let nextCardsCorrect = 0;
            let nextActiveDurationSeconds = 0;
            let hasResumedSession = false;
            const now = Date.now();

            if (typeof window !== 'undefined') {
                const rawSnapshot = window.localStorage.getItem(getSessionStorageKey(id));
                if (rawSnapshot) {
                    try {
                        const snapshot = JSON.parse(rawSnapshot);
                        nextCards = buildShuffledCards(sortedCards, snapshot.cardOrder || []);
                        nextIndex = Math.min(snapshot.currentIndex || 0, Math.max(nextCards.length - 1, 0));
                        nextShuffled = Boolean(snapshot.isShuffled);
                        nextSpacedMode = Boolean(snapshot.spacedRepetitionMode);
                        nextCardsStudied = snapshot.cardsStudied || 0;
                        nextCardsCorrect = snapshot.cardsCorrect || 0;
                        nextActiveDurationSeconds = Number(snapshot.activeDurationSeconds || 0);
                        hasResumedSession = Boolean(snapshot.cardsStudied || snapshot.currentIndex || snapshot.isShuffled || snapshot.spacedRepetitionMode);
                    } catch {
                        window.localStorage.removeItem(getSessionStorageKey(id));
                    }
                }
            }

            setDeck(data);
            setCards(nextCards);
            setCurrentIndex(nextIndex);
            setIsShuffled(nextShuffled);
            setSpacedRepetitionMode(nextSpacedMode);
            setCardsStudied(nextCardsStudied);
            setCardsCorrect(nextCardsCorrect);
            setIsFlipped(false);
            setIsSessionComplete(false);
            setIsTransitioning(false);
            setResumeAvailable(hasResumedSession);
            setDidResumeSession(hasResumedSession);
            setActiveDurationSeconds(nextActiveDurationSeconds);
            activeSegmentStartedAtRef.current = now;
            setElapsedMinutes(getElapsedMinutes(nextActiveDurationSeconds, now, now));
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });
    }, [id]);

    useEffect(() => {
        if (loading || !id || cards.length === 0 || isSessionComplete || typeof window === 'undefined') return;

        const persistedActiveDurationSeconds = getCurrentSessionDurationSeconds(
            activeDurationSeconds,
            activeSegmentStartedAtRef.current,
        );

        window.localStorage.setItem(getSessionStorageKey(id), JSON.stringify({
            currentIndex,
            isShuffled,
            spacedRepetitionMode,
            cardsStudied,
            cardsCorrect,
            activeDurationSeconds: persistedActiveDurationSeconds,
            cardOrder: cards.map((card) => String(card.id)),
        }));
    }, [
        activeDurationSeconds,
        cards,
        cardsCorrect,
        cardsStudied,
        currentIndex,
        elapsedMinutes,
        id,
        isSessionComplete,
        isShuffled,
        loading,
        spacedRepetitionMode,
    ]);

    // Save session when leaving (using ref to avoid stale closure)
    useEffect(() => {
        const currentId = id;
        return () => {
            const { cardsStudied, cardsCorrect, activeDurationSeconds } = sessionDataRef.current;
            if (cardsStudied > 0) {
                const duration = getCurrentSessionDurationSeconds(
                    activeDurationSeconds,
                    activeSegmentStartedAtRef.current,
                );
                api.saveStudySession(currentId, cardsStudied, cardsCorrect, duration, 'study').catch(() => { });
                // Increment streak when completing a study session
                incrementStreak();
            }
        };
    }, [id, incrementStreak]);

    const clearPersistedSession = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(getSessionStorageKey(id));
        }
        setResumeAvailable(false);
        setDidResumeSession(false);
    }, [id]);

    const queueCardTransition = useCallback((nextIndex = null) => {
        if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
        }

        const completeTransition = () => {
        if (typeof nextIndex === 'number') {
            setCurrentIndex(nextIndex);
            setIsSessionComplete(false);
        } else {
            clearPersistedSession();
            setIsSessionComplete(true);
        }
        setIsTransitioning(false);
    };

        setIsTransitioning(true);
        setIsFlipped(false);

        const delay = isFlipped ? getFlipResetDelay() : 0;
        if (delay === 0) {
            completeTransition();
            return;
        }

        navigationTimeoutRef.current = setTimeout(completeTransition, delay);
    }, [clearPersistedSession, getFlipResetDelay, isFlipped]);

    const handleRate = async (rating) => {
        if (!isFlipped || isTransitioning) return;
        const card = cards[currentIndex];
        setCardsStudied(c => c + 1);

        const isForgot = rating === UserRating.Forgot;

        if (!isForgot) {
            setCardsCorrect(c => c + 1);
        }

        // Deduct a heart on forgot
        if (isForgot && heartsStatus && !heartsStatus.isUnlimited) {
            try {
                const newStatus = await api.decrementHeart();
                setHeartsStatus(newStatus);
                if (newStatus.hearts <= 0) {
                    setShowOutOfHearts(true);
                    return;
                }
            } catch {
                setShowOutOfHearts(true);
                return;
            }
        }

        if (spacedRepetitionMode) {
            await api.reviewCard(card.id, rating).catch(() => { });

            // Requeue forgotten cards for later in this session
            if (isForgot) {
                setRequeuedCards(prev => [...prev, card]);
                setRequeueCount(c => c + 1);
            }
        }

        if (currentIndex < cards.length - 1) {
            queueCardTransition(currentIndex + 1);
        } else if (spacedRepetitionMode && requeuedCards.length > 0) {
            // Cycle through requeued cards
            const requeued = [...requeuedCards];
            if (isForgot) requeued.push(card); // include current forgot card
            setCards(prev => [...prev, ...requeued]);
            setRequeuedCards([]);
            queueCardTransition(currentIndex + 1);
        } else {
            queueCardTransition();
        }
    };

    const handleNext = useCallback(() => {
        if (isTransitioning || isSessionComplete) return;
        if (currentIndex < cards.length - 1) {
            haptics.light();
            queueCardTransition(currentIndex + 1);
        }
    }, [currentIndex, cards.length, haptics, isSessionComplete, isTransitioning, queueCardTransition]);

    const handlePrev = useCallback(() => {
        if (isTransitioning || isSessionComplete) return;
        if (currentIndex > 0) {
            haptics.light();
            queueCardTransition(currentIndex - 1);
        }
    }, [currentIndex, haptics, isSessionComplete, isTransitioning, queueCardTransition]);

    const handleFlip = useCallback(() => {
        if (isTransitioning) return;
        haptics.selection();
        setIsFlipped(f => !f);
    }, [haptics, isTransitioning]);

    const handleShuffle = () => {
        if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
        }
        haptics.medium();
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        setCards(shuffled);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsSessionComplete(false);
        setIsTransitioning(false);
        setIsShuffled(true);
    };

    // Swipe gestures: in SRS mode, swipe to grade; otherwise navigate
    const swipeHandlers = useSwipeGesture({
        onSwipeLeft: spacedRepetitionMode && isFlipped
            ? () => handleRate(UserRating.Forgot)
            : handleNext,
        onSwipeRight: spacedRepetitionMode && isFlipped
            ? () => handleRate(UserRating.Easy)
            : handlePrev,
        threshold: 50
    });

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // SRS grading shortcuts (1/2/3) when card is flipped
            if (spacedRepetitionMode && isFlipped) {
                switch (e.key) {
                    case '1': handleRate(UserRating.Forgot); return;
                    case '2': handleRate(UserRating.Hard); return;
                    case '3': handleRate(UserRating.Easy); return;
                }
            }

            switch (e.key) {
                case 'ArrowRight':
                    handleNext();
                    break;
                case 'ArrowLeft':
                    handlePrev();
                    break;
                case ' ':
                    e.preventDefault();
                    handleFlip();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNext, handlePrev, handleFlip, spacedRepetitionMode, isFlipped]);

    if (loading) return (
        <div className="fullscreen-page items-center justify-center">
            <div className="animate-pulse text-claude-secondary">Loading...</div>
        </div>
    );

    if (cards.length === 0) return (
        <div className="fullscreen-page items-center justify-center p-6">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-display font-bold mb-2 text-center">No Cards Yet</h2>
            <p className="text-claude-secondary text-center mb-6">Add some cards to start studying</p>
            <Link to={`/deck/${id}`} className="claude-button-primary px-6 py-3">Back to Deck</Link>
        </div>
    );

    const isLastCard = currentIndex === cards.length - 1;
    const showSessionComplete = isSessionComplete || (!spacedRepetitionMode && isLastCard && isFlipped);

    const handleRestart = () => {
        if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
        }
        const now = Date.now();
        clearPersistedSession();
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsSessionComplete(false);
        setIsTransitioning(false);
        setIsShuffled(false);
        setSpacedRepetitionMode(false);
        setCardsStudied(0);
        setCardsCorrect(0);
        setActiveDurationSeconds(0);
        activeSegmentStartedAtRef.current = now;
        setElapsedMinutes(1);
    };

    const handleFreshStart = () => {
        const now = Date.now();
        clearPersistedSession();
        const sortedCards = sortForStudy(cards);

        setCards(sortedCards);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsSessionComplete(false);
        setIsTransitioning(false);
        setIsShuffled(false);
        setSpacedRepetitionMode(false);
        setCardsStudied(0);
        setCardsCorrect(0);
        setDidResumeSession(false);
        setActiveDurationSeconds(0);
        activeSegmentStartedAtRef.current = now;
        setElapsedMinutes(1);
    };

    const currentModeLabel = spacedRepetitionMode ? 'Recall grading' : 'Free review';
    const currentModeDescription = spacedRepetitionMode
        ? 'Grade each revealed answer to train future review timing.'
        : 'Flip and browse at your own pace. Shuffle when you want variety.';
    const accuracyRate = cardsStudied > 0 ? Math.round((cardsCorrect / cardsStudied) * 100) : 0;
    const remainingCards = Math.max(cards.length - currentIndex - 1, 0);
    const sessionPhaseLabel = showSessionComplete
        ? 'Wrap-up'
        : isFlipped
            ? (spacedRepetitionMode ? 'Grade recall' : 'Review answer')
            : 'Reveal prompt';
    const sessionCue = showSessionComplete
        ? 'Restart the deck or jump back to editing once you are done.'
        : isFlipped
            ? (spacedRepetitionMode
                ? 'Choose whether you knew the answer to train the next review.'
                : 'Use the controls below to move on or flip back for another look.')
            : 'Read the prompt, then tap the card or press space to reveal the answer.';
    const sessionStatusLabel = didResumeSession ? 'Resumed session' : 'Current session';
    const compactSessionControls = (
        <div className="flex w-full flex-wrap items-center justify-center gap-2 xl:hidden">
            <span className="rounded-full border border-claude-border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-claude-secondary/80">
                {sessionStatusLabel}
            </span>
            <button
                onClick={() => setSpacedRepetitionMode(!spacedRepetitionMode)}
                className={`flex items-center justify-center gap-2 rounded-full px-3 py-2 text-[11px] font-mono tracking-wide transition-colors active:scale-95 ${spacedRepetitionMode
                    ? 'border border-claude-accent/25 bg-claude-accent/15 text-claude-accent'
                    : 'glass-panel text-claude-secondary'
                    }`}
            >
                <Brain className="w-3.5 h-3.5" />
                Spaced Repetition {spacedRepetitionMode ? 'ON' : 'OFF'}
            </button>
            {resumeAvailable ? (
                <button
                    onClick={handleFreshStart}
                    className="rounded-full border border-claude-border px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-claude-text/80 transition hover:border-claude-border hover:text-claude-text"
                >
                    Start fresh
                </button>
            ) : null}
        </div>
    );
    const mobileGestureHint = !showSessionComplete ? (
        <div className="flex w-full items-center justify-center gap-2 rounded-full border border-claude-border/40 bg-claude-bg/40 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.22em] text-claude-secondary/50 md:hidden">
            {spacedRepetitionMode && isFlipped ? (
                <>
                    <span className="text-red-400/60">← Forgot</span>
                    <span className="h-1 w-1 rounded-full bg-claude-surface/80" />
                    <span>Tap to grade</span>
                    <span className="h-1 w-1 rounded-full bg-claude-surface/80" />
                    <span className="text-green-400/60">Easy →</span>
                </>
            ) : (
                <>
                    <span>Swipe</span>
                    <span className="h-1 w-1 rounded-full bg-claude-surface/80" />
                    <span>Tap</span>
                    <span className="h-1 w-1 rounded-full bg-claude-surface/80" />
                    <span>Thumb controls</span>
                </>
            )}
        </div>
    ) : null;
    const actionPanel = showSessionComplete ? (
        <div
            initial={{ opacity: 0, y: 12 }}
            className="w-full space-y-3 gsap-session-complete"
        >
            <div className="text-center mb-4">
                <p className="font-display text-lg font-semibold italic">Session complete</p>
                {cardsStudied > 0 && (
                    <p className="text-xs font-mono text-claude-secondary mt-1">
                        {cardsCorrect}/{cardsStudied} correct · {Math.round((cardsCorrect / cardsStudied) * 100)}%
                        {requeueCount > 0 && ` · ${requeueCount} requeued`}
                    </p>
                )}
            </div>
            <button
                onClick={handleRestart}
                className="w-full py-4 rounded-xl bg-claude-accent font-display font-semibold active:scale-[0.97] transition-transform"
                style={{ color: 'var(--bg-color)' }}
            >
                Study Again
            </button>
            <Link
                to={`/deck/${id}`}
                className="block w-full py-4 rounded-xl glass-panel text-center font-display font-semibold active:scale-[0.98] transition-transform"
            >
                Back to Deck
            </Link>
        </div>
    ) : spacedRepetitionMode && isFlipped ? (
        <div className="grid w-full grid-cols-3 gap-2">
            <button
                onClick={() => handleRate(UserRating.Forgot)}
                className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-red-500/25 bg-red-500/15 font-display font-semibold text-red-400 active:scale-[0.93] transition-transform"
            >
                <span className="text-sm">Forgot</span>
                <span className="text-[9px] font-mono opacity-60 hidden md:block">1</span>
            </button>
            <button
                onClick={() => handleRate(UserRating.Hard)}
                className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-orange-500/25 bg-orange-500/15 font-display font-semibold text-orange-400 active:scale-[0.93] transition-transform"
            >
                <span className="text-sm">Hard</span>
                <span className="text-[9px] font-mono opacity-60 hidden md:block">2</span>
            </button>
            <button
                onClick={() => handleRate(UserRating.Easy)}
                className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-green-500/25 bg-green-500/15 font-display font-semibold text-green-400 active:scale-[0.93] transition-transform"
            >
                <span className="text-sm">Easy</span>
                <span className="text-[9px] font-mono opacity-60 hidden md:block">3</span>
            </button>
        </div>
    ) : (
        <div className="grid w-full grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center gap-4">
            <button
                onClick={handlePrev}
                disabled={currentIndex === 0 || isTransitioning}
                className="flex h-14 w-14 items-center justify-center rounded-xl glass-panel disabled:opacity-30 active:scale-[0.9] transition-transform"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>

            <button
                onClick={handleFlip}
                disabled={isTransitioning}
                className="flex h-14 min-w-0 items-center justify-center gap-3 rounded-xl glass-panel px-8 font-display font-semibold active:scale-[0.95] transition-transform"
            >
                <RotateCw className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isFlipped ? 'rotate-180' : ''}`} />
                <span className="truncate">Flip</span>
            </button>

            <button
                onClick={handleNext}
                disabled={isLastCard || isTransitioning}
                className="flex h-14 w-14 items-center justify-center rounded-xl glass-panel disabled:opacity-30 active:scale-[0.9] transition-transform"
            >
                <ChevronRight className="w-6 h-6" />
            </button>
        </div>
    );

    return (
        <div className="fullscreen-page">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 shrink-0">
                <Link to={`/deck/${id}`} className="touch-target -ml-2 text-claude-secondary tap-action">
                    <X className="w-5 h-5" />
                </Link>
                <div className="flex-1 mx-4">
                    <div className="h-1 bg-claude-border rounded-full overflow-hidden">
                        <div
                            ref={progressBarRef}
                            className="h-full rounded-full"
                            style={{ background: 'linear-gradient(90deg, var(--accent-color), color-mix(in srgb, var(--accent-color) 80%, var(--text-color)))', width: '0%' }}
                        />
                    </div>
                    <p className="text-center text-[10px] font-mono text-claude-secondary mt-1.5 tracking-wide">{currentIndex + 1} / {cards.length}</p>
                </div>
                <div className="flex items-center gap-2">
                    <StudyHeartsDisplay heartsStatus={heartsStatus} />
                    <button
                        onClick={handleShuffle}
                        className={`p-2 ${isShuffled ? 'text-claude-accent' : 'text-claude-secondary'}`}
                        title="Shuffle cards"
                    >
                        <Shuffle className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Card area */}
            <div className="flex-1 min-h-0 px-4 py-3 sm:py-4">
                <div className="mx-auto grid h-full min-h-0 w-full max-w-6xl items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-center xl:gap-6">
                    <div className="flex min-h-0 items-center justify-center xl:justify-center">
                        <div className="flex w-full max-w-sm flex-col items-center justify-center gap-4 xl:gap-5">
                            <div className="w-full" {...swipeHandlers}>
                                <div
                                    className="w-full aspect-[3/4] max-h-[min(34rem,calc(var(--app-height)-21rem))] cursor-pointer touch-none"
                                    style={{
                                        perspective: '1200px',
                                        transform: 'translateZ(0)',
                                        willChange: 'transform',
                                    }}
                                    onClick={handleFlip}
                                >
                                    <motion.div
                                        className="relative w-full h-full"
                                        style={{ transformStyle: 'preserve-3d' }}
                                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                                    >
                                        {/* Front — warm surface with paper grain */}
                                        <div
                                            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden p-6 sm:p-8"
                                            style={{
                                                backfaceVisibility: 'hidden',
                                                WebkitBackfaceVisibility: 'hidden',
                                                transform: 'translateZ(1px)',
                                                willChange: 'transform, opacity',
                                                background: 'linear-gradient(165deg, var(--surface-color) 0%, #152d34 100%)',
                                                border: '1px solid var(--border-color)',
                                                boxShadow: '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
                                            }}
                                        >
                                            {/* Paper grain overlay */}
                                            <div
                                                className="absolute inset-0 pointer-events-none opacity-[0.015]"
                                                style={{
                                                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
                                                    backgroundSize: '128px 128px',
                                                }}
                                            />
                                            <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-claude-border/50" />
                                            <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-claude-border/50" />
                                            <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-claude-border/50" />
                                            <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-claude-border/50" />

                                            <span
                                                className="font-mono text-[9px] uppercase tracking-[0.25em] text-claude-secondary mb-5"
                                                style={{ transform: 'rotate(-2deg)' }}
                                            >
                                                Question
                                            </span>
                                            {currentCard.front_image && (
                                                <img
                                                    src={currentCard.front_image}
                                                    alt="Card front"
                                                    className="max-h-[35%] max-w-full object-contain rounded-lg mb-3"
                                                />
                                            )}
                                            <div className={`font-display font-semibold text-center leading-snug ${currentCard.front_image ? 'text-lg' : 'text-xl'}`}><SubjectRenderer content={currentCard.front} /></div>
                                            {currentCard.card_state && currentCard.card_state !== 'new' && (
                                                <span className={`absolute top-4 right-4 text-[9px] font-mono px-2 py-0.5 rounded-full ${currentCard.card_state === 'relearning' ? 'bg-red-500/15 text-red-400' :
                                                    currentCard.card_state === 'learning' ? 'bg-yellow-500/15 text-yellow-400' :
                                                        'bg-green-500/15 text-green-400'
                                                    }`}>
                                                    {currentCard.card_state === 'relearning' ? 'Relearning' : currentCard.card_state === 'learning' ? 'Learning' : 'Review'}
                                                </span>
                                            )}
                                            <span className="absolute bottom-5 text-[10px] font-mono text-claude-secondary/50 tracking-wide">tap or press space to reveal</span>
                                        </div>

                                        {/* Back — accent with dramatic shadow */}
                                        <div
                                            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden p-6 sm:p-8"
                                            style={{
                                                backfaceVisibility: 'hidden',
                                                WebkitBackfaceVisibility: 'hidden',
                                                transform: 'rotateY(180deg) translateZ(1px)',
                                                willChange: 'transform, opacity',
                                                background: 'linear-gradient(165deg, var(--accent-color) 0%, color-mix(in srgb, var(--accent-color) 70%, var(--bg-color)) 100%)',
                                                border: '1px solid rgba(122,158,114,0.25)',
                                                boxShadow: '0 8px 32px rgba(34,83,96,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                                            }}
                                        >
                                            <div
                                                className="absolute inset-0 pointer-events-none opacity-[0.02]"
                                                style={{
                                                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
                                                    backgroundSize: '128px 128px',
                                                }}
                                            />
                                            <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-claude-border" />
                                            <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-claude-border" />
                                            <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-claude-border" />
                                            <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-claude-border" />

                                            <span
                                                className="font-mono text-[9px] uppercase tracking-[0.25em] text-claude-secondary/50 mb-5"
                                                style={{ transform: 'rotate(-2deg)' }}
                                            >
                                                Answer
                                            </span>
                                            {currentCard.back_image && (
                                                <img
                                                    src={currentCard.back_image}
                                                    alt="Card back"
                                                    className="max-h-[35%] max-w-full object-contain rounded-lg mb-3"
                                                />
                                            )}
                                            <div className={`font-display font-semibold text-claude-text text-center leading-snug ${currentCard.back_image ? 'text-lg' : 'text-xl'}`}><SubjectRenderer content={currentCard.back} /></div>
                                            <span className="absolute bottom-5 text-[10px] font-mono text-claude-secondary/50 tracking-wide">tap or press space to flip back</span>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                            {compactSessionControls}
                            {mobileGestureHint}
                            {actionPanel}
                        </div>
                    </div>

                    <aside className="hidden xl:block">
                        <div className="sticky top-6 space-y-4 overflow-y-auto max-h-[calc(100vh-5.5rem)]">
                            <div className="rounded-[24px] border border-claude-border bg-[linear-gradient(155deg,rgba(18,38,44,0.96),rgba(27,49,56,0.92))] px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
                                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.24em] text-claude-secondary">
                                    <span>{sessionStatusLabel}</span>
                                    <span className="rounded-full border border-claude-border px-2 py-1 tracking-[0.18em] text-claude-secondary/80">
                                        {currentModeLabel}
                                    </span>
                                </div>
                                <div className="text-[10px] font-mono uppercase tracking-[0.26em] text-claude-secondary">Study Focus</div>
                                <p className="mt-3 font-display text-2xl font-semibold text-claude-text">
                                    {deck?.title || 'Current deck'}
                                </p>
                                <p className="mt-2 text-sm text-claude-secondary">
                                    {deck?.description || 'Work the current card, keep momentum, and finish the session without losing context.'}
                                </p>
                                <p className="mt-3 text-sm text-claude-secondary/80">
                                    {didResumeSession ? 'You are back where you left off.' : currentModeDescription}
                                </p>

                                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px] font-mono text-claude-text/80">
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-3">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Remaining</div>
                                        <div className="mt-1 text-lg text-claude-text">{remainingCards}</div>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-3">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Accuracy</div>
                                        <div className="mt-1 text-lg text-claude-text">{accuracyRate}%</div>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-mono text-claude-text/80">
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-2">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Studied</div>
                                        <div className="mt-1 text-sm text-claude-text">{cardsStudied}</div>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-2">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Correct</div>
                                        <div className="mt-1 text-sm text-claude-text">{cardsCorrect}</div>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-2">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Minutes</div>
                                        <div className="mt-1 text-sm text-claude-text">{elapsedMinutes}</div>
                                    </div>
                                </div>

                                {resumeAvailable ? (
                                    <div className="mt-4 border-t border-claude-border pt-4">
                                        <p className="text-xs text-claude-secondary/80">
                                            Resume is saved on this device until the session finishes.
                                        </p>
                                        <button
                                            onClick={handleFreshStart}
                                            className="mt-3 w-full rounded-full border border-claude-border px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-claude-text/80 transition hover:border-claude-border hover:text-claude-text"
                                        >
                                            Start fresh
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            <div className="rounded-[22px] border border-claude-border bg-claude-bg/40 px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-claude-secondary/50">Session Phase</div>
                                        <p className="mt-1 font-display text-lg text-claude-text">{sessionPhaseLabel}</p>
                                    </div>
                                    <button
                                        onClick={() => setSpacedRepetitionMode(!spacedRepetitionMode)}
                                        className={`flex items-center justify-center gap-2 rounded-full px-3 py-2 text-[11px] font-mono tracking-wide transition-colors active:scale-95 ${spacedRepetitionMode
                                            ? 'bg-claude-accent/15 text-claude-accent border border-claude-accent/25'
                                            : 'glass-panel text-claude-secondary'
                                            }`}
                                    >
                                        <Brain className="w-3.5 h-3.5" />
                                        {spacedRepetitionMode ? 'Recall ON' : 'Recall OFF'}
                                    </button>
                                </div>
                                <p className="mt-3 text-sm text-claude-secondary">{sessionCue}</p>

                                <div className="mt-4 rounded-2xl border border-claude-border bg-claude-bg/15 px-3 py-3">
                                    <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-claude-secondary/50">Desktop controls</div>
                                    <div className="mt-3 space-y-2 text-[11px] font-mono text-claude-secondary">
                                        <div className="flex items-center justify-between gap-3">
                                            <span>Previous card</span>
                                            <kbd className="rounded border border-claude-border bg-claude-bg/40 px-2 py-1 text-[10px] text-claude-text/80">←</kbd>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span>Flip current card</span>
                                            <kbd className="rounded border border-claude-border bg-claude-bg/40 px-2 py-1 text-[10px] text-claude-text/80">Space</kbd>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span>Next card</span>
                                            <kbd className="rounded border border-claude-border bg-claude-bg/40 px-2 py-1 text-[10px] text-claude-text/80">→</kbd>
                                        </div>
                                        {spacedRepetitionMode && (
                                            <>
                                                <div className="border-t border-claude-border pt-2 mt-2 flex items-center justify-between gap-3">
                                                    <span className="text-red-400">Forgot</span>
                                                    <kbd className="rounded border border-claude-border bg-claude-bg/40 px-2 py-1 text-[10px] text-claude-text/80">1</kbd>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-orange-400">Hard</span>
                                                    <kbd className="rounded border border-claude-border bg-claude-bg/40 px-2 py-1 text-[10px] text-claude-text/80">2</kbd>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-green-400">Easy</span>
                                                    <kbd className="rounded border border-claude-border bg-claude-bg/40 px-2 py-1 text-[10px] text-claude-text/80">3</kbd>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            <OutOfHeartsModal isOpen={showOutOfHearts} onClose={() => setShowOutOfHearts(false)} onPractice={async () => {
                try {
                    const result = await api.practiceRefill();
                    setHeartsStatus(result);
                    setShowOutOfHearts(false);
                } catch {
                    setShowOutOfHearts(false);
                }
            }} onUpgrade={() => {
                setShowOutOfHearts(false);
            }} />
        </div>
    );
}
