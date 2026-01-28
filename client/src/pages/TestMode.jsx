import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, RefreshCw, ArrowLeft, Trophy, Target } from 'lucide-react';
import { api } from '../api';

export default function TestMode() {
    const { id } = useParams();
    const [cards, setCards] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getDeck(id).then(data => {
            setCards(data.cards);
            generateTest(data.cards);
            setLoading(false);
        });
    }, [id]);

    const generateTest = (deckCards) => {
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
    };

    const handleAnswer = (selectedOption) => {
        if (selectedOption === questions[currentQIndex].correctAnswer) {
            setScore(s => s + 1);
        }

        if (currentQIndex < questions.length - 1) {
            setCurrentQIndex(i => i + 1);
        } else {
            setShowResult(true);
        }
    };

    if (loading) return <div className="text-center py-20 animate-pulse text-claude-secondary">Generating your test...</div>;

    if (cards.length < 4) {
        return (
            <div className="text-center py-20 bg-white border border-claude-border rounded-3xl shadow-sm max-w-lg mx-auto">
                <div className="w-16 h-16 bg-claude-bg rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Target className="w-8 h-8 text-claude-secondary" />
                </div>
                <h2 className="text-2xl font-display font-bold mb-3">More cards needed</h2>
                <p className="text-claude-secondary mb-8 leading-relaxed px-8">You need at least 4 cards in this deck to generate a multiple-choice practice test.</p>
                <Link to={`/deck/${id}`} className="claude-button-primary">Go back to Deck</Link>
            </div>
        );
    }

    if (showResult) {
        const percentage = Math.round((score / questions.length) * 100);
        return (
            <div className="max-w-xl mx-auto text-center py-12 animate-in zoom-in-95 duration-500">
                <div className="claude-card p-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-claude-bg">
                        <div
                            className={`h-full transition-all duration-1000 ${percentage >= 70 ? 'bg-green-500' : 'bg-orange-500'}`}
                            style={{ width: `${percentage}%` }}
                        ></div>
                    </div>

                    <div className={`inline-flex p-6 rounded-3xl mb-8 ${percentage >= 70 ? 'bg-green-50' : 'bg-orange-50'}`}>
                        {percentage >= 70 ? (
                            <Trophy className="w-16 h-16 text-green-600" />
                        ) : (
                            <Target className="w-16 h-16 text-orange-600" />
                        )}
                    </div>

                    <h2 className="text-4xl font-display font-bold mb-2">Test Complete</h2>
                    <p className="text-claude-secondary text-lg mb-8">You've mastered {percentage}% of the material in this session.</p>

                    <div className="grid grid-cols-2 gap-4 mb-10">
                        <div className="bg-claude-bg p-4 rounded-2xl">
                            <span className="block text-2xl font-display font-bold text-claude-text">{score}</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-claude-secondary">Correct</span>
                        </div>
                        <div className="bg-claude-bg p-4 rounded-2xl">
                            <span className="block text-2xl font-display font-bold text-claude-text">{questions.length - score}</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-claude-secondary">Incorrect</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to={`/deck/${id}`} className="claude-button-secondary py-3 px-8">
                            Back to Deck
                        </Link>
                        <button
                            onClick={() => generateTest(cards)}
                            className="claude-button-primary py-3 px-8 flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentQIndex];
    const progress = ((currentQIndex) / questions.length) * 100;

    return (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-700">
            <div className="flex justify-between items-center mb-10">
                <Link to={`/deck/${id}`} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-claude-border shadow-sm">
                    <ArrowLeft className="w-5 h-5 text-claude-secondary" />
                </Link>
                <div className="flex-1 mx-8">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-2">
                        <span>Question {currentQIndex + 1}</span>
                        <span>{Math.round(progress)}% Complete</span>
                    </div>
                    <div className="w-full h-1.5 bg-claude-border rounded-full overflow-hidden">
                        <div
                            className="h-full bg-claude-text transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
                <div className="w-9"></div>
            </div>

            <div className="claude-card p-10 mb-8 border-b-4 border-b-claude-text/5">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-4">Identify the correct answer:</span>
                <h3 className="text-3xl font-display font-bold text-claude-text leading-tight">{currentQ.card.front}</h3>
            </div>

            <div className="grid gap-4">
                {currentQ.options.map((option, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleAnswer(option)}
                        className="w-full text-left p-5 rounded-2xl border border-claude-border bg-white hover:border-claude-text hover:bg-claude-bg transition-all duration-200 group flex items-center justify-between"
                    >
                        <span className="font-medium text-claude-text text-lg">{option}</span>
                        <div className="w-6 h-6 rounded-full border border-claude-border group-hover:border-claude-text transition-colors flex items-center justify-center text-[10px] font-bold">
                            {String.fromCharCode(65 + idx)}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
