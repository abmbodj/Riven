import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, BookOpen, Trash2, Plus, X, ArrowLeft, Pencil, Check } from 'lucide-react';
import { api } from '../api';

export default function DeckView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [deck, setDeck] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddCard, setShowAddCard] = useState(false);
    const [newCard, setNewCard] = useState({ front: '', back: '' });
    const [editingCard, setEditingCard] = useState(null);
    const [editCardData, setEditCardData] = useState({ front: '', back: '' });
    const [editingDeck, setEditingDeck] = useState(false);
    const [editDeckData, setEditDeckData] = useState({ title: '', description: '' });

    useEffect(() => {
        loadDeck();
    }, [id]);

    const loadDeck = () => {
        api.getDeck(id)
            .then(data => {
                setDeck(data);
                setEditDeckData({ title: data.title, description: data.description || '' });
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    const handleDeleteDeck = async () => {
        if (window.confirm('Are you sure you want to delete this deck?')) {
            await api.deleteDeck(id);
            navigate('/');
        }
    };

    const handleAddCard = async (e) => {
        e.preventDefault();
        if (!newCard.front || !newCard.back) return;

        await api.addCard(id, newCard.front, newCard.back);
        setNewCard({ front: '', back: '' });
        setShowAddCard(false);
        loadDeck();
    };

    const handleDeleteCard = async (cardId) => {
        if (window.confirm('Delete this card?')) {
            await api.deleteCard(cardId);
            loadDeck();
        }
    };

    const handleEditCard = (card) => {
        setEditingCard(card.id);
        setEditCardData({ front: card.front, back: card.back });
    };

    const handleSaveCard = async (cardId) => {
        if (!editCardData.front || !editCardData.back) return;
        await api.updateCard(cardId, editCardData.front, editCardData.back);
        setEditingCard(null);
        loadDeck();
    };

    const handleSaveDeck = async () => {
        if (!editDeckData.title.trim()) return;
        await api.updateDeck(id, editDeckData.title, editDeckData.description);
        setEditingDeck(false);
        loadDeck();
    };

    if (loading) return <div className="text-center py-20 animate-pulse text-claude-secondary">Loading deck...</div>;
    if (!deck) return <div className="text-center py-20 text-claude-secondary">Deck not found</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-10">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-claude-secondary hover:text-claude-text mb-6 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Library
                </Link>

                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="bg-claude-text text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">Deck</span>
                            <span className="text-claude-secondary text-sm font-medium">{deck.cards.length} cards</span>
                        </div>
                        {editingDeck ? (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={editDeckData.title}
                                    onChange={e => setEditDeckData({ ...editDeckData, title: e.target.value })}
                                    className="w-full text-4xl font-display font-bold bg-claude-bg border border-claude-border rounded-xl px-4 py-2 outline-none focus:border-claude-text"
                                    autoFocus
                                />
                                <textarea
                                    value={editDeckData.description}
                                    onChange={e => setEditDeckData({ ...editDeckData, description: e.target.value })}
                                    className="w-full text-lg bg-claude-bg border border-claude-border rounded-xl px-4 py-2 outline-none focus:border-claude-text resize-none"
                                    placeholder="Add a description..."
                                    rows={2}
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleSaveDeck} className="claude-button-primary text-sm py-1.5 px-4 flex items-center gap-1">
                                        <Check className="w-4 h-4" /> Save
                                    </button>
                                    <button onClick={() => setEditingDeck(false)} className="claude-button-secondary text-sm py-1.5 px-4">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-4xl font-display font-bold text-claude-text mb-3 leading-tight">{deck.title}</h1>
                                <p className="text-claude-secondary text-lg max-w-2xl leading-relaxed">{deck.description || 'No description provided for this deck.'}</p>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!editingDeck && (
                            <button
                                onClick={() => setEditingDeck(true)}
                                className="p-2.5 rounded-xl border border-claude-border text-claude-secondary hover:text-claude-text hover:bg-claude-bg transition-all"
                                title="Edit Deck"
                            >
                                <Pencil className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={handleDeleteDeck}
                            className="p-2.5 rounded-xl border border-claude-border text-claude-secondary hover:text-red-500 hover:bg-red-50 transition-all"
                            title="Delete Deck"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                <Link
                    to={`/deck/${id}/study`}
                    className="bg-claude-text text-white p-6 rounded-2xl flex items-center gap-4 hover:bg-opacity-90 transition-all shadow-sm group"
                >
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="block font-display font-bold text-lg">Study Mode</span>
                        <span className="text-white/60 text-sm">Flip through flashcards</span>
                    </div>
                </Link>
                <Link
                    to={`/deck/${id}/test`}
                    className="bg-white border border-claude-border p-6 rounded-2xl flex items-center gap-4 hover:border-claude-text/20 hover:shadow-md transition-all group"
                >
                    <div className="w-12 h-12 bg-claude-bg rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 text-claude-text" />
                    </div>
                    <div>
                        <span className="block font-display font-bold text-lg">Practice Test</span>
                        <span className="text-claude-secondary text-sm">Challenge your knowledge</span>
                    </div>
                </Link>
            </div>

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold">Cards</h2>
                <button
                    onClick={() => setShowAddCard(true)}
                    className="claude-button-secondary flex items-center gap-2 text-sm"
                >
                    <Plus className="w-4 h-4" /> Add Card
                </button>
            </div>

            {showAddCard && (
                <div className="fixed inset-0 bg-claude-text/20 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <form
                        onSubmit={handleAddCard}
                        className="bg-white w-full max-w-lg p-8 rounded-3xl shadow-2xl border border-claude-border animate-in zoom-in-95 duration-300"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-display font-bold">New Card</h3>
                            <button type="button" onClick={() => setShowAddCard(false)} className="p-2 hover:bg-claude-bg rounded-full transition-colors">
                                <X className="w-6 h-6 text-claude-secondary" />
                            </button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-claude-secondary mb-2">Front (Question)</label>
                                <textarea
                                    placeholder="What is the capital of France?"
                                    value={newCard.front}
                                    onChange={e => setNewCard({ ...newCard, front: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:ring-2 focus:ring-claude-text/5 focus:border-claude-text outline-none transition-all min-h-[100px] resize-none"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-claude-secondary mb-2">Back (Answer)</label>
                                <textarea
                                    placeholder="Paris"
                                    value={newCard.back}
                                    onChange={e => setNewCard({ ...newCard, back: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:ring-2 focus:ring-claude-text/5 focus:border-claude-text outline-none transition-all min-h-[100px] resize-none"
                                />
                            </div>
                            <button type="submit" className="w-full claude-button-primary py-3 text-lg">Add to Deck</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-4">
                {deck.cards.map((card, idx) => (
                    <div key={card.id} className="claude-card p-6 flex justify-between items-start group hover:border-claude-text/10 transition-colors">
                        <div className="flex gap-6 w-full mr-4">
                            <span className="text-claude-border font-display font-bold text-xl">{String(idx + 1).padStart(2, '0')}</span>
                            {editingCard === card.id ? (
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <span className="block text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-2">Front</span>
                                        <textarea
                                            value={editCardData.front}
                                            onChange={e => setEditCardData({ ...editCardData, front: e.target.value })}
                                            className="w-full px-3 py-2 bg-claude-bg border border-claude-border rounded-xl outline-none focus:border-claude-text resize-none"
                                            rows={2}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-2">Back</span>
                                        <textarea
                                            value={editCardData.back}
                                            onChange={e => setEditCardData({ ...editCardData, back: e.target.value })}
                                            className="w-full px-3 py-2 bg-claude-bg border border-claude-border rounded-xl outline-none focus:border-claude-text resize-none"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleSaveCard(card.id)} className="claude-button-primary text-sm py-1 px-3 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Save
                                        </button>
                                        <button onClick={() => setEditingCard(null)} className="claude-button-secondary text-sm py-1 px-3">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                                    <div>
                                        <span className="block text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-2">Front</span>
                                        <p className="text-claude-text font-medium leading-relaxed">{card.front}</p>
                                    </div>
                                    <div className="md:border-l md:border-claude-border/50 md:pl-8">
                                        <span className="block text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-2">Back</span>
                                        <p className="text-claude-secondary leading-relaxed">{card.back}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        {editingCard !== card.id && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleEditCard(card)}
                                    className="text-claude-border hover:text-claude-text transition-colors p-1"
                                    title="Edit card"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDeleteCard(card.id)}
                                    className="text-claude-border hover:text-red-500 transition-colors p-1"
                                    title="Delete card"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {deck.cards.length === 0 && !showAddCard && (
                    <div className="text-center py-20 bg-white/50 border border-dashed border-claude-border rounded-2xl">
                        <p className="text-claude-secondary italic">This deck is empty. Add some cards to start learning.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
