import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCw, X, Shuffle, ThumbsUp, ThumbsDown, Brain } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import { useStreakContext } from '../hooks/useStreakContext';
import useHaptics from '../hooks/useHaptics';
import useSwipeGesture from '../hooks/useSwipeGesture';

export default function StudyMode() {
    const { id } = useParams();
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isShuffled, setIsShuffled] = useState(false);
    const [spacedRepetitionMode, setSpacedRepetitionMode] = useState(false);
    const [cardsCorrect, setCardsCorrect] = useState(0);
    const [cardsStudied, setCardsStudied] = useState(0);
    const startTime = useRef(null);
    const sessionDataRef = useRef({ cardsStudied: 0, cardsCorrect: 0 });
    const { incrementStreak } = useStreakContext();
    const haptics = useHaptics();

    // Initialize start time on mount
    useEffect(() => {
        startTime.current = Date.now();
    }, []);

    // Keep ref in sync with state for cleanup
    useEffect(() => {
        sessionDataRef.current = { cardsStudied, cardsCorrect };
    }, [cardsStudied, cardsCorrect]);

    useEffect(() => {
        api.getDeck(id).then(data => {
            // Sort cards by next_review date for spaced repetition (due cards first)
            const sortedCards = [...data.cards].sort((a, b) => {
                if (!a.next_review) return -1;
                if (!b.next_review) return 1;
                return new Date(a.next_review) - new Date(b.next_review);
            });
            setCards(sortedCards);
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });
    }, [id]);

    // Save session when leaving (using ref to avoid stale closure)
    useEffect(() => {
        const currentId = id;
        return () => {
            const { cardsStudied, cardsCorrect } = sessionDataRef.current;
            if (cardsStudied > 0) {
                const duration = Math.round((Date.now() - startTime.current) / 1000);
                api.saveStudySession(currentId, cardsStudied, cardsCorrect, duration, 'study').catch(() => { });
                // Increment streak when completing a study session
                incrementStreak();
            }
        };
    }, [id, incrementStreak]);

    const handleKnew = async () => {
        if (!isFlipped) return;
        const card = cards[currentIndex];
        setCardsStudied(c => c + 1);
        setCardsCorrect(c => c + 1);

        if (spacedRepetitionMode) {
            await api.reviewCard(card.id, true).catch(() => { });
        }

        if (currentIndex < cards.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(c => c + 1), 150);
        } else {
            // End of deck
            setIsFlipped(false);
        }
    };

    const handleDidntKnow = async () => {
        if (!isFlipped) return;
        const card = cards[currentIndex];
        setCardsStudied(c => c + 1);

        if (spacedRepetitionMode) {
            await api.reviewCard(card.id, false).catch(() => { });
        }

        if (currentIndex < cards.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(c => c + 1), 150);
        } else {
            setIsFlipped(false);
        }
    };

    const handleNext = useCallback(() => {
        if (currentIndex < cards.length - 1) {
            haptics.light();
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(c => c + 1), 150);
        }
    }, [currentIndex, cards.length, haptics]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            haptics.light();
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(c => c - 1), 150);
        }
    }, [currentIndex, haptics]);

    const handleFlip = useCallback(() => {
        haptics.selection();
        setIsFlipped(f => !f);
    }, [haptics]);

    const handleShuffle = () => {
        haptics.medium();
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        setCards(shuffled);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsShuffled(true);
    };

    // Swipe gestures for card navigation
    const swipeHandlers = useSwipeGesture({
        onSwipeLeft: handleNext,
        onSwipeRight: handlePrev,
        threshold: 50
    });

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

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
    }, [handleNext, handlePrev, handleFlip]);

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

    const currentCard = cards[currentIndex];
    const progress = ((currentIndex + 1) / cards.length) * 100;
    const isLastCard = currentIndex === cards.length - 1;

    const handleRestart = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
    };

    return (
        <div className="fullscreen-page">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 shrink-0">
                <Link to={`/deck/${id}`} className="touch-target -ml-2 text-claude-secondary tap-action">
                    <X className="w-5 h-5" />
                </Link>
                <div className="flex-1 mx-4">
                    <div className="h-1 bg-claude-border rounded-full overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            style={{ background: 'linear-gradient(90deg, var(--botanical-forest), var(--accent-color))' }}
                            animate={{ width: `${progress}%` }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                    </div>
                    <p className="text-center text-[10px] font-mono text-botanical-sepia mt-1.5 tracking-wide">{currentIndex + 1} / {cards.length}</p>
                </div>
                <button
                    onClick={handleShuffle}
                    className={`p-2 -mr-2 ${isShuffled ? 'text-claude-accent' : 'text-claude-secondary'}`}
                    title="Shuffle cards"
                >
                    <Shuffle className="w-5 h-5" />
                </button>
            </div>

            {/* Keyboard hints - only show on desktop */}
            <div className="hidden md:flex justify-center gap-4 text-[10px] font-mono text-claude-secondary px-4 py-1">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-claude-surface border border-claude-border rounded text-[10px]">←</kbd> Previous</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-claude-surface border border-claude-border rounded text-[10px]">Space</kbd> Flip</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-claude-surface border border-claude-border rounded text-[10px]">→</kbd> Next</span>
            </div>

            {/* Spaced Repetition Toggle */}
            <div className="flex justify-center mb-2">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSpacedRepetitionMode(!spacedRepetitionMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wide transition-colors ${spacedRepetitionMode
                        ? 'bg-claude-accent/15 text-claude-accent border border-claude-accent/25'
                        : 'bg-claude-surface border border-claude-border text-claude-secondary'
                        }`}
                >
                    <Brain className="w-3.5 h-3.5" />
                    Spaced Repetition {spacedRepetitionMode ? 'ON' : 'OFF'}
                </motion.button>
            </div>

            {/* Card area */}
            <div className="flex-1 flex items-center justify-center px-4 py-4" {...swipeHandlers}>
                <div
                    className="w-full max-w-sm aspect-[3/4] cursor-pointer"
                    style={{ perspective: '1200px' }}
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
                            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-8 overflow-hidden"
                            style={{
                                backfaceVisibility: 'hidden',
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
                            {/* Decorative corner marks */}
                            <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-claude-border/50" />
                            <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-claude-border/50" />
                            <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-claude-border/50" />
                            <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-claude-border/50" />

                            {/* Rotated label */}
                            <span
                                className="font-mono text-[9px] uppercase tracking-[0.25em] text-botanical-sepia mb-5"
                                style={{ transform: 'rotate(-2deg)' }}
                            >
                                Question
                            </span>
                            {currentCard.front_image && (
                                <img
                                    src={currentCard.front_image}
                                    alt="Card front"
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-[35%] max-w-full object-contain rounded-lg mb-3"
                                />
                            )}
                            <p className={`font-display font-semibold text-center leading-snug ${currentCard.front_image ? 'text-lg' : 'text-xl'}`}>{currentCard.front}</p>
                            {currentCard.difficulty > 0 && (
                                <span className={`absolute top-4 right-4 text-[9px] font-mono px-2 py-0.5 rounded-full ${currentCard.difficulty >= 4 ? 'bg-red-500/15 text-red-400' :
                                    currentCard.difficulty >= 2 ? 'bg-yellow-500/15 text-yellow-400' :
                                        'bg-green-500/15 text-green-400'
                                    }`}>
                                    {currentCard.difficulty >= 4 ? 'Hard' : currentCard.difficulty >= 2 ? 'Medium' : 'Easy'}
                                </span>
                            )}
                            <span className="absolute bottom-5 text-[10px] font-mono text-claude-secondary/50 tracking-wide">tap to reveal</span>
                        </div>

                        {/* Back — forest green with dramatic shadow */}
                        <div
                            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-8 overflow-hidden"
                            style={{
                                backfaceVisibility: 'hidden',
                                transform: 'rotateY(180deg)',
                                background: 'linear-gradient(165deg, var(--botanical-forest) 0%, #2d5a3e 100%)',
                                border: '1px solid rgba(122,158,114,0.25)',
                                boxShadow: '0 8px 32px rgba(34,83,96,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                            }}
                        >
                            {/* Paper grain overlay */}
                            <div
                                className="absolute inset-0 pointer-events-none opacity-[0.02]"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
                                    backgroundSize: '128px 128px',
                                }}
                            />
                            {/* Decorative corner marks */}
                            <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-white/10" />
                            <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-white/10" />
                            <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-white/10" />
                            <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-white/10" />

                            <span
                                className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40 mb-5"
                                style={{ transform: 'rotate(-2deg)' }}
                            >
                                Answer
                            </span>
                            {currentCard.back_image && (
                                <img
                                    src={currentCard.back_image}
                                    alt="Card back"
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-[35%] max-w-full object-contain rounded-lg mb-3"
                                />
                            )}
                            <p className={`font-display font-semibold text-white text-center leading-snug ${currentCard.back_image ? 'text-lg' : 'text-xl'}`}>{currentCard.back}</p>
                            <span className="absolute bottom-5 text-[10px] font-mono text-white/30 tracking-wide">tap to flip back</span>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Navigation */}
            <div className="px-4 pb-8 shrink-0">
                {isLastCard && isFlipped ? (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 max-w-sm mx-auto"
                    >
                        <div className="text-center mb-4">
                            <p className="font-display text-lg font-semibold italic">Session complete</p>
                            {cardsStudied > 0 && (
                                <p className="text-xs font-mono text-botanical-sepia mt-1">
                                    {cardsCorrect}/{cardsStudied} correct · {Math.round((cardsCorrect / cardsStudied) * 100)}%
                                </p>
                            )}
                        </div>
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleRestart}
                            className="w-full py-4 rounded-xl bg-claude-accent font-display font-semibold"
                            style={{ color: 'var(--bg-color)' }}
                        >
                            Study Again
                        </motion.button>
                        <Link
                            to={`/deck/${id}`}
                            className="block w-full py-4 rounded-xl bg-claude-surface border border-claude-border text-center font-display font-semibold active:scale-[0.98] transition-transform"
                        >
                            Back to Deck
                        </Link>
                    </motion.div>
                ) : spacedRepetitionMode && isFlipped ? (
                    <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
                        <motion.button
                            whileTap={{ scale: 0.93 }}
                            onClick={handleDidntKnow}
                            className="flex-1 h-14 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 flex items-center justify-center gap-2 font-display font-semibold"
                        >
                            <ThumbsDown className="w-5 h-5" />
                            Didn't Know
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.93 }}
                            onClick={handleKnew}
                            className="flex-1 h-14 rounded-xl bg-green-500/15 border border-green-500/25 text-green-400 flex items-center justify-center gap-2 font-display font-semibold"
                        >
                            <ThumbsUp className="w-5 h-5" />
                            Knew It
                        </motion.button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-4">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            className="w-14 h-14 rounded-xl bg-claude-surface border border-claude-border flex items-center justify-center disabled:opacity-30"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleFlip}
                            className="h-14 px-8 rounded-xl bg-claude-surface border border-claude-border flex items-center gap-3 font-display font-semibold"
                        >
                            <RotateCw className={`w-5 h-5 transition-transform duration-300 ${isFlipped ? 'rotate-180' : ''}`} />
                            Flip
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleNext}
                            disabled={isLastCard}
                            className="w-14 h-14 rounded-xl bg-claude-surface border border-claude-border flex items-center justify-center disabled:opacity-30"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </motion.button>
                    </div>
                )}
            </div>
        </div>
    );
}
