import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCw, X, Info, Shuffle } from 'lucide-react';
import { api } from '../api';

export default function StudyMode() {
    const { id } = useParams();
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isShuffled, setIsShuffled] = useState(false);

    useEffect(() => {
        api.getDeck(id).then(data => {
            setCards(data.cards);
            setLoading(false);
        });
    }, [id]);

    const handleNext = useCallback(() => {
        if (currentIndex < cards.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(c => c + 1), 150);
        }
    }, [currentIndex, cards.length]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(c => c - 1), 150);
        }
    }, [currentIndex]);

    const handleFlip = useCallback(() => setIsFlipped(f => !f), []);

    const handleShuffle = () => {
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        setCards(shuffled);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsShuffled(true);
    };

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

    if (loading) return <div className="text-center py-20 animate-pulse text-claude-secondary">Preparing your session...</div>;
    if (cards.length === 0) return (
        <div className="text-center py-20">
            <h2 className="text-2xl font-display font-bold mb-4">No cards found</h2>
            <Link to={`/deck/${id}`} className="claude-button-primary">Return to Deck</Link>
        </div>
    );

    const currentCard = cards[currentIndex];
    const progress = ((currentIndex + 1) / cards.length) * 100;

    return (
        <div className="max-w-3xl mx-auto h-[calc(100vh-160px)] flex flex-col animate-in fade-in duration-700">
            <div className="flex justify-between items-center mb-8">
                <Link to={`/deck/${id}`} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-claude-border shadow-sm group">
                    <X className="w-6 h-6 text-claude-secondary group-hover:text-claude-text" />
                </Link>
                <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-claude-secondary">Session Progress</span>
                    <div className="w-48 h-1.5 bg-claude-border rounded-full overflow-hidden">
                        <div
                            className="h-full bg-claude-text transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <span className="text-[10px] font-bold text-claude-secondary mt-1">{currentIndex + 1} of {cards.length}</span>
                </div>
                <button
                    onClick={handleShuffle}
                    className={`p-2 rounded-full transition-colors border shadow-sm ${isShuffled ? 'bg-claude-text text-white border-claude-text' : 'hover:bg-white border-transparent hover:border-claude-border'}`}
                    title="Shuffle cards"
                >
                    <Shuffle className={`w-6 h-6 ${isShuffled ? '' : 'text-claude-secondary'}`} />
                </button>
            </div>

            <div className="flex-1 flex flex-col justify-center perspective-1000">
                <div
                    className={`relative w-full aspect-[4/3] sm:aspect-[3/2] cursor-pointer transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                    onClick={handleFlip}
                >
                    {/* Front */}
                    <div className="absolute inset-0 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02)] border border-claude-border flex flex-col items-center justify-center p-12 backface-hidden">
                        <div className="absolute top-8 left-8 flex items-center gap-2 text-claude-border">
                            <Info className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Question</span>
                        </div>
                        <div className="text-center max-w-lg">
                            <p className="text-3xl sm:text-4xl font-display font-semibold text-claude-text leading-tight">{currentCard.front}</p>
                        </div>
                        <div className="absolute bottom-8 text-claude-secondary text-xs font-medium animate-bounce">
                            Click to flip
                        </div>
                    </div>

                    {/* Back */}
                    <div className="absolute inset-0 bg-claude-text rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center p-12 backface-hidden rotate-y-180">
                        <div className="absolute top-8 left-8 flex items-center gap-2 text-white/30">
                            <Info className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Answer</span>
                        </div>
                        <div className="text-center max-w-lg">
                            <p className="text-3xl sm:text-4xl font-display font-semibold text-white leading-tight">{currentCard.back}</p>
                        </div>
                        <div className="absolute bottom-8 text-white/40 text-xs font-medium">
                            Click to flip back
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-12 flex flex-col items-center gap-4">
                <div className="flex items-center justify-center gap-6">
                    <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="w-14 h-14 rounded-2xl bg-white border border-claude-border shadow-sm flex items-center justify-center text-claude-secondary disabled:opacity-30 hover:border-claude-text hover:text-claude-text transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    <button
                        onClick={handleFlip}
                        className="h-14 px-8 rounded-2xl bg-white border border-claude-border shadow-sm flex items-center gap-3 font-display font-bold text-claude-text hover:border-claude-text transition-all active:scale-95"
                    >
                        <RotateCw className={`w-5 h-5 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} />
                        Reveal
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={currentIndex === cards.length - 1}
                        className="w-14 h-14 rounded-2xl bg-white border border-claude-border shadow-sm flex items-center justify-center text-claude-secondary disabled:opacity-30 hover:border-claude-text hover:text-claude-text transition-all active:scale-95"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
                <p className="text-[10px] text-claude-secondary font-medium uppercase tracking-widest">
                    Use ← → arrows to navigate • Space to flip
                </p>
            </div>
        </div>
    );
}
