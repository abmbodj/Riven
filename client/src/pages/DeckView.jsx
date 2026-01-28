import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, BookOpen, Trash2, Plus, X, ArrowLeft, Pencil, Check, Folder, Hash, FileText, Copy, Download, BarChart3, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';

export default function DeckView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [deck, setDeck] = useState(null);
    const [folders, setFolders] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddCard, setShowAddCard] = useState(false);
    const [newCard, setNewCard] = useState({ front: '', back: '' });
    const [editingCard, setEditingCard] = useState(null);
    const [editCardData, setEditCardData] = useState({ front: '', back: '' });
    const [editingDeck, setEditingDeck] = useState(false);
    const [editDeckData, setEditDeckData] = useState({ title: '', description: '', folder_id: null, tagIds: [] });
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: null, id: null });
    const [swipedCard, setSwipedCard] = useState(null);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [reorderMode, setReorderMode] = useState(false);
    const touchStartX = useRef(0);

    const loadDeck = useCallback(() => {
        api.getDeck(id)
            .then(data => {
                setDeck(data);
                setEditDeckData({
                    title: data.title,
                    description: data.description || '',
                    folder_id: data.folder_id,
                    tagIds: data.tags?.map(t => t.id) || []
                });
            })
            .catch(() => {
                toast.error('Failed to load deck');
            })
            .finally(() => setLoading(false));
    }, [id, toast]);

    useEffect(() => {
        loadDeck();
        Promise.all([api.getFolders(), api.getTags()]).then(([f, t]) => {
            setFolders(f);
            setTags(t);
        });
    }, [loadDeck]);

    const loadStats = async () => {
        try {
            const data = await api.getDeckStats(id);
            setStats(data);
            setShowStats(true);
        } catch {
            toast.error('Failed to load statistics');
        }
    };

    const handleDuplicate = async () => {
        try {
            const newDeck = await api.duplicateDeck(id);
            toast.success('Deck duplicated!');
            navigate(`/deck/${newDeck.id}`);
        } catch {
            toast.error('Failed to duplicate deck');
        }
    };

    const handleExport = async (format) => {
        try {
            const data = await api.exportDeck(id, format);

            if (format === 'csv') {
                const blob = new Blob([data], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${deck.title}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${deck.title}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }

            toast.success(`Exported as ${format.toUpperCase()}`);
            setShowExportMenu(false);
        } catch {
            toast.error('Failed to export deck');
        }
    };

    const handleMoveCard = async (cardId, direction) => {
        const cards = [...deck.cards];
        const idx = cards.findIndex(c => c.id === cardId);
        if (idx === -1) return;

        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= cards.length) return;

        // Swap cards
        [cards[idx], cards[newIdx]] = [cards[newIdx], cards[idx]];

        // Update positions locally
        setDeck({ ...deck, cards });

        // Save to server
        try {
            await api.reorderCards(id, cards.map(c => c.id));
        } catch {
            toast.error('Failed to reorder cards');
            loadDeck(); // Reload on error
        }
    };

    const handleDeleteDeck = async () => {
        try {
            await api.deleteDeck(id);
            toast.success('Deck deleted');
            navigate('/');
        } catch {
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
        } catch {
            toast.error('Failed to add card');
        }
    };

    const handleDeleteCard = async (cardId) => {
        try {
            await api.deleteCard(cardId);
            toast.success('Card deleted');
            setSwipedCard(null);
            loadDeck();
        } catch {
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
        } catch {
            toast.error('Failed to save card');
        }
    };

    const handleBulkImport = async (e) => {
        e.preventDefault();
        if (!bulkText.trim()) return;

        // Parse the text - supports "front - back" or "front | back" or "front : back" per line
        const lines = bulkText.split('\n').filter(line => line.trim());
        const cards = [];

        for (const line of lines) {
            // Try different separators
            let parts = null;
            for (const sep of [' - ', ' | ', ' : ', '\t']) {
                if (line.includes(sep)) {
                    parts = line.split(sep);
                    break;
                }
            }

            if (parts && parts.length >= 2) {
                cards.push({
                    front: parts[0].trim(),
                    back: parts.slice(1).join(' ').trim()
                });
            }
        }

        if (cards.length === 0) {
            toast.error('No valid cards found. Use "front - back" format.');
            return;
        }

        try {
            // Add all cards
            for (const card of cards) {
                await api.addCard(id, card.front, card.back);
            }
            toast.success(`Added ${cards.length} cards!`);
            setBulkText('');
            setShowBulkImport(false);
            loadDeck();
        } catch {
            toast.error('Failed to import cards');
        }
    };

    const handleSaveDeck = async () => {
        if (!editDeckData.title.trim()) return;
        try {
            await api.updateDeck(id, editDeckData.title, editDeckData.description, editDeckData.folder_id, editDeckData.tagIds);
            setEditingDeck(false);
            toast.success('Deck saved');
            loadDeck();
        } catch {
            toast.error('Failed to save deck');
        }
    };

    const toggleTag = (tagId) => {
        setEditDeckData(prev => ({
            ...prev,
            tagIds: prev.tagIds.includes(tagId)
                ? prev.tagIds.filter(id => id !== tagId)
                : [...prev.tagIds, tagId]
        }));
    };

    const currentFolder = folders.find(f => f.id === deck?.folder_id);

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

            {/* Stats Modal */}
            {showStats && stats && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-claude-surface w-full max-w-sm rounded-3xl p-6 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-display font-bold">Statistics</h3>
                            <button onClick={() => setShowStats(false)} className="p-2">
                                <X className="w-6 h-6 text-claude-secondary" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-claude-bg rounded-xl p-4 text-center">
                                <span className="text-2xl font-bold">{stats.total_sessions}</span>
                                <p className="text-xs text-claude-secondary mt-1">Sessions</p>
                            </div>
                            <div className="bg-claude-bg rounded-xl p-4 text-center">
                                <span className="text-2xl font-bold">{stats.accuracy}%</span>
                                <p className="text-xs text-claude-secondary mt-1">Accuracy</p>
                            </div>
                            <div className="bg-claude-bg rounded-xl p-4 text-center">
                                <span className="text-2xl font-bold">{stats.total_cards_studied}</span>
                                <p className="text-xs text-claude-secondary mt-1">Cards Studied</p>
                            </div>
                            <div className="bg-claude-bg rounded-xl p-4 text-center">
                                <span className="text-2xl font-bold">{Math.round(stats.total_time_seconds / 60)}m</span>
                                <p className="text-xs text-claude-secondary mt-1">Time Spent</p>
                            </div>
                        </div>

                        {stats.difficulty_distribution && (
                            <div className="mb-4">
                                <h4 className="text-sm font-bold text-claude-secondary mb-2">Card Difficulty</h4>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-green-500/20 rounded-lg p-2 text-center">
                                        <span className="text-lg font-bold text-green-400">{stats.difficulty_distribution.easy}</span>
                                        <p className="text-[10px] text-green-400">Easy</p>
                                    </div>
                                    <div className="flex-1 bg-yellow-500/20 rounded-lg p-2 text-center">
                                        <span className="text-lg font-bold text-yellow-400">{stats.difficulty_distribution.medium}</span>
                                        <p className="text-[10px] text-yellow-400">Medium</p>
                                    </div>
                                    <div className="flex-1 bg-red-500/20 rounded-lg p-2 text-center">
                                        <span className="text-lg font-bold text-red-400">{stats.difficulty_distribution.hard}</span>
                                        <p className="text-[10px] text-red-400">Hard</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {stats.last_studied && (
                            <p className="text-xs text-claude-secondary text-center">
                                Last studied: {new Date(stats.last_studied).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="px-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <Link to="/" className="p-2 -ml-2 text-claude-secondary active:text-claude-text">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={loadStats}
                            className="p-2 text-claude-secondary active:text-claude-text active:scale-95 transition-transform"
                            title="Statistics"
                        >
                            <BarChart3 className="w-5 h-5" />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="p-2 text-claude-secondary active:text-claude-text active:scale-95 transition-transform"
                                title="Export"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            {showExportMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                                    <div className="absolute right-0 top-full mt-1 bg-claude-surface border border-claude-border rounded-xl shadow-lg overflow-hidden z-20 min-w-[120px]">
                                        <button
                                            onClick={() => handleExport('json')}
                                            className="w-full px-4 py-2.5 text-sm text-left hover:bg-claude-bg"
                                        >
                                            Export JSON
                                        </button>
                                        <button
                                            onClick={() => handleExport('csv')}
                                            className="w-full px-4 py-2.5 text-sm text-left hover:bg-claude-bg border-t border-claude-border"
                                        >
                                            Export CSV
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={handleDuplicate}
                            className="p-2 text-claude-secondary active:text-claude-text active:scale-95 transition-transform"
                            title="Duplicate"
                        >
                            <Copy className="w-5 h-5" />
                        </button>
                        {!editingDeck && (
                            <button
                                onClick={() => setEditingDeck(true)}
                                className="p-2 text-claude-secondary active:text-claude-text active:scale-95 transition-transform"
                            >
                                <Pencil className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={() => setDeleteConfirm({ show: true, type: 'deck', id: id })}
                            className="p-2 text-claude-secondary active:text-red-500 active:scale-95 transition-transform"
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

                        {/* Folder selector */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Folder</label>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setEditDeckData({ ...editDeckData, folder_id: null })}
                                    className={`px-3 py-2 rounded-lg text-sm ${!editDeckData.folder_id ? 'bg-claude-accent text-white' : 'bg-claude-bg border border-claude-border'}`}
                                >
                                    None
                                </button>
                                {folders.map(folder => (
                                    <button
                                        key={folder.id}
                                        type="button"
                                        onClick={() => setEditDeckData({ ...editDeckData, folder_id: folder.id })}
                                        className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 ${editDeckData.folder_id === folder.id ? 'text-white' : 'bg-claude-bg border border-claude-border'}`}
                                        style={editDeckData.folder_id === folder.id ? { backgroundColor: folder.color } : {}}
                                    >
                                        <Folder className="w-4 h-4" style={editDeckData.folder_id !== folder.id ? { color: folder.color } : {}} />
                                        {folder.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tags selector */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Tags</label>
                            <div className="flex gap-2 flex-wrap">
                                {tags.map(tag => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className={`px-3 py-2 rounded-full text-sm flex items-center gap-1.5 ${editDeckData.tagIds.includes(tag.id) ? 'text-white' : 'bg-claude-bg border border-claude-border'}`}
                                        style={editDeckData.tagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                                    >
                                        <Hash className="w-3.5 h-3.5" style={!editDeckData.tagIds.includes(tag.id) ? { color: tag.color } : {}} />
                                        {tag.name}
                                    </button>
                                ))}
                                {tags.length === 0 && <span className="text-claude-secondary text-sm">No tags available</span>}
                            </div>
                        </div>

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
                        <p className="text-claude-secondary text-sm mb-3">{deck.description || 'No description'} · {deck.cards.length} cards</p>

                        {/* Folder & Tags display */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {currentFolder && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-claude-surface border border-claude-border">
                                    <Folder className="w-3.5 h-3.5" style={{ color: currentFolder.color }} />
                                    {currentFolder.name}
                                </span>
                            )}
                            {deck.tags?.map(tag => (
                                <span
                                    key={tag.id}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1"
                                    style={{ backgroundColor: tag.color }}
                                >
                                    <Hash className="w-3 h-3" />
                                    {tag.name}
                                </span>
                            ))}
                        </div>
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
                    className={`flex-1 p-4 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform ${deck.cards.length > 0
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
                    className={`flex-1 border p-4 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform ${deck.cards.length >= 4
                        ? 'bg-claude-surface border-claude-border'
                        : 'bg-claude-surface/50 border-claude-border/50 text-claude-secondary'
                        }`}
                >
                    <Play className="w-5 h-5" />
                    <span className="font-semibold">Test</span>
                </Link>
            </div>

            {/* Cards header */}
            <div className="px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-display font-bold">Cards</h2>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button
                        onClick={() => setReorderMode(!reorderMode)}
                        className={`flex items-center gap-1.5 font-semibold text-sm active:scale-95 transition-transform px-2 py-1 ${reorderMode ? 'text-claude-accent' : 'text-claude-secondary'}`}
                    >
                        <GripVertical className="w-4 h-4" /> {reorderMode ? 'Done' : 'Reorder'}
                    </button>
                    <button
                        onClick={() => setShowBulkImport(true)}
                        className="flex items-center gap-1.5 text-claude-secondary font-semibold text-sm active:scale-95 transition-transform px-2 py-1"
                    >
                        <FileText className="w-4 h-4" /> Import
                    </button>
                    <button
                        onClick={() => setShowAddCard(true)}
                        className="flex items-center gap-1.5 text-claude-accent font-semibold text-sm active:scale-95 transition-transform px-3 py-2 bg-claude-accent/10 rounded-lg"
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>
            </div>

            {/* Bulk Import Modal */}
            {showBulkImport && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
                    <form
                        onSubmit={handleBulkImport}
                        className="bg-claude-surface w-full p-6 rounded-t-3xl animate-in slide-in-from-bottom duration-300 safe-area-bottom max-h-[80vh] flex flex-col"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-display font-bold">Import Cards</h3>
                            <button type="button" onClick={() => setShowBulkImport(false)} className="p-2">
                                <X className="w-6 h-6 text-claude-secondary" />
                            </button>
                        </div>
                        <p className="text-claude-secondary text-sm mb-4">
                            Paste multiple cards, one per line. Use <code className="px-1.5 py-0.5 bg-claude-bg rounded text-xs">-</code> or <code className="px-1.5 py-0.5 bg-claude-bg rounded text-xs">|</code> to separate front and back.
                        </p>
                        <div className="text-xs text-claude-secondary mb-3 bg-claude-bg rounded-lg p-3">
                            <strong>Example:</strong><br />
                            hello - hola<br />
                            goodbye - adiós<br />
                            thank you - gracias
                        </div>
                        <textarea
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            className="flex-1 min-h-[150px] px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none resize-none text-sm font-mono"
                            placeholder="Paste your cards here..."
                            autoFocus
                        />
                        <button type="submit" className="w-full claude-button-primary py-4 mt-4">
                            Import Cards
                        </button>
                    </form>
                </div>
            )}

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
                            className={`claude-card p-4 transition-transform duration-200 ${swipedCard === card.id ? '-translate-x-20' : 'translate-x-0'
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
                            ) : reorderMode ? (
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleMoveCard(card.id, 'up'); }}
                                            disabled={idx === 0}
                                            className="p-1 text-claude-secondary disabled:opacity-30"
                                        >
                                            <ChevronUp className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleMoveCard(card.id, 'down'); }}
                                            disabled={idx === deck.cards.length - 1}
                                            className="p-1 text-claude-secondary disabled:opacity-30"
                                        >
                                            <ChevronDown className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <span className="text-claude-border font-display font-bold text-sm">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm mb-1">{card.front}</p>
                                        <p className="text-claude-secondary text-sm">{card.back}</p>
                                    </div>
                                    <GripVertical className="w-5 h-5 text-claude-secondary shrink-0" />
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
