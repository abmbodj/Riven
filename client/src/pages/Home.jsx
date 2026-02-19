import React, { useEffect, useState, useCallback, useMemo, memo, useContext } from 'react';
import { Link } from 'react-router-dom';
import {
    Layers, ChevronRight, RefreshCw, Sparkles, Folder,
    X, Plus, Search, FolderOpen, Hash, SlidersHorizontal, ArrowDownAZ, Calendar, Hash as HashIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import GlobalMessages from '../components/GlobalMessages';
import Garden from '../components/Garden';
import { useStreak } from '../hooks/useStreak';
import { getGardenStage } from '../utils/gardenCustomization';
import { AuthContext } from '../context/AuthContext';

const FOLDER_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6'
];

const SORT_OPTIONS = [
    { id: 'newest', label: 'Newest', icon: Calendar },
    { id: 'oldest', label: 'Oldest', icon: Calendar },
    { id: 'alphabetical', label: 'A-Z', icon: ArrowDownAZ },
    { id: 'cards', label: 'Most Cards', icon: HashIcon },
];

// Memoized deck card with botanical styling
// Memoized deck card with Herbarium Specimen styling
const DeckCard = memo(({ deck, folders, index }) => {
    const folder = deck.folder_id ? folders.find(f => f.id === deck.folder_id) : null;
    const folderColor = folder?.color || '#7a9e72';

    return (
        <motion.div
            initial={{ opacity: 0, y: 15, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
            animate={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -1 : 1 }}
            transition={{ delay: index * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
        >
            {/* Specimen Tape/Pin Accent */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-3 bg-claude-accent/20 rotate-1 rounded-sm z-10 backdrop-blur-sm" />

            <Link to={`/deck/${deck.id}`} className="group relative block bg-[#fefdfa] border border-[#d1c9b8] p-5 pt-7 rounded-sm shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-claude-accent/40 transition-all duration-500 overflow-hidden active:scale-[0.99]">
                {/* Subtle pressed paper texture effect using CSS */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

                <div className="flex items-start gap-4">
                    <div
                        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border border-current/10"
                        style={{
                            backgroundColor: folderColor + '08',
                            color: folderColor
                        }}
                    >
                        <Layers className="w-5 h-5 opacity-80" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[9px] uppercase tracking-widest text-[#8a7f6a]">Specimen №{deck.id?.toString().slice(-4) || '000'}</span>
                            <div className="h-px flex-1 bg-[#d1c9b8]/30" />
                        </div>
                        <h3 className="font-serif text-xl font-medium text-[#2d3436] leading-tight group-hover:text-claude-accent transition-colors duration-300 italic">{deck.title}</h3>

                        <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#f4f1e8] rounded-sm border border-[#e8e4d8]">
                                <span className="font-mono text-[10px] text-[#5d6466]">{deck.cardCount} cards</span>
                            </div>

                            {deck.tags?.length > 0 && (
                                <div className="flex items-center gap-1">
                                    {deck.tags.slice(0, 2).map(tag => (
                                        <span key={tag.id} className="text-[10px] font-mono border-b border-current opacity-70" style={{ color: tag.color }}>
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stamp-like accent */}
                <div className="absolute bottom-2 right-2 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-500">
                    <Sparkles className="w-10 h-10 -rotate-12" />
                </div>
            </Link>
        </motion.div>
    );
});
DeckCard.displayName = 'DeckCard';

// Garden hero — overlaps into header area
const GardenHero = memo(() => {
    const { isLoggedIn } = useContext(AuthContext);
    const streak = useStreak();
    const stage = getGardenStage(streak.currentStreak);

    // Don't show garden hero when not logged in
    if (!isLoggedIn) return null;

    return (
        <Link to="/garden" className="block mb-2 -mx-4 px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="relative rounded-2xl overflow-hidden p-5"
                style={{
                    background: 'linear-gradient(145deg, rgba(122,158,114,0.12) 0%, rgba(222,185,106,0.04) 60%, transparent 100%)',
                    border: '1px solid rgba(122,158,114,0.15)',
                }}
            >
                {/* Decorative corner marks */}
                <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-claude-accent/20 rounded-tl" />
                <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-claude-accent/20 rounded-br" />

                <div className="flex items-center gap-5">
                    <div className="shrink-0 relative">
                        <Garden
                            streak={streak.currentStreak}
                            status={streak.status}
                            size="sm"
                            showInfo={false}
                        />
                        <div className="absolute -inset-1 border border-claude-accent/20 rounded-full animate-[spin_10s_linear_infinite] pointer-events-none" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#8a7f6a] mb-1">Archive Entry</p>
                        <h2 className="font-serif text-2xl font-bold italic leading-tight mb-0.5 text-[#2d3436] tracking-tight">{stage.name}</h2>
                        <p className="font-serif text-sm italic text-[#5d6466] line-clamp-1">{stage.description}</p>
                        <div className="flex items-center gap-3 mt-3">
                            <span className="font-mono text-[10px] text-claude-accent bg-claude-accent/10 px-2 py-0.5 rounded-sm">{streak.currentStreak}d streak</span>
                            {streak.status === 'at-risk' && (
                                <span className="font-mono text-[9px] text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-sm border border-yellow-200/50">⚠ {Math.round(streak.hoursRemaining)}h left</span>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
});
GardenHero.displayName = 'GardenHero';

export default function Home() {
    const toast = useToast();
    const [decks, setDecks] = useState([]);
    const [folders, setFolders] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [showOnboarding, setShowOnboarding] = useState(false);

    // View state
    const [activeFolder, setActiveFolder] = useState(null);
    const [activeTag, setActiveTag] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest'); // newest, oldest, alphabetical, cards
    const [showSortMenu, setShowSortMenu] = useState(false);

    // Modals
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: null, item: null });

    // Form state
    const [newFolder, setNewFolder] = useState({ name: '', color: '#6366f1' });
    const [newTag, setNewTag] = useState({ name: '', color: '#3b82f6' });

    const folderColors = FOLDER_COLORS;

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        console.log('[Home] loadData called', { isRefresh });

        try {
            // Load all data in parallel for speed
            console.log('[Home] Fetching decks, folders, tags...');
            const [decksData, foldersData, tagsData] = await Promise.all([
                api.getDecks(),
                api.getFolders(),
                api.getTags()
            ]);

            console.log('[Home] Data loaded:', {
                decks: decksData?.length,
                folders: foldersData?.length,
                tags: tagsData?.length
            });

            setDecks(decksData);
            setFolders(foldersData);
            setTags(tagsData);
            setError(null);

            if (decksData.length === 0 && foldersData.length === 0 && !localStorage.getItem('riven_onboarded')) {
                console.log('[Home] Showing onboarding');
                setShowOnboarding(true);
            }
        } catch (err) {
            console.error('[Home] Failed to load data:', err);
            const errorMessage = err?.message || 'Failed to load data';
            setError(errorMessage);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const dismissOnboarding = () => {
        localStorage.setItem('riven_onboarded', 'true');
        setShowOnboarding(false);
    };

    // Filter and sort decks
    const filteredDecks = useMemo(() => decks
        .filter(deck => {
            if (activeFolder !== null) {
                if (activeFolder === 'unfiled' && deck.folder_id !== null) return false;
                if (activeFolder !== 'unfiled' && deck.folder_id !== activeFolder) return false;
            }
            if (activeTag !== null) {
                if (!deck.tags?.some(t => t.id === activeTag)) return false;
            }
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return deck.title.toLowerCase().includes(q) || deck.description?.toLowerCase().includes(q);
            }
            return true;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'alphabetical':
                    return a.title.localeCompare(b.title);
                case 'cards':
                    return b.cardCount - a.cardCount;
                case 'newest':
                default:
                    return new Date(b.created_at) - new Date(a.created_at);
            }
        }), [decks, activeFolder, activeTag, searchQuery, sortBy]);

    // Folder actions
    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolder.name.trim()) return;
        try {
            if (editingFolder) {
                await api.updateFolder(editingFolder.id, newFolder.name, newFolder.color);
                toast.success('Folder updated');
            } else {
                await api.createFolder(newFolder.name, newFolder.color);
                toast.success('Folder created');
            }
            setShowFolderModal(false);
            setEditingFolder(null);
            setNewFolder({ name: '', color: '#6366f1' });
            loadData();
        } catch (err) {
            const errorMessage = err?.message || 'Failed to save folder';
            toast.error(errorMessage);
        }
    };

    const handleDeleteFolder = async () => {
        try {
            await api.deleteFolder(deleteConfirm.item.id);
            toast.success('Folder deleted');
            if (activeFolder === deleteConfirm.item.id) setActiveFolder(null);
            loadData();
        } catch (err) {
            const errorMessage = err?.message || 'Failed to delete folder';
            toast.error(errorMessage);
        }
    };

    // Tag actions
    const handleCreateTag = async (e) => {
        e.preventDefault();
        if (!newTag.name.trim()) return;
        try {
            await api.createTag(newTag.name, newTag.color);
            toast.success('Tag created');
            setShowTagModal(false);
            setNewTag({ name: '', color: '#3b82f6' });
            loadData();
        } catch (err) {
            const errorMessage = err?.message || 'Failed to create tag';
            toast.error(errorMessage);
        }
    };

    const handleDeleteTag = async () => {
        try {
            await api.deleteTag(deleteConfirm.item.id);
            toast.success('Tag deleted');
            if (activeTag === deleteConfirm.item.id) setActiveTag(null);
            loadData();
        } catch (err) {
            const errorMessage = err?.message || 'Failed to delete tag';
            toast.error(errorMessage);
        }
    };

    if (loading) return (
        <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 w-24 bg-claude-border rounded-full animate-pulse shrink-0" />
                ))}
            </div>
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
                <p className="font-medium mb-4">Couldn't load your library</p>
                <button onClick={() => loadData(true)} className="claude-button-primary bg-red-500 text-white">
                    Try Again
                </button>
            </div>
        </div>
    );

    return (
        <div>
            {/* Global broadcast messages */}
            <GlobalMessages />

            {/* Delete confirmation modal */}
            <ConfirmModal
                isOpen={deleteConfirm.show}
                title={`Delete ${deleteConfirm.type}?`}
                message={deleteConfirm.type === 'folder'
                    ? 'Decks inside will be moved to your library.'
                    : 'This tag will be removed from all decks.'}
                onConfirm={() => {
                    if (deleteConfirm.type === 'folder') handleDeleteFolder();
                    else handleDeleteTag();
                    setDeleteConfirm({ show: false, type: null, item: null });
                }}
                onCancel={() => setDeleteConfirm({ show: false, type: null, item: null })}
            />

            {/* Onboarding modal */}
            {showOnboarding && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
                    style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)' }}
                >
                    <div className="bg-claude-surface w-full max-w-sm max-h-[80vh] overflow-y-auto overscroll-contain rounded-3xl p-8 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-claude-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-display font-bold mb-3">Welcome to Riven!</h2>
                        <p className="text-claude-secondary mb-6 leading-relaxed">
                            Create flashcard decks, organize with folders, and tag them for easy filtering.
                        </p>
                        <div className="space-y-3">
                            <Link to="/create" onClick={dismissOnboarding} className="claude-button-primary w-full py-4 block">
                                Create Your First Deck
                            </Link>
                            <button onClick={dismissOnboarding} className="text-claude-secondary font-medium text-sm">
                                Maybe Later
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Folder Modal */}
            {showFolderModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowFolderModal(false);
                            setEditingFolder(null);
                        }
                    }}
                >
                    <form
                        onSubmit={handleCreateFolder}
                        className="bg-claude-surface w-full p-6 rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
                        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-display font-bold">{editingFolder ? 'Edit Folder' : 'New Folder'}</h3>
                            <button type="button" onClick={() => { setShowFolderModal(false); setEditingFolder(null); }} className="p-2 -mr-2 active:bg-claude-bg rounded-full">
                                <X className="w-6 h-6 text-claude-secondary" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Name</label>
                                <input
                                    type="text"
                                    value={newFolder.name}
                                    onChange={e => setNewFolder({ ...newFolder, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                                    placeholder="e.g., School, Work"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {folderColors.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewFolder({ ...newFolder, color })}
                                            className={`w-10 h-10 rounded-xl transition-transform ${newFolder.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-claude-surface scale-110' : ''}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            {editingFolder && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowFolderModal(false);
                                        setDeleteConfirm({ show: true, type: 'folder', item: editingFolder });
                                    }}
                                    className="w-full py-3 text-red-500 font-medium"
                                >
                                    Delete Folder
                                </button>
                            )}
                            <button type="submit" className="w-full claude-button-primary py-4">
                                {editingFolder ? 'Save Changes' : 'Create Folder'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tag Modal */}
            {showTagModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowTagModal(false);
                    }}
                >
                    <form
                        onSubmit={handleCreateTag}
                        className="bg-claude-surface w-full p-6 rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
                        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-display font-bold">New Tag</h3>
                            <button type="button" onClick={() => setShowTagModal(false)} className="p-2 -mr-2 active:bg-claude-bg rounded-full">
                                <X className="w-6 h-6 text-claude-secondary" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Name</label>
                                <input
                                    type="text"
                                    value={newTag.name}
                                    onChange={e => setNewTag({ ...newTag, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-claude-bg border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                                    placeholder="e.g., Important, Review"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {folderColors.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewTag({ ...newTag, color })}
                                            className={`w-10 h-10 rounded-xl transition-transform ${newTag.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-claude-surface scale-110' : ''}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <button type="submit" className="w-full claude-button-primary py-4">Create Tag</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Garden Hero — overlapping into header */}
            <GardenHero />

            {/* Header */}
            <div className="mb-8 pt-2">
                <div className="flex items-end justify-between mb-6 pb-2 border-b border-[#d1c9b8]/40">
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#8a7f6a] mb-1 opacity-60">Personal Collection</p>
                        <h1 className="text-4xl font-serif font-bold italic text-[#2d3436]">Library</h1>
                    </div>
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="touch-target text-[#8a7f6a] hover:text-claude-accent transition-colors disabled:opacity-50 mb-1"
                    >
                        <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Search bar — styled as a catalog search */}
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        <Search className="w-4 h-4 text-[#8a7f6a] group-focus-within:text-claude-accent transition-colors" />
                        <span className="font-mono text-[10px] text-[#8a7f6a]/40 uppercase tracking-widest hidden sm:inline">Search Catalogue:</span>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Filter by title or tag..."
                        className="w-full pl-12 sm:pl-36 pr-4 py-3 bg-[#fefdfa] border border-[#d1c9b8] rounded-sm focus:border-claude-accent outline-none transition-all font-mono text-xs placeholder:text-[#8a7f6a]/30 shadow-inner"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                        <Hash className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Folders Section — Styled as Catalog Tabs */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#5d6466] flex items-center gap-2">
                        <FolderOpen className="w-3 h-3" /> Index / Folders
                    </h2>
                    <button
                        onClick={() => { setShowFolderModal(true); setNewFolder({ name: '', color: '#6366f1' }); }}
                        className="text-claude-accent text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1 hover:underline active:scale-95 transition-transform"
                    >
                        <Plus className="w-3 h-3" /> New Entry
                    </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                    <button
                        onClick={() => setActiveFolder(null)}
                        className={`shrink-0 px-5 py-2.5 rounded-sm transition-all active:scale-95 border ${activeFolder === null ? 'bg-[#2d3436] text-[#fefdfa] border-[#2d3436] shadow-md' : 'bg-[#fefdfa] border-[#d1c9b8] text-[#5d6466]'}`}
                    >
                        <span className="font-mono text-[11px] font-bold uppercase tracking-widest">General</span>
                    </button>

                    {folders.map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => setActiveFolder(activeFolder === folder.id ? null : folder.id)}
                            onDoubleClick={(e) => {
                                e.preventDefault();
                                setEditingFolder(folder);
                                setNewFolder({ name: folder.name, color: folder.color });
                                setShowFolderModal(true);
                            }}
                            className={`shrink-0 px-5 py-2.5 rounded-sm transition-all active:scale-95 border ${activeFolder === folder.id ? 'shadow-md ring-1 ring-offset-2' : 'bg-[#fefdfa] border-[#d1c9b8] text-[#5d6466]'}`}
                            style={activeFolder === folder.id ? { backgroundColor: folder.color, borderColor: folder.color, color: 'white', ringColor: folder.color } : {}}
                        >
                            <span className="font-mono text-[11px] font-bold uppercase tracking-widest">{folder.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tags Section — Styled as Pinned Labels */}
            {tags.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#5d6466] flex items-center gap-2">
                            <Hash className="w-3 h-3" /> Taxonomy / Tags
                        </h2>
                        <button
                            onClick={() => setShowTagModal(true)}
                            className="text-claude-accent text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1 hover:underline active:scale-95 transition-transform"
                        >
                            <Plus className="w-3 h-3" /> New Tag
                        </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                        {tags.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
                                className={`shrink-0 px-4 py-1.5 rounded-sm transition-all active:scale-95 border-b-2 ${activeTag === tag.id ? 'bg-[#2d3436] text-[#fefdfa] border-[#2d3436]' : 'bg-[#fefdfa] border-[#d1c9b8]/40 hover:border-claude-accent/40'}`}
                                style={activeTag === tag.id ? {} : { borderBottomColor: tag.color }}
                            >
                                <span className="font-mono text-[10px] font-medium tracking-wider">{tag.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Filters — Styled as Catalogue Tags */}
            {(activeFolder !== null || activeTag !== null || searchQuery) && (
                <div className="mb-6 flex items-center gap-2 flex-wrap px-1">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[#8a7f6a]">Active Filters:</span>
                    {activeFolder !== null && (
                        <span className="px-2.5 py-1 bg-[#f4f1e8] border border-[#d1c9b8] rounded-sm text-[10px] font-mono flex items-center gap-2 text-[#2d3436]">
                            <Folder className="w-2.5 h-2.5 opacity-60" />
                            {activeFolder === 'unfiled' ? 'Unfiled' : folders.find(f => f.id === activeFolder)?.name}
                            <button onClick={() => setActiveFolder(null)} className="hover:text-red-500 transition-colors"><X className="w-2.5 h-2.5" /></button>
                        </span>
                    )}
                    {activeTag !== null && (
                        <span className="px-2.5 py-1 bg-[#f4f1e8] border border-[#d1c9b8] rounded-sm text-[10px] font-mono flex items-center gap-2 text-[#2d3436]">
                            <Hash className="w-2.5 h-2.5 opacity-60" />
                            {tags.find(t => t.id === activeTag)?.name}
                            <button onClick={() => setActiveTag(null)} className="hover:text-red-500 transition-colors"><X className="w-2.5 h-2.5" /></button>
                        </span>
                    )}
                    {searchQuery && (
                        <span className="px-2.5 py-1 bg-[#f4f1e8] border border-[#d1c9b8] rounded-sm text-[10px] font-mono flex items-center gap-2 text-[#2d3436]">
                            <Search className="w-2.5 h-2.5 opacity-60" />"{searchQuery}"
                            <button onClick={() => setSearchQuery('')} className="hover:text-red-500 transition-colors"><X className="w-2.5 h-2.5" /></button>
                        </span>
                    )}
                    <button onClick={() => { setActiveFolder(null); setActiveTag(null); setSearchQuery(''); }} className="text-[10px] font-mono font-bold uppercase tracking-widest text-claude-accent hover:underline ml-2">
                        Reset All
                    </button>
                </div>
            )}

            {/* Decks List — Staggered archive layout */}
            <div>
                <div className="flex items-center justify-between mb-5 px-1">
                    <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#5d6466]">
                        Collection / {filteredDecks.length} Items
                    </h2>
                    <div className="relative">
                        <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="flex items-center gap-2 text-[#8a7f6a] text-[10px] font-mono font-bold uppercase tracking-widest touch-target hover:text-claude-accent transition-colors"
                        >
                            Sort <SlidersHorizontal className="w-3 h-3" />
                        </button>
                        {showSortMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                                <div className="absolute right-0 top-full mt-2 bg-[#fefdfa] border border-[#d1c9b8] rounded-sm shadow-xl overflow-hidden z-20 min-w-[150px] animate-in fade-in zoom-in-95 duration-200">
                                    {SORT_OPTIONS.map(option => (
                                        <button
                                            key={option.id}
                                            onClick={() => { setSortBy(option.id); setShowSortMenu(false); }}
                                            className={`w-full px-4 py-3 flex items-center gap-3 text-[10px] font-mono font-bold uppercase tracking-widest text-left active:bg-[#f4f1e8] ${sortBy === option.id ? 'bg-claude-accent/10 text-claude-accent' : 'text-[#2d3436]'}`}
                                        >
                                            <option.icon className="w-3.5 h-3.5" />
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {filteredDecks.length === 0 ? (
                    <div className="text-center py-12 bg-claude-surface border border-claude-border rounded-2xl">
                        {decks.length === 0 ? (
                            <>
                                <div className="text-5xl mb-4">📚</div>
                                <h3 className="font-display font-bold text-lg mb-2">No Decks Yet</h3>
                                <p className="text-claude-secondary text-sm mb-4">Create your first deck to get started</p>
                                <Link to="/create" className="claude-button-primary inline-block px-6 py-3">Create Deck</Link>
                            </>
                        ) : (
                            <>
                                <div className="text-5xl mb-4">🔍</div>
                                <h3 className="font-display font-bold text-lg mb-2">No Matches</h3>
                                <p className="text-claude-secondary text-sm">Try adjusting your filters</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredDecks.map((deck, i) => (
                            <DeckCard key={deck.id} deck={deck} folders={folders} index={i} />
                        ))}
                    </div>
                )}
            </div>

            <div className="h-8" />
        </div>
    );
}
