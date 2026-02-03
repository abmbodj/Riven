import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RefreshCw, X, Trophy, Target, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api';
import { useStreakContext } from '../hooks/useStreakContext';
import useHaptics from '../hooks/useHaptics';

export default function TestMode() {
    const { id } = useParams();
    const [cards, setCards] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const { incrementStreak } = useStreakContext();
    const haptics = useHaptics();

    const generateTest = useCallback((deckCards) => {
        if (deckCards.length < 4) {
            setQuestions([]);
            return;
        }

        const shuffled = [...deckCards].sort(() => 0.5 - Math.random());
        const newQuestions = shuffled.map(card => {
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
        });

        setQuestions(newQuestions);
        setCurrentQIndex(0);
        setScore(0);
        setShowResult(false);
    }, []);

    useEffect(() => {
        api.getDeck(id).then(data => {
            setCards(data.cards);
            generateTest(data.cards);
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });
    }, [id, generateTest]);

    const handleAnswer = (selectedOption) => {
        if (showFeedback) return; // Prevent double-tap
        
        setSelectedAnswer(selectedOption);
        setShowFeedback(true);
        
        const isCorrect = selectedOption === questions[currentQIndex].correctAnswer;
        if (isCorrect) {
            haptics.success();
            setScore(s => s + 1);
        } else {
            haptics.error();
        }

        // Show feedback for 1.2 seconds then move to next
        setTimeout(() => {
            setSelectedAnswer(null);
            setShowFeedback(false);
            
            if (currentQIndex < questions.length - 1) {
                setCurrentQIndex(i => i + 1);
            } else {
                setShowResult(true);
                // Increment streak when completing a test
                incrementStreak();
            }
        }, 1200);
    };

    if (loading) return (
        <div className="fullscreen-page items-center justify-center">
            <div className="animate-pulse text-claude-secondary">Loading...</div>
        </div>
    );

    if (cards.length < 4) {
        return (
            <div className="fullscreen-page items-center justify-center p-6">
                <div className="text-6xl mb-4">🎯</div>
                <h2 className="text-xl font-display font-bold mb-2 text-center">Need More Cards</h2>
                <p className="text-claude-secondary text-center mb-6">Add at least 4 cards to take a quiz</p>
                <Link to={`/deck/${id}`} className="claude-button-primary px-6 py-3">Back to Deck</Link>
            </div>
        );
    }

    if (showResult) {
        const percentage = Math.round((score / questions.length) * 100);
        return (
            <div className="fullscreen-page items-center justify-center px-4">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 ${percentage >= 70 ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                    {percentage >= 70 ? (
                        <Trophy className="w-10 h-10 text-green-500" />
                    ) : (
                        <Target className="w-10 h-10 text-orange-500" />
                    )}
                </div>

                <h2 className="text-3xl font-display font-bold mb-2">Complete!</h2>
                <p className="text-claude-secondary text-lg mb-8">{percentage}% correct</p>

                <div className="flex gap-4 mb-8">
                    <div className="bg-claude-surface border border-claude-border rounded-2xl px-6 py-4 text-center">
                        <span className="block text-2xl font-bold text-green-500">{score}</span>
                        <span className="text-xs text-claude-secondary uppercase tracking-wider">Correct</span>
                    </div>
                    <div className="bg-claude-surface border border-claude-border rounded-2xl px-6 py-4 text-center">
                        <span className="block text-2xl font-bold text-red-500">{questions.length - score}</span>
                        <span className="text-xs text-claude-secondary uppercase tracking-wider">Wrong</span>
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={() => generateTest(cards)}
                        className="claude-button-primary py-4 flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-5 h-5" /> Try Again
                    </button>
                    <Link to={`/deck/${id}`} className="claude-button-secondary py-4 text-center">
                        Back to Deck
                    </Link>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentQIndex];
    const progress = ((currentQIndex) / questions.length) * 100;

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
                            className="h-full bg-claude-accent transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-center text-xs text-claude-secondary mt-1">Question {currentQIndex + 1} of {questions.length}</p>
                </div>
                <div className="w-10" />
            </div>

            {/* Question */}
            <div className="px-4 py-6">
                <div className="bg-claude-surface border border-claude-border rounded-2xl p-6">
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
            </div>

            {/* Options */}
            <div className="flex-1 px-4 space-y-3 overflow-y-auto pb-8">
                {currentQ.options.map((option, idx) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === currentQ.correctAnswer;
                    const showCorrect = showFeedback && isCorrect;
                    const showWrong = showFeedback && isSelected && !isCorrect;
                    
                    return (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(option)}
                            disabled={showFeedback}
                            className={`w-full text-left p-4 rounded-2xl border transition-all ${
                                showCorrect 
                                    ? 'border-green-500 bg-green-500/10' 
                                    : showWrong 
                                        ? 'border-red-500 bg-red-500/10' 
                                        : 'border-claude-border bg-claude-surface active:scale-[0.98] active:bg-claude-bg'
                            } ${showFeedback && !isSelected && !isCorrect ? 'opacity-50' : ''}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                                    showCorrect ? 'border-green-500 bg-green-500 text-white' : 
                                    showWrong ? 'border-red-500 bg-red-500 text-white' : 
                                    'border-claude-border'
                                }`}>
                                    {showCorrect ? <CheckCircle2 className="w-5 h-5" /> : 
                                     showWrong ? <XCircle className="w-5 h-5" /> : 
                                     String.fromCharCode(65 + idx)}
                                </div>
                                <span className={`font-medium flex-1 ${
                                    showCorrect ? 'text-green-500' : showWrong ? 'text-red-500' : ''
                                }`}>{option}</span>
                                {showCorrect && <span className="text-xs text-green-500 font-semibold">Correct!</span>}
                                {showWrong && <span className="text-xs text-red-500 font-semibold">Wrong</span>}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
