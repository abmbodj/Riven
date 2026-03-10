import React, { useEffect, useState, useRef, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, BookOpen, Trash2, Plus, X, ArrowLeft, Pencil, Check, Folder, Calendar, Hash, FileText, Copy, Download, BarChart3, ChevronUp, ChevronDown, Share2, GripVertical } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import CardImageUpload from '../components/CardImageUpload';
import gsap from 'gsap';
import { EASE, DURATION, STAGGER } from '../utils/animations';

export default function DeckView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { isLoggedIn } = useAuth();
    const [deck, setDeck] = useState(null);
    const [folders, setFolders] = useState([]);
    const [classes, setClasses] = useState([]);
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
    const [reorderMode, setReorderMode] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [friends, setFriends] = useState([]);
    const [sharingTo, setSharingTo] = useState(null);
    const [exporting, setExporting] = useState(false);
    const touchStartX = useRef(0);
    const deckPageRef = useRef(null);

    // GSAP staggered card reveal on load
    useEffect(() => {
        if (loading || !deck || !deckPageRef.current) return;
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) return;

        const cards = deckPageRef.current.querySelectorAll('.gsap-deck-card-item');
        if (cards.length === 0) return;

        gsap.from(cards, {
            y: 20,
            opacity: 0,
            duration: DURATION.normal,
            stagger: STAGGER.tight,
            ease: EASE.organic,
            delay: 0.1,
            clearProps: 'transform',
        });
    }, [loading, deck]);

    const loadDeck = useCallback(() => {
        api.getDeck(id)
            .then(data => {
                setDeck(data);
                setEditDeckData({
                    title: data.title,
                    description: data.description || '',
                    folder_id: data.folder_id,
                    class_id: data.class_id,
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
        Promise.all([
            api.getFolders().catch(() => []),
            api.getClasses().catch(() => []),
            api.getTags().catch(() => [])
        ]).then(([f, c, t]) => {
            setFolders(f);
            setClasses(c);
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
        if (exporting) return;
        setExporting(true);
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
        } catch {
            toast.error('Failed to export deck');
        } finally {
            setExporting(false);
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
            const results = await Promise.allSettled(cards.map(card => api.addCard(id, card.front, card.back)));
            const succeeded = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) {
                toast.error(`${succeeded} cards added, ${failed} failed`);
            } else {
                toast.success(`Added ${succeeded} cards!`);
            }
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
            await api.updateDeck(id, editDeckData.title, editDeckData.description, editDeckData.folder_id, editDeckData.tagIds, editDeckData.class_id);
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
    const currentClass = classes.find(c => c.id === deck?.class_id);
    const statTiles = [
        { label: 'Cards', value: deck?.cards?.length || 0 },
        { label: 'Tags', value: deck?.tags?.length || 0 },
        { label: 'Folder', value: currentFolder ? '1' : '0' },
        { label: 'Class', value: currentClass ? '1' : '0' },
    ];

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
        <div ref={deckPageRef} className="animate-in fade-in duration-500">
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
                            className="fixed inset-0 bg-black/60 md:backdrop-blur-sm"
                            onClick={() => setShowStats(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative glass-panel paper-texture text-botanical-ink w-full sm:max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-md md:shadow-2xl touch-pan-y"
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

            {/* Elegant Header Area */}
            <div className="px-4 mb-6 pt-4 relative">
                <div className="flex items-center justify-between mb-4">
                    <Link to="/" className="p-2 -ml-2 text-claude-secondary hover:text-claude-text active:scale-95 transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                </div>

                <div className="xl:hidden flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    <button onClick={() => setEditingDeck(true)} className="flex items-center gap-2 px-3.5 py-2 glass-panel border border-claude-border/30 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest text-[#7a9e72] hover:bg-[#7a9e72]/10 transition-colors whitespace-nowrap active:scale-95">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={handleShareDeck} className="flex items-center gap-2 px-3.5 py-2 glass-panel border border-claude-border/30 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary hover:text-claude-text transition-colors whitespace-nowrap active:scale-95">
                        <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                    <button onClick={loadStats} className="flex items-center gap-2 px-3.5 py-2 glass-panel border border-claude-border/30 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary hover:text-claude-text transition-colors whitespace-nowrap active:scale-95">
                        <BarChart3 className="w-3.5 h-3.5" /> Stats
                    </button>
                    <button onClick={handleDuplicate} className="flex items-center gap-2 px-3.5 py-2 glass-panel border border-claude-border/30 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary hover:text-claude-text transition-colors whitespace-nowrap active:scale-95">
                        <Copy className="w-3.5 h-3.5" /> Dup
                    </button>
                    <button onClick={() => handleExport('json')} className="flex items-center gap-2 px-3.5 py-2 glass-panel border border-claude-border/30 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary hover:text-claude-text transition-colors whitespace-nowrap active:scale-95">
                        <Download className="w-3.5 h-3.5" /> Export
                    </button>
                    <button onClick={() => setDeleteConfirm({ show: true, type: 'deck', id: id })} className="flex items-center gap-2 px-3.5 py-2 glass-panel border border-red-500/20 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors whitespace-nowrap active:scale-95">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                </div>

                {editingDeck ? (
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={editDeckData.title}
                            onChange={e => setEditDeckData({ ...editDeckData, title: e.target.value })}
                            className="w-full text-2xl font-display font-bold glass-panel rounded-xl px-4 py-3 outline-none focus:border-claude-accent"
                            autoFocus
                        />
                        <textarea
                            value={editDeckData.description}
                            onChange={e => setEditDeckData({ ...editDeckData, description: e.target.value })}
                            className="w-full glass-panel rounded-xl px-4 py-3 outline-none focus:border-claude-accent resize-none"
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

                        {/* Class selector */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Class</label>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setEditDeckData({ ...editDeckData, class_id: null })}
                                    className={`px-3 py-2 rounded-lg text-sm ${!editDeckData.class_id ? 'bg-claude-accent text-white' : 'bg-claude-bg border border-claude-border'}`}
                                >
                                    None
                                </button>
                                {classes.map(cls => (
                                    <button
                                        key={cls.id}
                                        type="button"
                                        onClick={() => setEditDeckData({ ...editDeckData, class_id: cls.id })}
                                        className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 ${editDeckData.class_id === cls.id ? 'text-white' : 'bg-claude-bg border border-claude-border'}`}
                                        style={editDeckData.class_id === cls.id ? { backgroundColor: cls.color || '#7a9e72' } : {}}
                                    >
                                        <Calendar className="w-4 h-4" style={editDeckData.class_id !== cls.id ? { color: cls.color || '#7a9e72' } : {}} />
                                        {cls.name}
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
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                            {classes.find(c => c.id === deck?.class_id) && (
                                <span className="px-2 py-0.5 rounded-sm border shadow-sm flex items-center gap-1.5"
                                    style={{
                                        borderColor: `${classes.find(c => c.id === deck?.class_id).color}40`,
                                        backgroundColor: `${classes.find(c => c.id === deck?.class_id).color}10`,
                                        color: classes.find(c => c.id === deck?.class_id).color
                                    }}>
                                    <Calendar className="w-3 h-3" />
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider">{classes.find(c => c.id === deck?.class_id).name}</span>
                                </span>
                            )}
                            {currentFolder && (
                                <span className="px-2 py-0.5 rounded-sm border border-[#e8e4d8] bg-[#f4f1e8] shadow-sm flex items-center gap-1.5">
                                    <Folder className="w-3 h-3" style={{ color: currentFolder.color }} />
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: currentFolder.color }}>{currentFolder.name}</span>
                                </span>
                            )}
                            {deck.tags?.map(tag => (
                                <span
                                    key={tag.id}
                                    className="px-2 py-0.5 rounded-sm border bg-current/5 flex items-center gap-1"
                                    style={{ color: tag.color, borderColor: `${tag.color}40` }}
                                >
                                    <Hash className="w-2.5 h-2.5" />
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider">{tag.name}</span>
                                </span>
                            ))}
                        </div>

                        <h1 className="text-4xl sm:text-5xl font-serif font-bold italic text-botanical-parchment tracking-tight leading-[1.1] mb-5">{deck.title}</h1>

                        {deck.description && (
                            <p className="text-claude-secondary text-sm md:text-base font-serif italic mb-6 border-l-2 border-claude-border/40 pl-4">{deck.description}</p>
                        )}

                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {statTiles.map((tile) => (
                                <div key={tile.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                    <div className="font-mono text-lg font-bold text-botanical-parchment">{tile.value}</div>
                                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-claude-secondary">{tile.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_340px]">
                <div className="min-w-0">
                    <div className="px-4 mb-6">
                        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(22,39,45,0.96),rgba(17,29,35,0.96))] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.16)]">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-botanical-sepia">Deck Workbench</p>
                                    <h2 className="font-serif text-2xl font-bold italic text-botanical-parchment">
                                        {deck.cards.length > 0 ? 'Study paths and card editing stay in one place.' : 'Start by adding cards, then move straight into study.'}
                                    </h2>
                                    <p className="max-w-2xl text-sm text-claude-secondary">
                                        {deck.cards.length > 0
                                            ? `${deck.cards.length} cards are ready. Use study mode for recall, test mode for pressure, or edit the deck structure without leaving the page.`
                                            : 'This deck has no cards yet. Import a batch or add the first card manually to turn it into a working set.'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Link
                                        to={deck.cards.length > 0 ? `/deck/${id}/study` : '#'}
                                        onClick={e => {
                                            if (deck.cards.length === 0) {
                                                e.preventDefault();
                                                toast.error('Add some cards first');
                                            }
                                        }}
                                        className={`relative group overflow-hidden px-5 py-3 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 tap-action ${deck.cards.length > 0
                                            ? 'bg-[#7a9e72] text-white shadow-[0_8px_32px_rgba(122,158,114,0.25)] hover:shadow-[0_8px_32px_rgba(122,158,114,0.4)] hover:-translate-y-1'
                                            : 'bg-[#7a9e72]/30 text-white/50 cursor-not-allowed border border-[#7a9e72]/10'
                                            }`}
                                    >
                                        <BookOpen className="w-5 h-5" strokeWidth={2.5} />
                                        <span className="font-mono text-sm font-bold uppercase tracking-widest">Study Now</span>
                                    </Link>
                                    <Link
                                        to={deck.cards.length >= 4 ? `/deck/${id}/test` : '#'}
                                        onClick={e => {
                                            if (deck.cards.length < 4) {
                                                e.preventDefault();
                                                toast.error('Need 4+ cards for test mode');
                                            }
                                        }}
                                        className={`relative group overflow-hidden px-5 py-3 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 tap-action border ${deck.cards.length >= 4
                                            ? 'bg-[#1a1c1d]/40 border-claude-accent/20 text-claude-accent shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:bg-[#1a1c1d]/60 hover:border-claude-accent/40 hover:-translate-y-1'
                                            : 'bg-claude-surface/30 border-claude-border/20 text-claude-secondary cursor-not-allowed'
                                            }`}
                                    >
                                        <Play className="w-5 h-5" strokeWidth={2.5} />
                                        <span className="font-mono text-sm font-bold uppercase tracking-widest">Test Mode</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cards header */}
                    <div className="px-4 flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 bg-[#f4f1e8] text-[#8a7f6a] text-[10px] font-mono font-bold uppercase tracking-widest rounded-sm border border-[#e8e4d8] shadow-sm">{deck.cards.length}</span>
                            <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]">Cards</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setReorderMode(!reorderMode)}
                                className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-[10px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center gap-2 ${reorderMode ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary hover:text-claude-text'}`}
                            >
                                <GripVertical className="w-4 h-4" /> <span className="hidden sm:inline">{reorderMode ? 'Done' : 'Reorder'}</span>
                            </button>
                            <button
                                onClick={() => setShowBulkImport(true)}
                                className="p-2 sm:px-3 sm:py-2 rounded-xl glass-panel border border-claude-border text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary hover:text-claude-text transition-colors flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">Import</span>
                            </button>
                            <button
                                onClick={() => setShowAddCard(true)}
                                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-claude-accent text-white border border-claude-accent text-[10px] font-mono font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-botanical flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" strokeWidth={3} /> <span className="hidden sm:inline">Add</span>
                            </button>
                        </div>
                    </div>
                    {/* Cards list with swipe to delete */}
                    <div className="px-4 space-y-3">
                        {deck.cards.length > 0 && (
                            <p className="text-xs text-claude-secondary text-center mb-2">Swipe left on a card to delete</p>
                        )}
                        {deck.cards.map((card, idx) => (
                            <div
                                key={card.id}
                                className="relative overflow-hidden rounded-2xl gsap-deck-card-item"
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

                                {/* Card Body */}
                                <div className={`relative bg-[#fcfaf2] border border-[#d1c9b8] p-5 transition-transform duration-300 z-10 custom-shadow ${swipedCard === card.id ? '-translate-x-24' : 'translate-x-0'}`}>
                                    {/* Subtle paper grain */}
                                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

                                    {editingCard === card.id ? (
                                        <div className="space-y-4 relative z-10">
                                            <textarea
                                                value={editCardData.front}
                                                onChange={e => setEditCardData({ ...editCardData, front: e.target.value })}
                                                className="w-full px-4 py-3 bg-[#f4f1e8] border border-[#d1c9b8] rounded-xl outline-none focus:border-claude-accent resize-none text-sm font-serif text-botanical-ink"
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
                                                className="w-full px-4 py-3 bg-[#f4f1e8] border border-[#d1c9b8] rounded-xl outline-none focus:border-claude-accent resize-none text-sm font-serif text-botanical-ink"
                                                rows={2}
                                            />
                                            <CardImageUpload
                                                label="Back Image"
                                                value={editCardData.back_image}
                                                onChange={(img) => setEditCardData({ ...editCardData, back_image: img })}
                                            />
                                            <div className="flex gap-3">
                                                <button onClick={() => handleSaveCard(card.id)} className="claude-button-primary flex-1 py-3 text-sm">
                                                    Save Edits
                                                </button>
                                                <button onClick={() => setEditingCard(null)} className="claude-button-secondary py-3 px-6 text-sm bg-white/50">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : reorderMode ? (
                                        <div className="flex items-center gap-4 relative z-10 bg-white/40 rounded-xl p-2 -m-2">
                                            <div className="flex flex-col gap-1 items-center bg-claude-bg/50 rounded-lg p-1 border border-claude-border/30">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleMoveCard(card.id, 'up'); }}
                                                    disabled={idx === 0}
                                                    className="p-1.5 text-claude-secondary hover:text-claude-accent disabled:opacity-30 disabled:hover:text-claude-secondary transition-colors rounded-md active:bg-black/5"
                                                >
                                                    <ChevronUp className="w-5 h-5" />
                                                </button>
                                                <div className="w-4 h-px bg-claude-border/50" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleMoveCard(card.id, 'down'); }}
                                                    disabled={idx === deck.cards.length - 1}
                                                    className="p-1.5 text-claude-secondary hover:text-claude-accent disabled:opacity-30 disabled:hover:text-claude-secondary transition-colors rounded-md active:bg-black/5"
                                                >
                                                    <ChevronDown className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <span className="font-serif italic text-claude-accent font-bold text-lg leading-none w-6 text-center">{idx + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-serif text-lg text-botanical-ink leading-snug break-words mb-1 line-clamp-1">{card.front}</p>
                                                <p className="font-serif text-md text-botanical-ink/60 leading-snug break-words line-clamp-1">{card.back}</p>
                                            </div>
                                            <GripVertical className="w-6 h-6 text-botanical-ink/30 shrink-0 cursor-grab" />
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 relative z-10" onClick={() => handleEditCard(card)}>
                                            <div className="shrink-0 flex flex-col items-center gap-2">
                                                <span className="font-serif italic text-claude-accent font-bold text-lg leading-none">{idx + 1}</span>
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col gap-3">
                                                <div>
                                                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#8a7f6a] mb-1.5">Front</h4>
                                                    <p className="font-serif text-lg text-botanical-ink leading-snug break-words">
                                                        {card.front}
                                                        {card.front_image && <span className="inline-block ml-2 text-xs opacity-50">🖼️</span>}
                                                    </p>
                                                </div>
                                                <div className="w-8 h-px bg-[#d1c9b8]/60" />
                                                <div>
                                                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#8a7f6a] mb-1.5">Back</h4>
                                                    <p className="font-serif text-lg text-botanical-ink/80 leading-snug break-words">
                                                        {card.back}
                                                        {card.back_image && <span className="inline-block ml-2 text-xs opacity-50">🖼️</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <button className="shrink-0 p-2 -mr-2 text-claude-secondary/50 hover:text-claude-accent transition-colors h-fit rounded-full hover:bg-black/5">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {deck.cards.length === 0 && (
                            <div className="text-center py-16 px-4 bg-[#fcfaf2]/50 border-2 border-dashed border-[#d1c9b8] rounded-sm">
                                <BookOpen className="w-10 h-10 text-claude-secondary/30 mx-auto mb-4" />
                                <h3 className="font-serif italic text-xl text-botanical-ink/50 mb-2">No Cards Yet</h3>
                                <p className="text-[11px] font-mono uppercase tracking-widest text-[#8a7f6a]">Tap "Add" to begin your collection</p>
                            </div>
                        )}
                    </div>
                </div>

                <aside className="hidden xl:block xl:pr-4">
                    <div className="sticky top-24 space-y-4">
                        <div className="glass-panel rounded-[28px] p-5">
                            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-claude-secondary">Deck Context</p>
                            <div className="mt-4 space-y-3">
                                {currentClass ? (
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">Class</div>
                                        <div className="mt-2 flex items-center gap-2" style={{ color: currentClass.color || '#7a9e72' }}>
                                            <Calendar className="w-4 h-4" />
                                            <span className="font-serif text-lg font-bold">{currentClass.name}</span>
                                        </div>
                                    </div>
                                ) : null}
                                {currentFolder ? (
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">Folder</div>
                                        <div className="mt-2 flex items-center gap-2" style={{ color: currentFolder.color }}>
                                            <Folder className="w-4 h-4" />
                                            <span className="font-serif text-lg font-bold">{currentFolder.name}</span>
                                        </div>
                                    </div>
                                ) : null}
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                    <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">Tags</div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {deck.tags?.length > 0 ? deck.tags.map(tag => (
                                            <span
                                                key={tag.id}
                                                className="px-2 py-1 rounded-full border bg-current/5 flex items-center gap-1"
                                                style={{ color: tag.color, borderColor: `${tag.color}40` }}
                                            >
                                                <Hash className="w-2.5 h-2.5" />
                                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider">{tag.name}</span>
                                            </span>
                                        )) : (
                                            <span className="text-sm text-claude-secondary">No tags linked</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel rounded-[28px] p-5">
                            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-claude-secondary">Deck Tools</p>
                            <div className="mt-4 grid gap-2">
                                <button onClick={() => setEditingDeck(true)} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-botanical-parchment hover:border-claude-accent/20">
                                    <Pencil className="w-4 h-4 text-[#7a9e72]" /> <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Edit deck</span>
                                </button>
                                <button onClick={handleShareDeck} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-botanical-parchment hover:border-claude-accent/20">
                                    <Share2 className="w-4 h-4 text-claude-secondary" /> <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Share</span>
                                </button>
                                <button onClick={loadStats} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-botanical-parchment hover:border-claude-accent/20">
                                    <BarChart3 className="w-4 h-4 text-claude-secondary" /> <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Stats</span>
                                </button>
                                <button onClick={handleDuplicate} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-botanical-parchment hover:border-claude-accent/20">
                                    <Copy className="w-4 h-4 text-claude-secondary" /> <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Duplicate</span>
                                </button>
                                <button onClick={() => handleExport('json')} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-botanical-parchment hover:border-claude-accent/20">
                                    <Download className="w-4 h-4 text-claude-secondary" /> <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Export JSON</span>
                                </button>
                                <button onClick={() => setDeleteConfirm({ show: true, type: 'deck', id: id })} className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-left text-red-400 hover:bg-red-500/10">
                                    <Trash2 className="w-4 h-4" /> <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Delete deck</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Bulk Import Modal */}
            {
                showBulkImport && (
                    <div
                        className="fixed inset-0 bg-black/60 md:backdrop-blur-sm z-[60] flex items-end"
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
                )
            }

            {/* Add card modal */}
            {
                showAddCard && (
                    <div
                        className="fixed inset-0 bg-black/60 md:backdrop-blur-sm z-[60] flex items-end"
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
                )
            }

            {/* Share Modal */}
            <AnimatePresence>
                {showShareModal && (
                    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 md:backdrop-blur-sm"
                            onClick={() => setShowShareModal(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative glass-panel paper-texture text-botanical-ink w-full sm:max-w-md max-h-[85dvh] overflow-hidden flex flex-col rounded-t-[2.5rem] sm:rounded-3xl shadow-md md:shadow-2xl touch-pan-y"
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
        </div >
    );
}
