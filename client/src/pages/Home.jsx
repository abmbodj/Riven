import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Layers, ArrowRight, Clock } from 'lucide-react';
import { api } from '../api';

export default function Home() {
    const [decks, setDecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.getDecks()
            .then(setDecks)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 bg-claude-border rounded-full mb-4"></div>
            <div className="h-4 w-32 bg-claude-border rounded"></div>
        </div>
    );

    if (error) return (
        <div className="text-center py-10 bg-red-50 text-red-600 rounded-2xl border border-red-100">
            <p className="font-medium">Error: {error}</p>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                <div>
                    <h1 className="text-4xl font-display font-bold mb-2">Your Library</h1>
                    <p className="text-claude-secondary text-lg">Organize and master your knowledge.</p>
                </div>
            </div>

            {decks.length === 0 ? (
                <div className="text-center py-20 bg-white border border-claude-border rounded-3xl shadow-sm">
                    <div className="w-16 h-16 bg-claude-bg rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Layers className="w-8 h-8 text-claude-secondary" />
                    </div>
                    <h2 className="text-xl font-display font-semibold mb-2">No decks yet</h2>
                    <p className="text-claude-secondary mb-8 max-w-xs mx-auto">Create your first deck to start studying and tracking your progress.</p>
                    <Link to="/create" className="claude-button-primary">Create First Deck</Link>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                    {decks.map(deck => (
                        <Link
                            key={deck.id}
                            to={`/deck/${deck.id}`}
                            className="claude-card p-6 hover:border-claude-text/20 hover:shadow-md transition-all duration-300 group relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="bg-claude-bg text-claude-secondary text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                                        {deck.cardCount} {deck.cardCount === 1 ? 'card' : 'cards'}
                                    </span>
                                </div>
                                <h3 className="font-display font-bold text-2xl mb-2 group-hover:text-claude-accent transition-colors">{deck.title}</h3>
                                <p className="text-claude-secondary text-sm mb-6 line-clamp-2 leading-relaxed">{deck.description || 'No description provided.'}</p>

                                <div className="flex items-center justify-between pt-4 border-t border-claude-border/50">
                                    <div className="flex items-center gap-1.5 text-xs text-claude-secondary">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Updated recently</span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-claude-bg flex items-center justify-center group-hover:bg-claude-text group-hover:text-white transition-all duration-300">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}

                    <Link
                        to="/create"
                        className="border-2 border-dashed border-claude-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-claude-secondary hover:bg-white transition-all group min-h-[200px]"
                    >
                        <div className="w-10 h-10 rounded-full bg-claude-bg flex items-center justify-center group-hover:bg-claude-text group-hover:text-white transition-all">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="font-medium text-claude-secondary group-hover:text-claude-text">Add New Deck</span>
                    </Link>
                </div>
            )}
        </div>
    );
}
