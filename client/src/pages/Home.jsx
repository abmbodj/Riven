import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../api';

export default function Home() {
    const [decks, setDecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [showOnboarding, setShowOnboarding] = useState(false);

    const loadDecks = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const data = await api.getDecks();
            setDecks(data);
            setError(null);
            // Show onboarding if first time (no decks)
            if (data.length === 0 && !localStorage.getItem('riven_onboarded')) {
                setShowOnboarding(true);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadDecks();
    }, [loadDecks]);

    const handleRefresh = () => {
        loadDecks(true);
    };

    const dismissOnboarding = () => {
        localStorage.setItem('riven_onboarded', 'true');
        setShowOnboarding(false);
    };

    if (loading) return (
        <div className="space-y-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="claude-card p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 bg-claude-border rounded-xl" />
                    <div className="flex-1">
                        <div className="h-4 bg-claude-border rounded w-3/4 mb-2" />
                        <div className="h-3 bg-claude-border rounded w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );

    if (error) return (
        <div className="text-center py-10">
            <div className="bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 p-6">
                <p className="font-medium mb-4">Couldn't load your decks</p>
                <button onClick={handleRefresh} className="claude-button-primary bg-red-500 text-white">
                    Try Again
                </button>
            </div>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-500">
            {/* Onboarding modal */}
            {showOnboarding && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-claude-surface w-full max-w-sm rounded-3xl p-8 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-claude-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-display font-bold mb-3">Welcome to Riven!</h2>
                        <p className="text-claude-secondary mb-6 leading-relaxed">
                            Create flashcard decks to master any subject. Study with flip cards or test yourself with quizzes.
                        </p>
                        <div className="space-y-3">
                            <Link 
                                to="/create" 
                                onClick={dismissOnboarding}
                                className="claude-button-primary w-full py-4 block"
                            >
                                Create Your First Deck
                            </Link>
                            <button 
                                onClick={dismissOnboarding}
                                className="text-claude-secondary font-medium text-sm"
                            >
                                Maybe Later
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-display font-bold mb-1">Your Library</h1>
                    <p className="text-claude-secondary text-sm">
                        {decks.length === 0 ? 'Create a deck to start' : `${decks.length} deck${decks.length !== 1 ? 's' : ''}`}
                    </p>
                </div>
                {decks.length > 0 && (
                    <button 
                        onClick={handleRefresh} 
                        disabled={refreshing}
                        className="p-2 text-claude-secondary active:text-claude-text disabled:opacity-50"
                    >
                        <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>

            {decks.length === 0 ? (
                <div className="text-center py-16 bg-claude-surface border border-claude-border rounded-2xl">
                    <div className="w-14 h-14 bg-claude-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Layers className="w-7 h-7 text-claude-secondary" />
                    </div>
                    <h2 className="text-lg font-display font-semibold mb-2">No decks yet</h2>
                    <p className="text-claude-secondary text-sm mb-6 px-8">Tap the + button below to create your first deck</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {decks.map((deck, index) => (
                        <Link
                            key={deck.id}
                            to={`/deck/${deck.id}`}
                            className="claude-card p-4 flex items-center gap-4 active:scale-[0.98] transition-transform"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className="w-12 h-12 bg-claude-bg rounded-xl flex items-center justify-center shrink-0">
                                <span className="text-lg font-display font-bold text-claude-accent">
                                    {deck.cardCount}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-display font-bold text-base truncate">{deck.title}</h3>
                                <p className="text-claude-secondary text-sm truncate">
                                    {deck.description || `${deck.cardCount} card${deck.cardCount !== 1 ? 's' : ''}`}
                                </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-claude-secondary shrink-0" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
