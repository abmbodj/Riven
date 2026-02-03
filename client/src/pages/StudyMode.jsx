import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCw, X, Shuffle, ThumbsUp, ThumbsDown, Brain } from 'lucide-react';
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
                api.saveStudySession(currentId, cardsStudied, cardsCorrect, duration, 'study').catch(() => {});
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
            await api.reviewCard(card.id, true).catch(() => {});
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
            await api.reviewCard(card.id, false).catch(() => {});
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
                    <X className="w-6 h-6" />
                </Link>
                <div className="flex-1 mx-4">
                    <div className="h-1.5 bg-claude-border rounded-full overflow-hidden">
                        <div
                            className="h-full bg-claude-accent transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-center text-xs text-claude-secondary mt-1">{currentIndex + 1} / {cards.length}</p>
                </div>
                <button
                    onClick={handleShuffle}
                    className={`p-2 -mr-2 ${isShuffled ? 'text-claude-accent' : 'text-claude-secondary'}`}
                    title="Shuffle cards"
                >
                    <Shuffle className="w-6 h-6" />
                </button>
            </div>

            {/* Keyboard hints - only show on desktop */}
            <div className="hidden md:flex justify-center gap-4 text-[10px] text-claude-secondary px-4 py-1">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-claude-surface border border-claude-border rounded text-[10px]">←</kbd> Previous</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-claude-surface border border-claude-border rounded text-[10px]">Space</kbd> Flip</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-claude-surface border border-claude-border rounded text-[10px]">→</kbd> Next</span>
            </div>

            {/* Spaced Repetition Toggle */}
            <div className="flex justify-center mb-2">
                <button
                    onClick={() => setSpacedRepetitionMode(!spacedRepetitionMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        spacedRepetitionMode 
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                            : 'bg-claude-surface border border-claude-border text-claude-secondary'
                    }`}
                >
                    <Brain className="w-3.5 h-3.5" />
                    Spaced Repetition {spacedRepetitionMode ? 'ON' : 'OFF'}
                </button>
            </div>

            {/* Card area */}
            <div className="flex-1 flex items-center justify-center px-4 py-6" {...swipeHandlers}>
                <div
                    className={`w-full max-w-sm aspect-[3/4] cursor-pointer perspective-1000`}
                    onClick={handleFlip}
                >
                    <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                        {/* Front */}
                        <div className="absolute inset-0 bg-claude-surface rounded-3xl border border-claude-border flex flex-col items-center justify-center p-6 backface-hidden overflow-hidden">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-3">Question</span>
                            {currentCard.front_image && (
                                <img 
                                    src={currentCard.front_image} 
                                    alt="Card front" 
                                    className="max-h-[40%] max-w-full object-contain rounded-xl mb-3"
                                />
                            )}
                            <p className={`font-display font-semibold text-center leading-tight ${currentCard.front_image ? 'text-lg' : 'text-2xl'}`}>{currentCard.front}</p>
                            {currentCard.difficulty > 0 && (
                                <span className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded-full ${
                                    currentCard.difficulty >= 4 ? 'bg-red-500/20 text-red-400' :
                                    currentCard.difficulty >= 2 ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-green-500/20 text-green-400'
                                }`}>
                                    {currentCard.difficulty >= 4 ? 'Hard' : currentCard.difficulty >= 2 ? 'Medium' : 'Easy'}
                                </span>
                            )}
                            <span className="absolute bottom-4 text-xs text-claude-secondary">Tap to flip</span>
                        </div>

                        {/* Back */}
                        <div className="absolute inset-0 bg-claude-accent rounded-3xl flex flex-col items-center justify-center p-6 backface-hidden rotate-y-180 overflow-hidden">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">Answer</span>
                            {currentCard.back_image && (
                                <img 
                                    src={currentCard.back_image} 
                                    alt="Card back" 
                                    className="max-h-[40%] max-w-full object-contain rounded-xl mb-3"
                                />
                            )}
                            <p className={`font-display font-semibold text-white text-center leading-tight ${currentCard.back_image ? 'text-lg' : 'text-2xl'}`}>{currentCard.back}</p>
                            <span className="absolute bottom-4 text-xs text-white/50">Tap to flip back</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="px-4 pb-8 shrink-0">
                {isLastCard && isFlipped ? (
                    <div className="space-y-3 max-w-sm mx-auto">
                        <div className="text-center mb-4">
                            <p className="text-claude-secondary text-sm">🎉 You've reviewed all cards!</p>
                            {cardsStudied > 0 && (
                                <p className="text-xs text-claude-secondary mt-1">
                                    Score: {cardsCorrect}/{cardsStudied} ({Math.round((cardsCorrect/cardsStudied)*100)}%)
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleRestart}
                            className="w-full py-4 rounded-2xl bg-claude-accent text-white font-semibold active:scale-[0.98] transition-transform"
                        >
                            Study Again
                        </button>
                        <Link
                            to={`/deck/${id}`}
                            className="block w-full py-4 rounded-2xl bg-claude-surface border border-claude-border text-center font-semibold active:scale-[0.98] transition-transform"
                        >
                            Back to Deck
                        </Link>
                    </div>
                ) : spacedRepetitionMode && isFlipped ? (
                    <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
                        <button
                            onClick={handleDidntKnow}
                            className="flex-1 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center gap-2 font-semibold active:scale-95 transition-transform"
                        >
                            <ThumbsDown className="w-5 h-5" />
                            Didn't Know
                        </button>
                        <button
                            onClick={handleKnew}
                            className="flex-1 h-14 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-400 flex items-center justify-center gap-2 font-semibold active:scale-95 transition-transform"
                        >
                            <ThumbsUp className="w-5 h-5" />
                            Knew It
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            className="w-16 h-16 rounded-2xl bg-claude-surface border border-claude-border flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform"
                        >
                            <ChevronLeft className="w-7 h-7" />
                        </button>

                        <button
                            onClick={handleFlip}
                            className="h-16 px-8 rounded-2xl bg-claude-surface border border-claude-border flex items-center gap-3 font-semibold active:scale-95 transition-transform"
                        >
                            <RotateCw className={`w-5 h-5 transition-transform duration-300 ${isFlipped ? 'rotate-180' : ''}`} />
                            Flip
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={isLastCard}
                            className="w-16 h-16 rounded-2xl bg-claude-surface border border-claude-border flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform"
                        >
                            <ChevronRight className="w-7 h-7" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
