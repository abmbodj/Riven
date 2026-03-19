import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RefreshCw, X, Trophy, Target, CheckCircle2, XCircle, List, Keyboard, Send } from 'lucide-react';
import { api } from '../api';
import { UserRating } from '../utils/fsrs';
import { useStreakContext } from '../hooks/useStreakContext';
import useHaptics from '../hooks/useHaptics';
import OutOfHeartsModal from '../components/ui/OutOfHeartsModal';
import StudyHeartsDisplay from '../components/ui/StudyHeartsDisplay';


export default function TestMode() {
    const { id } = useParams();
    const [deck, setDeck] = useState(null);
    const [cards, setCards] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [testMode, setTestMode] = useState(null); // 'multiple' or 'typed'
    const [typedAnswer, setTypedAnswer] = useState('');
    const [heartsStatus, setHeartsStatus] = useState(null);
    const [showOutOfHearts, setShowOutOfHearts] = useState(false);
    const [heartsLoading, setHeartsLoading] = useState(true);

    const inputRef = useRef(null);
    const pendingTimers = useRef(new Set());
    const { incrementStreak } = useStreakContext();
    const haptics = useHaptics();

    useEffect(() => {
        return () => {
            pendingTimers.current.forEach(id => clearTimeout(id));
            pendingTimers.current.clear();
        };
    }, []);

    const safeTimeout = useCallback((fn, ms) => {
        const id = setTimeout(() => {
            pendingTimers.current.delete(id);
            fn();
        }, ms);
        pendingTimers.current.add(id);
        return id;
    }, []);

    const generateTest = useCallback((deckCards, mode) => {
        const minCards = mode === 'multiple' ? 4 : 1;
        if (deckCards.length < minCards) {
            setQuestions([]);
            return;
        }

        const shuffled = [...deckCards].sort(() => 0.5 - Math.random());
        const newQuestions = shuffled.map(card => {
            if (mode === 'multiple') {
                const distractors = deckCards
                    .filter(c => c.id !== card.id)
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 3)
                    .map(c => c.back);

                const options = [...distractors, card.back].sort(() => 0.5 - Math.random());

                return {
                    card,
                    options,
                    correctAnswer: card.back
                };
            } else {
                return {
                    card,
                    correctAnswer: card.back
                };
            }
        });

        setQuestions(newQuestions);
        setCurrentQIndex(0);
        setScore(0);
        setShowResult(false);
        setTypedAnswer('');
    }, []);

    useEffect(() => {
        Promise.all([
            api.getDeck(id),
            api.getHeartsStatus()
        ]).then(([deckData, heartsData]) => {
            setDeck(deckData);
            setCards(deckData.cards);
            setHeartsStatus(heartsData);
            if (!heartsData.isUnlimited && heartsData.hearts <= 0) {
                setShowOutOfHearts(true);
            }
            setLoading(false);
            setHeartsLoading(false);
        }).catch(() => {
            setLoading(false);
            setHeartsLoading(false);
        });
    }, [id]);

    // Focus input when moving to next question in typed mode
    useEffect(() => {
        if (testMode === 'typed' && inputRef.current && !showFeedback) {
            inputRef.current.focus();
        }
    }, [currentQIndex, testMode, showFeedback]);

    const startTest = (mode) => {
        setTestMode(mode);
        generateTest(cards, mode);
    };

    const handleMultipleAnswer = async (selectedOption) => {
        if (showFeedback) return;

        setSelectedAnswer(selectedOption);
        setShowFeedback(true);

        const currentQ = questions[currentQIndex];
        const isCorrect = selectedOption === currentQ.correctAnswer;
        if (isCorrect) {
            haptics.success();
            setScore(s => s + 1);
        } else {
            haptics.error();
            // Deduct heart
            if (heartsStatus && !heartsStatus.isUnlimited) {
                try {
                    const newStatus = await api.decrementHeart();
                    setHeartsStatus(newStatus);
                    if (newStatus.hearts <= 0) {
                        safeTimeout(() => setShowOutOfHearts(true), 1200);
                    }
                } catch (err) {
                    console.error("Failed to decrement heart", err);
                }
            }
        }

        // Update SRS scheduling
        api.reviewCard(currentQ.card.id, isCorrect ? UserRating.Easy : UserRating.Forgot).catch(() => {});

        safeTimeout(() => {
            setSelectedAnswer(null);
            setShowFeedback(false);

            if (currentQIndex < questions.length - 1) {
                setCurrentQIndex(i => i + 1);
            } else {
                setShowResult(true);
                incrementStreak();
            }
        }, 1200);
    };

    const normalizeAnswer = (answer) => {
        return answer
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')  // normalize whitespace
            .replace(/[.,!?;:'"]/g, ''); // remove punctuation
    };

    const handleTypedSubmit = async (e) => {
        e?.preventDefault();
        if (showFeedback || !typedAnswer.trim()) return;

        setShowFeedback(true);

        const currentQ = questions[currentQIndex];
        const correctAnswer = currentQ.correctAnswer;
        const isCorrect = normalizeAnswer(typedAnswer) === normalizeAnswer(correctAnswer);

        if (isCorrect) {
            haptics.success();
            setScore(s => s + 1);
        } else {
            haptics.error();
            // Deduct heart
            if (heartsStatus && !heartsStatus.isUnlimited) {
                try {
                    const newStatus = await api.decrementHeart();
                    setHeartsStatus(newStatus);
                    if (newStatus.hearts <= 0) {
                        safeTimeout(() => setShowOutOfHearts(true), 2000);
                    }
                } catch (err) {
                    console.error("Failed to decrement heart", err);
                }
            }
        }

        // Update SRS scheduling
        api.reviewCard(currentQ.card.id, isCorrect ? UserRating.Easy : UserRating.Forgot).catch(() => {});

        safeTimeout(() => {
            setShowFeedback(false);
            setTypedAnswer('');

            if (currentQIndex < questions.length - 1) {
                setCurrentQIndex(i => i + 1);
            } else {
                setShowResult(true);
                incrementStreak();
            }
        }, 2000);
    };

    if (loading || heartsLoading) return (
        <div className="fullscreen-page items-center justify-center">
            <div className="animate-pulse text-claude-secondary">Loading...</div>
        </div>
    );

    if (cards.length === 0) {
        return (
            <div className="fullscreen-page items-center justify-center p-6">
                <div className="text-6xl mb-4">🎯</div>
                <h2 className="text-xl font-display font-bold mb-2 text-center">No Cards Yet</h2>
                <p className="text-claude-secondary text-center mb-6">Add some cards to take a quiz</p>
                <Link to={`/deck/${id}`} className="claude-button-primary px-6 py-3">Back to Deck</Link>
            </div>
        );
    }

    const currentModeLabel = testMode === 'multiple' ? 'Multiple choice' : testMode === 'typed' ? 'Typed recall' : 'Assessment setup';
    const answeredCount = showResult ? questions.length : currentQIndex + (showFeedback ? 1 : 0);
    const accuracyRate = answeredCount > 0 ? Math.round((score / answeredCount) * 100) : 0;
    const questionsRemaining = Math.max(questions.length - currentQIndex - 1, 0);

    // Mode selection screen
    if (!testMode) {
        return (
            <div className="fullscreen-page">
                <div className="flex items-center px-4 h-14 shrink-0">
                    <Link to={`/deck/${id}`} className="touch-target -ml-2 text-claude-secondary tap-action">
                        <X className="w-6 h-6" />
                    </Link>
                    <h1 className="flex-1 text-center font-display font-bold">Choose Quiz Mode</h1>
                    <StudyHeartsDisplay heartsStatus={heartsStatus} />
                </div>

                <div className="flex-1 p-6">
                    <div className="mx-auto w-full max-w-5xl space-y-6">
                        <div className="rounded-[28px] border border-claude-border bg-[linear-gradient(145deg,rgba(22,39,45,0.96),rgba(17,29,35,0.96))] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-claude-secondary">Assessment Workbench</p>
                                    <h1 className="font-serif text-3xl font-bold italic text-claude-text">
                                        Pick how you want to pressure-test this deck.
                                    </h1>
                                    <p className="max-w-2xl text-sm text-claude-secondary">
                                        {deck?.description || 'Switch between recognition and recall without leaving the deck flow.'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono text-claude-secondary sm:min-w-[280px]">
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-3">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Deck</div>
                                        <div className="mt-1 text-sm text-claude-text">{deck?.title || 'Current'}</div>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-3">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Cards</div>
                                        <div className="mt-1 text-sm text-claude-text">{cards.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-3">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Modes</div>
                                        <div className="mt-1 text-sm text-claude-text">2</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                        <button
                            onClick={() => startTest('multiple')}
                            disabled={cards.length < 4}
                            className={`w-full p-6 rounded-[26px] border text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] ${cards.length < 4
                                ? 'border-claude-border/50 opacity-50'
                                : 'glass-panel active:scale-[0.98] hover:border-blue-400/30 hover:bg-blue-500/[0.05]'
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                                    <List className="w-6 h-6 text-blue-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-display font-bold text-lg mb-1">Multiple Choice</h3>
                                    <p className="text-sm text-claude-secondary">
                                        Choose the correct answer from 4 options
                                    </p>
                                    <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.18em] text-blue-400/80">
                                        Fast recognition check
                                    </p>
                                    {cards.length < 4 && (
                                        <p className="text-xs text-orange-500 mt-2">Requires at least 4 cards</p>
                                    )}
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => startTest('typed')}
                            className="w-full p-6 rounded-[26px] glass-panel active:scale-[0.98] text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:border-green-400/30 hover:bg-green-500/[0.05]"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                                    <Keyboard className="w-6 h-6 text-green-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-display font-bold text-lg mb-1">Type Answer</h3>
                                    <p className="text-sm text-claude-secondary">
                                        Type the exact answer to test your recall
                                    </p>
                                    <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.18em] text-green-400/80">
                                        Harder memory check
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>

                        <p className="text-xs text-claude-secondary text-center">
                            {cards.length} cards in this deck
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (showResult) {
        const percentage = Math.round((score / questions.length) * 100);
        return (
            <div className="fullscreen-page px-4 py-6">
                <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center">
                    <div className="w-full rounded-[30px] border border-claude-border bg-[linear-gradient(145deg,rgba(22,39,45,0.96),rgba(17,29,35,0.96))] p-8 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
                        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${percentage >= 70 ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                                {percentage >= 70 ? (
                                    <Trophy className="w-10 h-10 text-green-500" />
                                ) : (
                                    <Target className="w-10 h-10 text-orange-500" />
                                )}
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-claude-secondary">Assessment complete</p>
                                <h2 className="text-3xl font-display font-bold">Complete!</h2>
                                <p className="text-claude-secondary text-lg">
                                    {percentage}% correct in {currentModeLabel.toLowerCase()} for {deck?.title || 'this deck'}.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            <div className="glass-panel rounded-2xl px-6 py-4 text-center">
                                <span className="block text-2xl font-bold text-green-500">{score}</span>
                                <span className="text-xs text-claude-secondary uppercase tracking-wider">Correct</span>
                            </div>
                            <div className="glass-panel rounded-2xl px-6 py-4 text-center">
                                <span className="block text-2xl font-bold text-red-500">{questions.length - score}</span>
                                <span className="text-xs text-claude-secondary uppercase tracking-wider">Wrong</span>
                            </div>
                            <div className="glass-panel rounded-2xl px-6 py-4 text-center">
                                <span className="block text-2xl font-bold text-claude-accent">{percentage}%</span>
                                <span className="text-xs text-claude-secondary uppercase tracking-wider">Accuracy</span>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <button
                                onClick={() => generateTest(cards, testMode)}
                                className="claude-button-primary py-4 px-6 flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-5 h-5" /> Try Again
                            </button>
                            <button
                                onClick={() => setTestMode(null)}
                                className="claude-button-secondary py-4 px-6 text-center"
                            >
                                Change Mode
                            </button>
                            <Link to={`/deck/${id}`} className="py-4 px-6 text-center text-claude-secondary font-medium">
                                Back to Deck
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentQIndex];
    const progress = ((currentQIndex) / questions.length) * 100;
    const sessionPhaseLabel = showFeedback ? 'Review answer' : 'Answer now';
    const sessionCue = testMode === 'typed'
        ? (showFeedback ? 'Check the response, then prepare for the next prompt.' : 'Type the answer from memory and submit when ready.')
        : (showFeedback ? 'Review the result before the next question appears.' : 'Pick the strongest answer choice as quickly as you can.');

    // Typed answer mode
    if (testMode === 'typed') {
        const isCorrect = showFeedback && normalizeAnswer(typedAnswer) === normalizeAnswer(currentQ.correctAnswer);
        const isWrong = showFeedback && !isCorrect;

        return (
            <div className="fullscreen-page">
                {/* Header */}
                <div className="flex items-center px-4 h-14 shrink-0">
                    <Link to={`/deck/${id}`} className="touch-target -ml-2 text-claude-secondary tap-action">
                        <X className="w-6 h-6" />
                    </Link>
                    <div className="flex-1 mx-4">
                        <div className="h-1.5 bg-claude-border rounded-full overflow-hidden">
                            <div
                                className="h-full bg-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-center text-xs text-claude-secondary mt-1">Question {currentQIndex + 1} of {questions.length}</p>
                    </div>
                    <StudyHeartsDisplay heartsStatus={heartsStatus} />
                </div>

                <div className="flex-1 px-4 pb-8">
                    <div className="mx-auto grid h-full w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="space-y-4 min-w-0">
                            <div className="rounded-[24px] border border-claude-border bg-[linear-gradient(135deg,rgba(18,38,44,0.94),rgba(36,63,57,0.92))] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.28em] text-claude-secondary/80">
                                            <span>{currentModeLabel}</span>
                                            {deck?.title ? (
                                                <span className="rounded-full border border-claude-border px-2 py-1 tracking-[0.18em] text-claude-secondary">{deck.title}</span>
                                            ) : null}
                                        </div>
                                        <p className="font-display text-lg font-semibold text-claude-text">
                                            Type the answer before the timerless pressure breaks your flow.
                                        </p>
                                        <p className="text-sm text-claude-secondary">{sessionCue}</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono text-claude-secondary sm:min-w-[290px]">
                                        <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-2">
                                            <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Score</div>
                                            <div className="mt-1 text-sm text-claude-text">{score}</div>
                                        </div>
                                        <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-2">
                                            <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Remaining</div>
                                            <div className="mt-1 text-sm text-claude-text">{questionsRemaining}</div>
                                        </div>
                                        <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-2">
                                            <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Accuracy</div>
                                            <div className="mt-1 text-sm text-claude-text">{accuracyRate}%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel rounded-2xl p-6">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-3 block">What is:</span>
                                {currentQ.card.front_image && (
                                    <img
                                        src={currentQ.card.front_image}
                                        alt="Question"
                                        className="max-h-40 max-w-full object-contain rounded-xl mb-4 mx-auto"
                                    />
                                )}
                                <h3 className={`font-display font-bold ${currentQ.card.front_image ? 'text-xl' : 'text-2xl'}`}>{currentQ.card.front}</h3>
                            </div>

                            <form onSubmit={handleTypedSubmit} className="space-y-4">
                                <div className={`relative rounded-2xl border transition-[transform,opacity,color,background-color,border-color,box-shadow] ${isCorrect ? 'border-green-500 bg-green-500/10' :
                                    isWrong ? 'border-red-500 bg-red-500/10' :
                                        'glass-panel'
                                    }`}>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={typedAnswer}
                                        onChange={(e) => setTypedAnswer(e.target.value)}
                                        placeholder="Type your answer..."
                                        disabled={showFeedback}
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        className={`w-full px-4 py-4 pr-14 bg-transparent rounded-2xl outline-none text-lg ${isCorrect ? 'text-green-500' :
                                            isWrong ? 'text-red-500' : ''
                                            }`}
                                    />
                                    <button
                                        type="submit"
                                        disabled={showFeedback || !typedAnswer.trim()}
                                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-[transform,opacity,color,background-color,border-color,box-shadow] ${typedAnswer.trim() && !showFeedback
                                            ? 'bg-claude-accent text-white'
                                            : 'bg-claude-border/50 text-claude-secondary'
                                            }`}
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>

                                {showFeedback && (
                                    <div className={`p-4 rounded-2xl ${isCorrect ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                        <div className="flex items-center gap-3 mb-2">
                                            {isCorrect ? (
                                                <>
                                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                                    <span className="font-bold text-green-500">Correct!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="w-6 h-6 text-red-500" />
                                                    <span className="font-bold text-red-500">Incorrect</span>
                                                </>
                                            )}
                                        </div>
                                        {isWrong && (
                                            <div className="text-sm">
                                                <span className="text-claude-secondary">Correct answer: </span>
                                                <span className="font-medium text-green-500">{currentQ.correctAnswer}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </form>

                            <p className="text-xs text-claude-secondary text-center">
                                Press Enter or tap send to submit
                            </p>
                        </div>

                        <aside className="hidden xl:block">
                            <div className="sticky top-6 space-y-4">
                                <div className="glass-panel rounded-[28px] p-5">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-claude-secondary">Test Focus</p>
                                    <div className="mt-4 space-y-3">
                                        <div className="rounded-2xl border border-claude-border bg-claude-bg/15 px-4 py-3">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">Phase</div>
                                            <div className="mt-2 font-serif text-lg font-bold text-claude-text">{sessionPhaseLabel}</div>
                                        </div>
                                        <div className="rounded-2xl border border-claude-border bg-claude-bg/15 px-4 py-3">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">Deck</div>
                                            <div className="mt-2 font-serif text-lg font-bold text-claude-text">{deck?.title || 'Current deck'}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="glass-panel rounded-[28px] p-5">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-claude-secondary">Typed Controls</p>
                                    <div className="mt-4 rounded-2xl border border-claude-border bg-claude-bg/15 px-4 py-4 text-sm text-claude-secondary">
                                        Submit with <span className="font-mono text-claude-text">Enter</span> or the send button. Wrong answers reveal the correct response before the next prompt.
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        );
    }

    // Multiple choice mode
    return (
        <div className="fullscreen-page">
            {/* Header */}
            <div className="flex items-center px-4 h-14 shrink-0">
                <Link to={`/deck/${id}`} className="touch-target -ml-2 text-claude-secondary tap-action">
                    <X className="w-6 h-6" />
                </Link>
                <div className="flex-1 mx-4">
                    <div className="h-1.5 bg-claude-border rounded-full overflow-hidden">
                        <div
                            className="h-full bg-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-center text-xs text-claude-secondary mt-1">Question {currentQIndex + 1} of {questions.length}</p>
                </div>
                <StudyHeartsDisplay heartsStatus={heartsStatus} />
            </div>

            <div className="flex-1 px-4 pb-8">
                <div className="mx-auto grid h-full w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4 min-w-0">
                        <div className="rounded-[24px] border border-claude-border bg-[linear-gradient(135deg,rgba(18,38,44,0.94),rgba(36,63,57,0.92))] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.28em] text-claude-secondary/80">
                                        <span>{currentModeLabel}</span>
                                        {deck?.title ? (
                                            <span className="rounded-full border border-claude-border px-2 py-1 tracking-[0.18em] text-claude-secondary">{deck.title}</span>
                                        ) : null}
                                    </div>
                                    <p className="font-display text-lg font-semibold text-claude-text">
                                        Read the prompt, commit to an answer, and keep moving.
                                    </p>
                                    <p className="text-sm text-claude-secondary">{sessionCue}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono text-claude-secondary sm:min-w-[290px]">
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-2">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Score</div>
                                        <div className="mt-1 text-sm text-claude-text">{score}</div>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-2">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Remaining</div>
                                        <div className="mt-1 text-sm text-claude-text">{questionsRemaining}</div>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/40 px-3 py-2">
                                        <div className="text-[9px] uppercase tracking-[0.24em] text-claude-secondary/50">Accuracy</div>
                                        <div className="mt-1 text-sm text-claude-text">{accuracyRate}%</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel rounded-2xl p-6">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-3 block">What is:</span>
                            {currentQ.card.front_image && (
                                <img
                                    src={currentQ.card.front_image}
                                    alt="Question"
                                    className="max-h-40 max-w-full object-contain rounded-xl mb-4 mx-auto"
                                />
                            )}
                            <h3 className={`font-display font-bold ${currentQ.card.front_image ? 'text-xl' : 'text-2xl'}`}>{currentQ.card.front}</h3>
                        </div>

                        <div className="space-y-3 overflow-y-auto">
                            {currentQ.options.map((option, idx) => {
                                const isSelected = selectedAnswer === option;
                                const isCorrect = option === currentQ.correctAnswer;
                                const showCorrect = showFeedback && isCorrect;
                                const showWrong = showFeedback && isSelected && !isCorrect;

                                return (
                                    <button
                                        key={option}
                                        onClick={() => handleMultipleAnswer(option)}
                                        disabled={showFeedback}
                                        className={`w-full text-left p-4 rounded-2xl border transition-[transform,opacity,color,background-color,border-color,box-shadow] ${showCorrect
                                            ? 'border-green-500 bg-green-500/10'
                                            : showWrong
                                                ? 'border-red-500 bg-red-500/10'
                                                : 'glass-panel active:scale-[0.98]'
                                            } ${showFeedback && !isSelected && !isCorrect ? 'opacity-50' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${showCorrect ? 'border-green-500 bg-green-500 text-white' :
                                                showWrong ? 'border-red-500 bg-red-500 text-white' :
                                                    'border-claude-border'
                                                }`}>
                                                {showCorrect ? <CheckCircle2 className="w-5 h-5" /> :
                                                    showWrong ? <XCircle className="w-5 h-5" /> :
                                                        String.fromCharCode(65 + idx)}
                                            </div>
                                            <span className={`font-medium flex-1 ${showCorrect ? 'text-green-500' : showWrong ? 'text-red-500' : ''
                                                }`}>{option}</span>
                                            {showCorrect && <span className="text-xs text-green-500 font-semibold">Correct!</span>}
                                            {showWrong && <span className="text-xs text-red-500 font-semibold">Wrong</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="hidden xl:block">
                        <div className="sticky top-6 space-y-4">
                            <div className="glass-panel rounded-[28px] p-5">
                                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-claude-secondary">Test Focus</p>
                                <div className="mt-4 space-y-3">
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/15 px-4 py-3">
                                        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">Phase</div>
                                        <div className="mt-2 font-serif text-lg font-bold text-claude-text">{sessionPhaseLabel}</div>
                                    </div>
                                    <div className="rounded-2xl border border-claude-border bg-claude-bg/15 px-4 py-3">
                                        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">Deck</div>
                                        <div className="mt-2 font-serif text-lg font-bold text-claude-text">{deck?.title || 'Current deck'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel rounded-[28px] p-5">
                                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-claude-secondary">Answer Pattern</p>
                                <div className="mt-4 rounded-2xl border border-claude-border bg-claude-bg/15 px-4 py-4 text-sm text-claude-secondary">
                                    One answer is right. Wrong picks cost a heart when hearts are enabled, so move quickly but deliberately.
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
                    window.location.href = `/deck/${id}/study`;
                }
            }} onEnd={() => {
                setShowOutOfHearts(false);
                window.location.href = `/deck/${id}`;
            }} />
        </div>
    );
}
