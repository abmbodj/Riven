import React, { useEffect, useState, useRef, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, BookOpen, Trash2, Plus, X, ArrowLeft, Pencil, Check, Folder, Hash, FileText, Copy, Download, BarChart3, ChevronUp, ChevronDown, Share2, GripVertical } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import CardImageUpload from '../components/CardImageUpload';

export default function DeckView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { isLoggedIn } = useAuth();
    const [deck, setDeck] = useState(null);
    const [folders, setFolders] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddCard, setShowAddCard] = useState(false);
    const [newCard, setNewCard] = useState({ front: '', back: '', front_image: null, back_image: null });
    const [editingCard, setEditingCard] = useState(null);
    const [editCardData, setEditCardData] = useState({ front: '', back: '', front_image: null, back_image: null });
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
    const [showShareModal, setShowShareModal] = useState(false);
    const [friends, setFriends] = useState([]);
    const [sharingTo, setSharingTo] = useState(null);
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

    const handleShareDeck = async () => {
        if (!isLoggedIn) {
            toast.error('Sign in to share decks');
            navigate('/account');
            return;
        }
        setShowShareModal(true);
        try {
            const friendsData = await api.getFriends();
            setFriends(friendsData);
        } catch {
            toast.error('Failed to load friends');
        }
    };

    const handleSendDeckToFriend = async (friendId) => {
        if (sharingTo) return;
        setSharingTo(friendId);
        try {
            const fullDeck = await api.getDeck(id);
            await api.sendMessage(
                friendId,
                `Shared a deck: ${fullDeck.title}`,
                'deck',
                { id: fullDeck.id, title: fullDeck.title, cardCount: fullDeck.cards?.length || 0 }
            );
            toast.success('Deck shared successfully!');
            setShowShareModal(false);
        } catch {
            toast.error('Failed to share deck');
        } finally {
            setSharingTo(null);
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
        // Require either front text or front image, and back text or back image
        if ((!newCard.front && !newCard.front_image) || (!newCard.back && !newCard.back_image)) return;

        try {
            await api.addCard(id, newCard.front, newCard.back, newCard.front_image, newCard.back_image);
            setNewCard({ front: '', back: '', front_image: null, back_image: null });
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
        setEditCardData({ front: card.front, back: card.back, front_image: card.front_image || null, back_image: card.back_image || null });
        setSwipedCard(null);
    };

    const handleSaveCard = async (cardId) => {
        // Require either front text or front image, and back text or back image
        if ((!editCardData.front && !editCardData.front_image) || (!editCardData.back && !editCardData.back_image)) return;
        try {
            await api.updateCard(cardId, editCardData.front, editCardData.back, editCardData.front_image, editCardData.back_image);
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
            // Add all cards in parallel
            await Promise.all(cards.map(card => api.addCard(id, card.front, card.back)));
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
        <div className="animate-in fade-in duration-500">
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
            {/* Stats Modal */}
            <AnimatePresence>
                {showStats && stats && (
                    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowStats(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative botanical-card paper-texture text-botanical-ink w-full sm:max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-2xl touch-pan-y"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="sm:hidden w-12 h-1.5 bg-botanical-forest/30 rounded-full mx-auto -mt-2 mb-4" />

                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-display font-bold">Deck Statistics</h3>
                                <button onClick={() => setShowStats(false)} className="p-2 -mr-2 active:bg-botanical-forest/10 rounded-full tap-action">
                                    <X className="w-7 h-7 text-botanical-ink/60" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-claude-bg border border-claude-border/50 rounded-2xl p-4 text-center">
                                    <span className="text-3xl font-bold text-claude-text">{stats.totalSessions || 0}</span>
                                    <p className="text-xs font-mono uppercase tracking-widest text-claude-secondary mt-1">Sessions</p>
                                </div>
                                <div className="bg-claude-bg border border-claude-border/50 rounded-2xl p-4 text-center">
                                    <span className="text-3xl font-bold text-claude-accent">{stats.accuracy || 0}%</span>
                                    <p className="text-xs font-mono uppercase tracking-widest text-claude-secondary mt-1">Accuracy</p>
                                </div>
                                <div className="bg-claude-bg border border-claude-border/50 rounded-2xl p-4 text-center">
                                    <span className="text-3xl font-bold text-claude-text">{stats.totalCardsStudied || stats.totalStudied || 0}</span>
                                    <p className="text-xs font-mono uppercase tracking-widest text-claude-secondary mt-1">Studied</p>
                                </div>
                                <div className="bg-claude-bg border border-claude-border/50 rounded-2xl p-4 text-center">
                                    <span className="text-3xl font-bold text-claude-text">{Math.round((stats.totalTimeSeconds || stats.totalTime || 0) / 60)}m</span>
                                    <p className="text-xs font-mono uppercase tracking-widest text-claude-secondary mt-1">Time</p>
                                </div>
                            </div>

                            {stats.cardsByDifficulty && (
                                <div className="mb-8">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3 pl-1">Card Progress</h4>
                                    <div className="flex gap-2.5">
                                        <div className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                                            <span className="text-xl font-bold text-blue-400">{stats.cardsByDifficulty.new || 0}</span>
                                            <p className="text-[10px] uppercase font-bold text-blue-400">New</p>
                                        </div>
                                        <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
                                            <span className="text-xl font-bold text-yellow-400">{stats.cardsByDifficulty.learning || 0}</span>
                                            <p className="text-[10px] uppercase font-bold text-yellow-400">Learning</p>
                                        </div>
                                        <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                                            <span className="text-xl font-bold text-green-400">{stats.cardsByDifficulty.familiar || 0}</span>
                                            <p className="text-[10px] uppercase font-bold text-green-400">Familiar</p>
                                        </div>
                                        <div className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
                                            <span className="text-xl font-bold text-purple-400">{stats.cardsByDifficulty.mastered || 0}</span>
                                            <p className="text-[10px] uppercase font-bold text-purple-400">Mastered</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {stats.masteredCount !== undefined && !stats.cardsByDifficulty && (
                                <div className="mb-8">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3 pl-1">Mastery Progress</h4>
                                    <div className="bg-claude-bg border border-claude-border/50 rounded-2xl p-5">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm text-claude-secondary">Mastered Cards</span>
                                            <span className="text-lg font-bold text-green-400">{stats.masteredCount} / {stats.cardCount || 0}</span>
                                        </div>
                                        {stats.cardCount > 0 && (
                                            <div className="h-3 bg-claude-border rounded-full overflow-hidden shadow-inner">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(stats.masteredCount / stats.cardCount) * 100}%` }}
                                                    transition={{ duration: 1, ease: 'easeOut' }}
                                                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {stats.recentSessions && stats.recentSessions.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-claude-secondary mb-3 pl-1">Recent Activity</h4>
                                    <div className="space-y-2.5">
                                        {stats.recentSessions.slice(0, 5).map((session, i) => (
                                            <div key={i} className="bg-claude-bg/50 border border-claude-border/30 rounded-xl p-4 flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-claude-text">
                                                        {new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-[10px] uppercase tracking-wider text-claude-secondary">Session Result</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-bold text-claude-accent">
                                                        {session.cards_correct}/{session.cards_studied}
                                                    </span>
                                                    <p className="text-[10px] text-claude-secondary">Correct</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="h-safe-bottom sm:hidden" />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="px-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <Link to="/" className="p-2 -ml-2 text-claude-secondary active:text-claude-text">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={loadStats}
                            className="p-2 text-claude-secondary active:text-claude-text"
                            title="Statistics"
                        >
                            <BarChart3 className="w-5 h-5" />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="p-2 text-claude-secondary active:text-claude-text tap-action"
                                title="Export"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            <AnimatePresence>
                                {showExportMenu && (
                                    <div className="fixed inset-0 z-[60] flex items-end sm:items-start sm:justify-end sm:p-4">
                                        {/* Mobile backdrop */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/40 backdrop-blur-sm sm:hidden"
                                            onClick={() => setShowExportMenu(false)}
                                        />

                                        <motion.div
                                            initial={{ y: '100%', opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: '100%', opacity: 0 }}
                                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                            className="relative w-full sm:w-48 bg-claude-surface sm:bg-claude-surface/90 sm:backdrop-blur-md border-t sm:border border-claude-border rounded-t-[2rem] sm:rounded-xl shadow-2xl overflow-hidden z-20"
                                        >
                                            <div className="sm:hidden w-10 h-1 bg-claude-border rounded-full mx-auto mt-3 mb-1" />
                                            <div className="p-4 sm:p-1 flex flex-col">
                                                <button
                                                    onClick={() => handleExport('json')}
                                                    className="w-full px-6 py-4 sm:px-4 sm:py-2.5 text-sm text-left font-semibold active:bg-claude-bg sm:hover:bg-claude-bg rounded-xl transition-colors"
                                                >
                                                    Export JSON
                                                </button>
                                                <button
                                                    onClick={() => handleExport('csv')}
                                                    className="w-full px-6 py-4 sm:px-4 sm:py-2.5 text-sm text-left font-semibold active:bg-claude-bg sm:hover:bg-claude-bg rounded-xl transition-colors sm:border-t border-claude-border/50"
                                                >
                                                    Export CSV
                                                </button>
                                                <button
                                                    onClick={() => setShowExportMenu(false)}
                                                    className="w-full px-6 py-4 sm:hidden text-center text-xs font-bold uppercase tracking-widest text-claude-secondary mt-2"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                            <div className="h-safe-bottom sm:hidden" />
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                        <button
                            onClick={handleDuplicate}
                            className="p-2 text-claude-secondary active:text-claude-text"
                            title="Duplicate"
                        >
                            <Copy className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleShareDeck}
                            className="p-2 text-claude-secondary active:text-purple-500"
                            title="Share"
                        >
                            <Share2 className="w-5 h-5" />
                        </button>
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
                    className={`flex-1 p-5 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-botanical ${deck.cards.length > 0
                        ? 'bg-botanical-forest text-botanical-parchment font-display text-lg tracking-wide hover:brightness-110 border border-botanical-forest/20'
                        : 'bg-botanical-forest/50 text-botanical-parchment/70 font-display text-lg tracking-wide border border-transparent'
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
                    className={`flex-1 p-5 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-botanical ${deck.cards.length >= 4
                        ? 'botanical-card text-botanical-parchment font-display text-lg tracking-wide hover:border-botanical-forest/30'
                        : 'botanical-card opacity-50 text-claude-secondary font-display text-lg tracking-wide'
                        }`}
                >
                    <Play className="w-5 h-5" />
                    <span className="font-semibold">Test</span>
                </Link>
            </div>

            {/* Cards header */}
            <div className="px-4 flex items-center justify-between mb-4">
                <h2 className="text-lg font-display font-bold">Cards</h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setReorderMode(!reorderMode)}
                        className={`flex items-center gap-1.5 font-semibold text-sm ${reorderMode ? 'text-claude-accent' : 'text-claude-secondary'}`}
                    >
                        <GripVertical className="w-4 h-4" /> {reorderMode ? 'Done' : 'Reorder'}
                    </button>
                    <button
                        onClick={() => setShowBulkImport(true)}
                        className="flex items-center gap-1.5 text-claude-secondary font-semibold text-sm"
                    >
                        <FileText className="w-4 h-4" /> Import
                    </button>
                    <button
                        onClick={() => setShowAddCard(true)}
                        className="flex items-center gap-1.5 text-claude-accent font-semibold text-sm"
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>
            </div>

            {/* Bulk Import Modal */}
            {showBulkImport && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowBulkImport(false);
                    }}
                >
                    <form
                        onSubmit={handleBulkImport}
                        className="bg-claude-surface w-full p-6 rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[80vh] flex flex-col overflow-y-auto overscroll-contain touch-pan-y"
                        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-display font-bold">Import Cards</h3>
                            <button type="button" onClick={() => setShowBulkImport(false)} className="p-2 -mr-2 active:bg-claude-bg rounded-full">
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
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowAddCard(false);
                    }}
                >
                    <form
                        onSubmit={handleAddCard}
                        className="bg-claude-surface w-full p-6 rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
                        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-display font-bold">New Card</h3>
                            <button type="button" onClick={() => setShowAddCard(false)} className="p-2 -mr-2 active:bg-claude-bg rounded-full">
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
                                <CardImageUpload
                                    label="Front Image (optional)"
                                    value={newCard.front_image}
                                    onChange={(img) => setNewCard({ ...newCard, front_image: img })}
                                    className="mt-3"
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
                                <CardImageUpload
                                    label="Back Image (optional)"
                                    value={newCard.back_image}
                                    onChange={(img) => setNewCard({ ...newCard, back_image: img })}
                                    className="mt-3"
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
                            className={`botanical-card paper-texture text-botanical-ink p-4 transition-transform duration-200 ${swipedCard === card.id ? '-translate-x-20' : 'translate-x-0'
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
                                    <CardImageUpload
                                        label="Front Image"
                                        value={editCardData.front_image}
                                        onChange={(img) => setEditCardData({ ...editCardData, front_image: img })}
                                    />
                                    <textarea
                                        value={editCardData.back}
                                        onChange={e => setEditCardData({ ...editCardData, back: e.target.value })}
                                        className="w-full px-3 py-2 bg-claude-bg border border-claude-border rounded-xl outline-none focus:border-claude-accent resize-none text-sm"
                                        rows={2}
                                    />
                                    <CardImageUpload
                                        label="Back Image"
                                        value={editCardData.back_image}
                                        onChange={(img) => setEditCardData({ ...editCardData, back_image: img })}
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
                                    <span className="text-botanical-forest font-display font-bold text-sm">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm mb-1">{card.front}</p>
                                        <p className="text-botanical-ink/70 text-sm">{card.back}</p>
                                    </div>
                                    <GripVertical className="w-5 h-5 text-botanical-ink/50 shrink-0" />
                                </div>
                            ) : (
                                <div className="flex gap-3" onClick={() => handleEditCard(card)}>
                                    <span className="text-botanical-forest font-display font-bold text-sm mt-0.5">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm mb-1">
                                            {card.front}
                                            {(card.front_image || card.back_image) && (
                                                <span className="ml-2 text-xs text-claude-accent">📷</span>
                                            )}
                                        </p>
                                        <p className="text-botanical-ink/70 text-sm">{card.back}</p>
                                    </div>
                                    <Pencil className="w-4 h-4 text-botanical-ink/50 shrink-0 mt-1" />
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

            {/* Share Modal */}
            <AnimatePresence>
                {showShareModal && (
                    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowShareModal(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative botanical-card paper-texture text-botanical-ink w-full sm:max-w-md max-h-[85dvh] overflow-hidden flex flex-col rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl touch-pan-y"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6 pb-2 shrink-0">
                                <div className="sm:hidden w-12 h-1.5 bg-botanical-forest/30 rounded-full mx-auto -mt-2 mb-4" />
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-2xl font-display font-bold">Share Deck</h3>
                                    <button onClick={() => setShowShareModal(false)} className="p-2 -mr-2 active:bg-botanical-forest/10 rounded-full">
                                        <X className="w-6 h-6 text-botanical-ink/60" />
                                    </button>
                                </div>
                                <p className="text-botanical-sepia font-mono text-sm leading-relaxed mb-4">
                                    Select a friend to send "{deck.title}" to directly.
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
                                {friends.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-botanical-sepia font-mono text-sm">You have no friends yet.</p>
                                        <Link to="/friends" className="text-botanical-forest hover:underline font-mono text-xs mt-2 inline-block">Find Friends</Link>
                                    </div>
                                ) : (
                                    friends.map(friend => (
                                        <div key={friend.id} className="flex items-center justify-between p-3 bg-botanical-forest/5 rounded-xl border border-botanical-forest/10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-botanical-forest/20 flex items-center justify-center font-display font-bold text-botanical-forest">
                                                    {friend.username.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-display font-semibold">{friend.username}</span>
                                            </div>
                                            <button
                                                onClick={() => handleSendDeckToFriend(friend.id)}
                                                disabled={sharingTo === friend.id}
                                                className="px-4 py-2 bg-botanical-forest text-white rounded-lg font-mono text-xs font-medium disabled:opacity-50"
                                            >
                                                {sharingTo === friend.id ? 'Sending...' : 'Send'}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
