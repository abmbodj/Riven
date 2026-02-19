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
            initial={{ opacity: 0, y: 20, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.8 : 0.8 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, scale: 1.01, transition: { duration: 0.3, ease: [0.33, 1, 0.68, 0.9] } }}
            transition={{ delay: (index % 10) * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative tap-action"
        >
            {/* Specimen Tape/Pin Accent */}
            <div className="absolute -top-1 left-1/4 w-10 h-3 bg-[#e8e4d8] rotate-[-2deg] rounded-sm z-10 shadow-sm opacity-80 backdrop-blur-sm pointer-events-none" />
            <div className="absolute -top-1 right-1/4 w-4 h-4 bg-[#d1c9b8]/40 rotate-[15deg] rounded-full z-10 shadow-sm flex items-center justify-center pointer-events-none">
                <div className="w-1 h-1 bg-claude-secondary/40 rounded-full" />
            </div>

            <Link to={`/deck/${deck.id}`} className="group relative block bg-[#fcfaf2] border border-[#d1c9b8] p-5 sm:p-6 pt-7 sm:pt-8 rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] active:shadow-inner active:bg-[#f4f1e8] transition-all duration-300 overflow-hidden active:scale-[0.97] touch-target">
                {/* Subtle paper grain and texture */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 opacity-70">
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-[#8a7f6a] hidden xs:inline">№{deck.id?.toString().slice(-6) || '000000'}</span>
                        <div className="h-px flex-1 bg-[#d1c9b8]/40" />
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-[#8a7f6a] italic">Collected: {new Date(deck.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                    </div>

                    <div className="flex items-start gap-3 sm:gap-4">
                        <div
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 border border-current/10 shadow-inner"
                            style={{
                                backgroundColor: folderColor + '0d',
                                color: folderColor
                            }}
                        >
                            <Layers className="w-5 h-5 sm:w-6 sm:h-6 opacity-60" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-serif text-lg sm:text-2xl font-bold text-[#1a1c1d] leading-[1.1] group-hover:text-claude-accent transition-colors duration-300 italic mb-2 tracking-tight line-clamp-2">{deck.title}</h3>

                            <div className="flex items-center gap-2 flex-wrap mt-auto">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#f4f1e8] rounded-sm border border-[#e8e4d8] shadow-sm">
                                    <span className="font-mono text-[8px] sm:text-[9px] font-bold text-[#5d6466] uppercase tracking-wider">{deck.cardCount} Cards</span>
                                </div>

                                {deck.tags?.length > 0 && (
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        {deck.tags.slice(0, 2).map(tag => (
                                            <span key={tag.id} className="text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border border-current/20 bg-current/5 whitespace-nowrap" style={{ color: tag.color }}>
                                                {tag.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Archival Stamp Background */}
                <div className="absolute -bottom-4 -right-4 opacity-[0.03] sm:opacity-[0.04] transition-opacity duration-700 pointer-events-none group-active:opacity-[0.08] transform origin-center scale-[1.2] sm:scale-150">
                    <Sparkles className="w-24 h-24 sm:w-32 sm:h-32" />
                </div>
            </Link>
        </motion.div>
    );
});
DeckCard.displayName = 'DeckCard';

// Compact Garden Pill — Reduced vertical footprint
const GardenHero = memo(() => {
    const { isLoggedIn } = useContext(AuthContext);
    const streak = useStreak();
    const stage = getGardenStage(streak.currentStreak);

    if (!isLoggedIn) return null;

    return (
        <Link to="/garden" className="block mb-4 -mx-2 px-2 tap-action">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-xl overflow-hidden py-3 px-4 flex items-center gap-4 bg-claude-surface/30 border border-claude-accent/20 backdrop-blur-md active:scale-[0.98] transition-all shadow-sm"
            >
                <div className="shrink-0 scale-75 origin-center -m-2">
                    <Garden
                        streak={streak.currentStreak}
                        status={streak.status}
                        size="sm"
                        showInfo={false}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#8fa6a8] font-bold">Observer Log</span>
                        <span className="font-mono text-[8px] font-bold text-claude-accent uppercase">{streak.currentStreak}d Growth</span>
                    </div>
                    <h2 className="font-serif text-lg font-bold italic leading-none text-[#e4ddd0] tracking-tight truncate">{stage.name}</h2>
                </div>
                <ChevronRight className="w-4 h-4 text-claude-accent/40" />
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

            {/* Header — Tighter vertical footprint */}
            <div className="mb-6 pt-2 px-1">
                <div className="flex items-end justify-between mb-4 pb-4 border-b-2 border-[#d1c9b8]/20">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-1.5 py-0.5 bg-claude-accent text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Collection</span>
                            <p className="font-mono text-[8px] sm:text-[10px] uppercase tracking-[0.4em] text-[#8fa6a8] opacity-80 font-bold">Archives</p>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-serif font-bold italic text-botanical-parchment tracking-tighter">Catalogue</h1>
                    </div>
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="touch-target text-[#8fa6a8] hover:text-claude-accent transition-colors disabled:opacity-50 mb-1 active:rotate-180 duration-500 tap-action"
                    >
                        <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Search bar — hidden on mobile if bottom bar is active, but kept for desktop */}
                <div className="hidden md:block relative group max-w-2xl">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none">
                        <Search className="w-5 h-5 text-[#8fa6a8] group-focus-within:text-claude-accent transition-colors" />
                        <div className="w-px h-4 bg-[#8fa6a8]/20" />
                        <span className="font-mono text-[10px] text-[#8fa6a8]/40 uppercase tracking-[0.2em] hidden sm:inline font-bold">Catalog search:</span>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Find specimen by name..."
                        className="w-full pl-12 sm:pl-48 pr-12 py-4 bg-[#1e3840]/30 border-2 border-[#233e46] rounded-xl focus:border-claude-accent/40 focus:bg-[#1e3840]/50 outline-none transition-all font-mono text-sm placeholder:text-[#8fa6a8]/20 text-botanical-parchment shadow-inner backdrop-blur-md"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                        <Hash className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Folders Section — Styled as Catalog Tabs */}
            <div className="mb-10">
                <div className="flex items-baseline justify-between mb-5 px-1">
                    <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/60 flex items-center gap-2">
                        <div className="w-4 h-px bg-current opacity-30" /> Index / Folders
                    </h2>
                    <button
                        onClick={() => { setShowFolderModal(true); setNewFolder({ name: '', color: '#6366f1' }); }}
                        className="text-claude-accent text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform group p-2 -mr-2 active:bg-claude-accent/5 rounded-lg tap-action"
                    >
                        <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" /> Add Entry
                    </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide">
                    <button
                        onClick={() => setActiveFolder(null)}
                        className={`shrink-0 px-5 sm:px-6 py-3 rounded-xl transition-all active:scale-95 border-2 min-h-[48px] ${activeFolder === null ? 'bg-claude-accent text-botanical-ink border-claude-accent shadow-botanical-glow' : 'bg-[#1e3840]/40 border-[#233e46] text-[#8fa6a8] hover:border-[#8fa6a8]/30 hover:bg-[#1e3840]/60'}`}
                    >
                        <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.1em]">All Decks</span>
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
                            className={`shrink-0 px-5 sm:px-6 py-3 rounded-xl transition-all active:scale-95 border-2 flex items-center gap-3 min-h-[48px] ${activeFolder === folder.id ? 'shadow-botanical-glow ring-2 ring-offset-2 ring-offset-claude-bg translate-y-[-2px]' : 'bg-[#1e3840]/40 border-[#233e46] text-[#8fa6a8] hover:border-[#8fa6a8]/30 hover:bg-[#1e3840]/60'}`}
                            style={activeFolder === folder.id ? { backgroundColor: folder.color, borderColor: folder.color, color: 'white', ringColor: folder.color } : {}}
                        >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeFolder === folder.id ? 'white' : folder.color }} />
                            <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.1em]">{folder.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tags Section — Styled as Pinned Labels */}
            {tags.length > 0 && (
                <div className="mb-10 last:mb-20 sm:last:mb-10">
                    <div className="flex items-baseline justify-between mb-5 px-1">
                        <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/60 flex items-center gap-2">
                            <div className="w-4 h-px bg-current opacity-30" /> Taxonomy / Tags
                        </h2>
                        <button
                            onClick={() => setShowTagModal(true)}
                            className="text-claude-accent text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform group p-2 -mr-2 active:bg-claude-accent/5 rounded-lg tap-action"
                        >
                            <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" /> Define Tag
                        </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide">
                        {tags.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
                                className={`shrink-0 px-4 sm:px-5 py-2 rounded-lg transition-all active:scale-95 border-2 min-h-[40px] flex items-center ${activeTag === tag.id ? 'bg-botanical-parchment text-botanical-ink border-botanical-parchment' : 'bg-[#1e3840]/40 border-[#233e46] text-[#8fa6a8] hover:border-[#8fa6a8]/30'}`}
                                style={activeTag === tag.id ? {} : { borderLeft: `4px solid ${tag.color}` }}
                            >
                                <span className="font-mono text-[9px] sm:text-[10px] font-bold tracking-widest uppercase">{tag.name}</span>
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

            {/* Decks List — Staggered grid layout */}
            <div className="pb-12 sm:pb-0">
                <div className="flex items-end justify-between mb-8 px-1">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/60">
                            Archive Results
                        </h2>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-serif italic text-botanical-parchment">{filteredDecks.length}</span>
                            <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-[#8fa6a8]/40">Specimens tracked</span>
                        </div>
                    </div>
                    <div className="relative group/sort">
                        <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-[#1e3840]/40 border border-[#233e46] rounded-lg text-[#8fa6a8] text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest hover:border-claude-accent/30 transition-all shadow-sm active:scale-95 tap-action"
                        >
                            <span className="hidden xs:inline">Sequence:</span> {SORT_OPTIONS.find(o => o.id === sortBy)?.label} <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {showSortMenu && (
                            <>
                                <div className="fixed inset-0 z-[70] sm:z-10 bg-black/20 sm:bg-transparent backdrop-blur-[2px] sm:backdrop-blur-none" onClick={() => setShowSortMenu(false)} />
                                <div className="fixed sm:absolute bottom-0 sm:bottom-auto right-0 sm:top-full left-0 sm:left-auto mt-0 sm:mt-2 bg-claude-surface border-t sm:border border-claude-border rounded-t-3xl sm:rounded-xl shadow-botanical-lg overflow-hidden z-[80] sm:z-20 min-w-[180px] animate-in slide-in-from-bottom sm:slide-in-from-top-2 sm:fade-in sm:zoom-in-95 duration-300 sm:duration-200">
                                    <div className="px-6 py-4 border-b border-claude-border bg-claude-bg/50 sm:hidden">
                                        <div className="w-10 h-1 bg-claude-border rounded-full mx-auto mb-4" />
                                        <span className="text-xs font-mono font-bold uppercase tracking-widest text-claude-text">Sort Collection</span>
                                    </div>
                                    <div className="px-4 py-3 border-b border-claude-border bg-claude-bg/50 hidden sm:block">
                                        <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-claude-secondary">Select ordering</span>
                                    </div>
                                    <div className="p-2 sm:p-0 flex flex-col gap-1 sm:gap-0">
                                        {SORT_OPTIONS.map(option => (
                                            <button
                                                key={option.id}
                                                onClick={() => { setSortBy(option.id); setShowSortMenu(false); }}
                                                className={`w-full px-5 py-4 flex items-center gap-4 text-[11px] sm:text-[10px] font-mono font-bold uppercase tracking-widest text-left transition-colors active:bg-claude-accent/20 rounded-xl sm:rounded-none ${sortBy === option.id ? 'bg-claude-accent/10 text-claude-accent' : 'text-claude-text hover:bg-claude-bg'}`}
                                            >
                                                <option.icon className="w-4 h-4 opacity-70" />
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="h-safe-bottom sm:hidden" />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {filteredDecks.length === 0 ? (
                    <div className="text-center py-20 sm:py-24 bg-[#1e3840]/20 border-2 border-dashed border-[#233e46] rounded-3xl mx-1">
                        {decks.length === 0 ? (
                            <>
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-claude-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-claude-accent/20">
                                    <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-claude-accent opacity-50" />
                                </div>
                                <h3 className="font-serif italic text-xl sm:text-2xl text-botanical-parchment mb-2">The archive is empty</h3>
                                <p className="text-[#8fa6a8] text-xs sm:text-sm mb-6 sm:mb-8 font-serif italic px-6">No botanical specimens have been identified yet.</p>
                                <Link to="/create" className="claude-button-primary inline-flex tap-action">Begin Collection</Link>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#233e46]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Search className="w-8 h-8 sm:w-10 sm:h-10 text-[#8fa6a8] opacity-30" />
                                </div>
                                <h3 className="font-serif italic text-xl sm:text-2xl text-[#8fa6a8] mb-2">No matches found</h3>
                                <p className="text-[#8fa6a8]/60 text-xs sm:text-sm font-serif italic">Try adjusting your taxonomy filters</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pb-20 sm:pb-10 px-1">
                        {filteredDecks.map((deck, i) => (
                            <DeckCard key={deck.id} deck={deck} folders={folders} index={i} />
                        ))}
                    </div>
                )}
            </div>

            {/* Mobile Sticky Command Bar — THUMB ZONE ergonomics */}
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden overflow-visible">
                <div className="bg-[#162a31]/95 backdrop-blur-2xl border-t border-[#233e46] px-4 pt-3 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
                    <div className="flex items-center gap-3">
                        {/* Search Input — Integrated Feedback */}
                        <div className="relative flex-1">
                            {searchQuery ? (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-claude-accent tap-action z-10"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            ) : (
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8fa6a8]" />
                            )}
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={activeFolder ? 'Filtering by folder...' : 'Search archive...'}
                                className={`w-full bg-[#1e3840]/60 border rounded-full pl-9 pr-4 py-3 text-sm font-mono outline-none transition-all tap-action ${searchQuery ? 'border-claude-accent/50 text-claude-parchment' : 'border-[#233e46] text-claude-parchment'}`}
                            />
                        </div>

                        {/* Quick Access Actions */}
                        <Link
                            to="/create"
                            className="bg-claude-accent text-botanical-ink w-12 h-12 rounded-full flex items-center justify-center shadow-botanical-glow active:scale-95 transition-transform tap-action"
                        >
                            <Plus className="w-6 h-6" />
                        </Link>
                    </div>
                </div>
            </div>

            <div className="h-8 hidden md:block" />
        </div>
    );
}
