import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, BookOpen, Trash2, Plus, X, ArrowLeft, Pencil, Check } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function DeckView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [deck, setDeck] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddCard, setShowAddCard] = useState(false);
    const [newCard, setNewCard] = useState({ front: '', back: '' });
    const [editingCard, setEditingCard] = useState(null);
    const [editCardData, setEditCardData] = useState({ front: '', back: '' });
    const [editingDeck, setEditingDeck] = useState(false);
    const [editDeckData, setEditDeckData] = useState({ title: '', description: '' });
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: null, id: null });
    const [swipedCard, setSwipedCard] = useState(null);
    const touchStartX = useRef(0);

    useEffect(() => {
        loadDeck();
    }, [id]);

    const loadDeck = () => {
        api.getDeck(id)
            .then(data => {
                setDeck(data);
                setEditDeckData({ title: data.title, description: data.description || '' });
            })
            .catch(err => {
                console.error(err);
                toast.error('Failed to load deck');
            })
            .finally(() => setLoading(false));
    };

    const handleDeleteDeck = async () => {
        try {
            await api.deleteDeck(id);
            toast.success('Deck deleted');
            navigate('/');
        } catch (err) {
            toast.error('Failed to delete deck');
        }
    };

    const handleAddCard = async (e) => {
        e.preventDefault();
        if (!newCard.front || !newCard.back) return;

        try {
            await api.addCard(id, newCard.front, newCard.back);
            setNewCard({ front: '', back: '' });
            setShowAddCard(false);
            toast.success('Card added');
            loadDeck();
        } catch (err) {
            toast.error('Failed to add card');
        }
    };

    const handleDeleteCard = async (cardId) => {
        try {
            await api.deleteCard(cardId);
            toast.success('Card deleted');
            setSwipedCard(null);
            loadDeck();
        } catch (err) {
            toast.error('Failed to delete card');
        }
    };

    const handleEditCard = (card) => {
        setEditingCard(card.id);
        setEditCardData({ front: card.front, back: card.back });
        setSwipedCard(null);
    };

    const handleSaveCard = async (cardId) => {
        if (!editCardData.front || !editCardData.back) return;
        try {
            await api.updateCard(cardId, editCardData.front, editCardData.back);
            setEditingCard(null);
            toast.success('Card saved');
            loadDeck();
        } catch (err) {
            toast.error('Failed to save card');
        }
    };

    const handleSaveDeck = async () => {
        if (!editDeckData.title.trim()) return;
        try {
            await api.updateDeck(id, editDeckData.title, editDeckData.description);
            setEditingDeck(false);
            toast.success('Deck saved');
            loadDeck();
        } catch (err) {
            toast.error('Failed to save deck');
        }
    };

    // Swipe handlers for cards
    const handleTouchStart = (cardId, e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (cardId, e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX.current - touchEndX;
        
        if (diff > 80) {
            // Swiped left - show delete
            setSwipedCard(cardId);
        } else if (diff < -80) {
            // Swiped right - hide delete
            setSwipedCard(null);
        }
    };

    if (loading) return (
        <div className="animate-pulse space-y-4">
            <div className="h-8 bg-claude-border rounded w-1/3" />
            <div className="h-4 bg-claude-border rounded w-2/3" />
            <div className="flex gap-3 mt-6">
                <div className="flex-1 h-16 bg-claude-border rounded-2xl" />
                <div className="flex-1 h-16 bg-claude-border rounded-2xl" />
            </div>
        </div>
    );
    if (!deck) return <div className="text-center py-20 text-claude-secondary">Deck not found</div>;

    return (
        <div className="animate-in fade-in duration-500 -mx-4">
            {/* Delete confirmation modal */}
            <ConfirmModal
                isOpen={deleteConfirm.show}
                title={deleteConfirm.type === 'deck' ? 'Delete Deck?' : 'Delete Card?'}
                message={deleteConfirm.type === 'deck' 
                    ? 'This will permanently delete the deck and all its cards.' 
                    : 'This card will be permanently removed.'}
                onConfirm={() => {
                    if (deleteConfirm.type === 'deck') {
                        handleDeleteDeck();
                    } else {
                        handleDeleteCard(deleteConfirm.id);
                    }
                    setDeleteConfirm({ show: false, type: null, id: null });
                }}
                onCancel={() => setDeleteConfirm({ show: false, type: null, id: null })}
            />

            {/* Header */}
            <div className="px-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <Link to="/" className="p-2 -ml-2 text-claude-secondary active:text-claude-text">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex items-center gap-2">
                        {!editingDeck && (
                            <button
                                onClick={() => setEditingDeck(true)}
                                className="p-2 text-claude-secondary active:text-claude-text"
                            >
                                <Pencil className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={() => setDeleteConfirm({ show: true, type: 'deck', id: id })}
                            className="p-2 text-claude-secondary active:text-red-500"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {editingDeck ? (
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={editDeckData.title}
                            onChange={e => setEditDeckData({ ...editDeckData, title: e.target.value })}
                            className="w-full text-2xl font-display font-bold bg-claude-surface border border-claude-border rounded-xl px-4 py-3 outline-none focus:border-claude-accent"
                            autoFocus
                        />
                        <textarea
                            value={editDeckData.description}
                            onChange={e => setEditDeckData({ ...editDeckData, description: e.target.value })}
                            className="w-full bg-claude-surface border border-claude-border rounded-xl px-4 py-3 outline-none focus:border-claude-accent resize-none"
                            placeholder="Add a description..."
                            rows={2}
                        />
                        <div className="flex gap-2">
                            <button onClick={handleSaveDeck} className="claude-button-primary flex-1 py-3 flex items-center justify-center gap-2">
                                <Check className="w-4 h-4" /> Save
                            </button>
                            <button onClick={() => setEditingDeck(false)} className="claude-button-secondary px-6 py-3">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl font-display font-bold mb-1">{deck.title}</h1>
                        <p className="text-claude-secondary text-sm">{deck.description || 'No description'} · {deck.cards.length} cards</p>
                    </>
                )}
            </div>

            {/* Action buttons */}
            <div className="px-4 flex gap-3 mb-6">
                <Link
                    to={deck.cards.length > 0 ? `/deck/${id}/study` : '#'}
                    onClick={e => {
                        if (deck.cards.length === 0) {
                            e.preventDefault();
                            toast.error('Add some cards first');
                        }
                    }}
                    className={`flex-1 p-4 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform ${
                        deck.cards.length > 0 
                            ? 'bg-claude-accent text-white' 
                            : 'bg-claude-accent/50 text-white/70'
                    }`}
                >
                    <BookOpen className="w-5 h-5" />
                    <span className="font-semibold">Study</span>
                </Link>
                <Link
                    to={deck.cards.length >= 4 ? `/deck/${id}/test` : '#'}
                    onClick={e => {
                        if (deck.cards.length < 4) {
                            e.preventDefault();
                            toast.error('Need 4+ cards for test mode');
                        }
                    }}
                    className={`flex-1 border p-4 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform ${
                        deck.cards.length >= 4 
                            ? 'bg-claude-surface border-claude-border' 
                            : 'bg-claude-surface/50 border-claude-border/50 text-claude-secondary'
                    }`}
                >
                    <Play className="w-5 h-5" />
                    <span className="font-semibold">Test</span>
                </Link>
            </div>

            {/* Cards header */}
            <div className="px-4 flex items-center justify-between mb-4">
                <h2 className="text-lg font-display font-bold">Cards</h2>
                <button
                    onClick={() => setShowAddCard(true)}
                    className="flex items-center gap-1.5 text-claude-accent font-semibold text-sm"
                >
                    <Plus className="w-4 h-4" /> Add
                </button>
            </div>

            {/* Add card modal */}
            {showAddCard && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
                    <form
                        onSubmit={handleAddCard}
                        className="bg-claude-surface w-full p-6 rounded-t-3xl animate-in slide-in-from-bottom duration-300 safe-area-bottom"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-display font-bold">New Card</h3>
                            <button type="button" onClick={() => setShowAddCard(false)} className="p-2">
                                <X className="w-6 h-6 text-claude-secondary" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Front</label>
                                <textarea
                                    placeholder="Question or term"
                                    value={newCard.front}
                                    onChange={e => setNewCard({ ...newCard, front: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none min-h-[80px] resize-none"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Back</label>
                                <textarea
                                    placeholder="Answer or definition"
                                    value={newCard.back}
                                    onChange={e => setNewCard({ ...newCard, back: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none min-h-[80px] resize-none"
                                />
                            </div>
                            <button type="submit" className="w-full claude-button-primary py-4">Add Card</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Cards list with swipe to delete */}
            <div className="px-4 space-y-3">
                {deck.cards.length > 0 && (
                    <p className="text-xs text-claude-secondary text-center mb-2">Swipe left on a card to delete</p>
                )}
                {deck.cards.map((card, idx) => (
                    <div 
                        key={card.id} 
                        className="relative overflow-hidden rounded-2xl"
                        onTouchStart={(e) => handleTouchStart(card.id, e)}
                        onTouchEnd={(e) => handleTouchEnd(card.id, e)}
                    >
                        {/* Delete button behind card */}
                        <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
                            <button 
                                onClick={() => setDeleteConfirm({ show: true, type: 'card', id: card.id })}
                                className="p-3"
                            >
                                <Trash2 className="w-6 h-6 text-white" />
                            </button>
                        </div>
                        
                        {/* Card content */}
                        <div 
                            className={`claude-card p-4 transition-transform duration-200 ${
                                swipedCard === card.id ? '-translate-x-20' : 'translate-x-0'
                            }`}
                        >
                            {editingCard === card.id ? (
                                <div className="space-y-3">
                                    <textarea
                                        value={editCardData.front}
                                        onChange={e => setEditCardData({ ...editCardData, front: e.target.value })}
                                        className="w-full px-3 py-2 bg-claude-bg border border-claude-border rounded-xl outline-none focus:border-claude-accent resize-none text-sm"
                                        rows={2}
                                        autoFocus
                                    />
                                    <textarea
                                        value={editCardData.back}
                                        onChange={e => setEditCardData({ ...editCardData, back: e.target.value })}
                                        className="w-full px-3 py-2 bg-claude-bg border border-claude-border rounded-xl outline-none focus:border-claude-accent resize-none text-sm"
                                        rows={2}
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => handleSaveCard(card.id)} className="claude-button-primary flex-1 py-2 text-sm">
                                            Save
                                        </button>
                                        <button onClick={() => setEditingCard(null)} className="claude-button-secondary py-2 px-4 text-sm">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-3" onClick={() => handleEditCard(card)}>
                                    <span className="text-claude-border font-display font-bold text-sm mt-0.5">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm mb-1">{card.front}</p>
                                        <p className="text-claude-secondary text-sm">{card.back}</p>
                                    </div>
                                    <Pencil className="w-4 h-4 text-claude-secondary shrink-0 mt-1" />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {deck.cards.length === 0 && (
                    <div className="text-center py-12 bg-claude-surface/50 border border-dashed border-claude-border rounded-2xl">
                        <p className="text-claude-secondary text-sm mb-1">No cards yet</p>
                        <p className="text-claude-secondary text-xs">Tap "Add" to create your first card</p>
                    </div>
                )}
            </div>
        </div>
    );
}
