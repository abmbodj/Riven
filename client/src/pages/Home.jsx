import React, { useEffect, useState, useCallback, useMemo, memo, useContext } from 'react';
import { Link } from 'react-router-dom';
import {
    Layers, ChevronRight, RefreshCw, Sparkles, Folder,
    X, Plus, Search, FolderOpen, Hash, SlidersHorizontal, ArrowDownAZ, Calendar, Hash as HashIcon,
    Menu, Filter, Library, Leaf
} from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
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
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-[#8a7f6a] hidden xs:inline">ID:{deck.id?.toString().slice(-6) || '000000'}</span>
                        <div className="h-px flex-1 bg-[#d1c9b8]/40" />
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-[#8a7f6a] italic">Created: {new Date(deck.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
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

// Compact Garden Pill — High-density inline integration
const GardenHero = memo(() => {
    const { isLoggedIn } = useContext(AuthContext);
    const streak = useStreak();
    const stage = getGardenStage(streak.currentStreak);

    if (!isLoggedIn) return null;

    return (
        <Link to="/garden" className="block tap-action group hover:z-10 relative">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, type: 'spring' }}
                className="relative w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-[#fcfaf2] border border-[#d1c9b8] rounded-xl sm:rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden flex items-end justify-center transform-style-3d group-hover:-translate-y-1 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] active:scale-95 transition-all duration-300"
            >
                {/* Paper Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

                {/* Inner Archival Frame */}
                <div className="absolute inset-[3px] border border-dashed border-[#d1c9b8]/60 pointer-events-none rounded-lg sm:rounded-[10px]" />

                {/* Vintage tape corner */}
                <div className="absolute -top-1 -right-2 w-6 h-2 bg-[#e8e4d8] rotate-[35deg] shadow-sm z-20" />

                {/* The Plant */}
                <div className="relative z-10 scale-[0.4] sm:scale-[0.5] origin-bottom translate-y-3">
                    <Garden
                        streak={streak.currentStreak}
                        status={streak.status}
                        size="sm"
                        showInfo={false}
                    />
                </div>

                {/* Stage Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1e3840] text-[#8fa6a8] border border-[#233e46] rounded-md px-2 py-1 pointer-events-none whitespace-nowrap z-50 shadow-xl flex items-center gap-1.5">
                    <Leaf className="w-2.5 h-2.5 text-claude-accent" />
                    <span className="font-mono text-[8px] font-bold uppercase tracking-[0.1em]">{stage.name}</span>
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
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Modals
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: null, item: null });

    // Form state
    const [newFolder, setNewFolder] = useState({ name: '', color: '#6366f1' });
    const [newTag, setNewTag] = useState({ name: '', color: '#3b82f6' });

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
                {[1, 2, 3].map((_, idx) => (
                    <div key={idx} className="h-10 w-24 bg-claude-border rounded-full animate-pulse shrink-0" />
                ))}
            </div>
            {[1, 2, 3].map((_, idx) => (
                <div key={idx} className="claude-card p-4 flex items-center gap-4 animate-pulse">
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
        <div className="relative min-h-screen pb-24">
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

            {/* Genius Menu Drawer */}
            <AnimatePresence>
                {isMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="fixed inset-0 bg-[#0d1a1f]/80 backdrop-blur-md z-[60]"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 h-[85dvh] bg-[#162a31] border-t border-[#233e46] z-[70] shadow-2xl overflow-y-auto rounded-t-[3rem]"
                        >
                            <div className="sticky top-0 right-0 left-0 bg-[#162a31]/80 backdrop-blur-md z-10 px-8 py-4 flex items-center justify-between border-b border-[#233e46]/30">
                                <div className="w-12 h-1.5 bg-[#233e46] rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
                                <h2 className="font-serif text-2xl font-bold italic text-botanical-parchment">Library Menu</h2>
                                <button onClick={() => setIsMenuOpen(false)} className="p-3 -mr-3 text-[#8fa6a8] hover:text-claude-accent tap-action">
                                    <X className="w-7 h-7" />
                                </button>
                            </div>
                            <div className="p-8 pb-safe">

                                {/* Folders in Menu */}
                                <div className="mb-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/60">Folders</h3>
                                        <button onClick={() => { setShowFolderModal(true); setNewFolder({ name: '', color: '#6366f1' }); }} className="text-claude-accent text-[10px] font-mono font-bold uppercase tracking-widest">+ New</button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        <button
                                            onClick={() => { setActiveFolder(null); setIsMenuOpen(false); }}
                                            className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${activeFolder === null ? 'bg-claude-accent/20 border-claude-accent/40 text-claude-accent' : 'bg-[#1e3840]/40 border-[#233e46] text-[#8fa6a8]'}`}
                                        >
                                            <Library className="w-4 h-4" />
                                            <span className="font-mono text-xs font-bold uppercase tracking-wider">All Decks</span>
                                        </button>
                                        {folders.map(folder => (
                                            <button
                                                key={folder.id}
                                                onClick={() => { setActiveFolder(activeFolder === folder.id ? null : folder.id); setIsMenuOpen(false); }}
                                                className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${activeFolder === folder.id ? 'bg-white/10 border-white/20' : 'bg-[#1e3840]/40 border-[#233e46] text-[#8fa6a8]'}`}
                                                style={activeFolder === folder.id ? { borderColor: folder.color, color: folder.color, backgroundColor: folder.color + '15' } : {}}
                                            >
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color }} />
                                                <span className="font-mono text-xs font-bold uppercase tracking-wider truncate">{folder.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tags in Menu */}
                                <div className="mb-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/60">Tags</h3>
                                        <button onClick={() => setShowTagModal(true)} className="text-claude-accent text-[10px] font-mono font-bold uppercase tracking-widest">+ New</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => { setActiveTag(activeTag === tag.id ? null : tag.id); setIsMenuOpen(false); }}
                                                className={`px-3 py-2 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${activeTag === tag.id ? 'bg-white/10 border-white/20' : 'bg-[#1e3840]/40 border-[#233e46] text-[#8fa6a8]'}`}
                                                style={activeTag === tag.id ? { color: tag.color, borderColor: tag.color, backgroundColor: tag.color + '15' } : {}}
                                            >
                                                # {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Spotlight Search Overlay */}
            <AnimatePresence>
                {isSearchOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[100] bg-[#0d1a1f]/95 backdrop-blur-2xl p-6 pt-safe flex flex-col"
                    >
                        <div className="flex items-center gap-4 mb-8">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-accent" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search decks..."
                                    className="w-full bg-[#1e3840]/60 border-2 border-claude-accent/30 rounded-2xl pl-12 pr-4 py-4 text-lg font-mono text-claude-parchment outline-none focus:border-claude-accent"
                                />
                            </div>
                            <button
                                onClick={() => setIsSearchOpen(false)}
                                className="p-3 bg-white/5 rounded-2xl text-[#8fa6a8] hover:text-claude-accent transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {searchQuery && (
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/40 px-2">Results for "{searchQuery}"</h3>
                                    {filteredDecks.length === 0 ? (
                                        <div className="py-12 text-center text-[#8fa6a8]/40 italic font-serif">No matching decks found</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {filteredDecks.map((deck) => (
                                                <Link key={deck.id} to={`/deck/${deck.id}`} onClick={() => setIsSearchOpen(false)} className="block p-4 bg-[#1e3840]/30 border border-[#233e46] rounded-xl">
                                                    <h4 className="font-serif text-lg font-bold text-botanical-parchment mb-1">{deck.title}</h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-claude-accent uppercase">{deck.cardCount} Cards</span>
                                                        <span className="text-[10px] font-mono text-[#8fa6a8]/40">•</span>
                                                        <span className="text-[10px] font-mono text-[#8fa6a8]/60 truncate">{deck.description || 'No description'}</span>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header Area */}
            <div className="mb-6 pt-4 px-1 flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                        <span className="px-1.5 py-0.5 bg-claude-accent text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Library</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-serif font-bold italic text-botanical-parchment tracking-tighter leading-none">Decks</h1>
                </div>
                <div className="flex items-center gap-2">
                    <GardenHero />
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-[#1e3840]/40 border border-[#233e46] rounded-xl sm:rounded-2xl text-[#8fa6a8] hover:text-claude-accent transition-all tap-action disabled:opacity-50 flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Quick Actions Bar — Thumb-reachable controls */}
            <div className="sticky top-safe z-30 mb-8 py-2 -mx-4 px-4 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex-1 flex items-center gap-3 p-3 bg-[#1e3840]/40 border border-[#233e46] rounded-2xl text-[#8fa6a8] hover:text-claude-accent transition-all tap-action"
                    >
                        <Search className="w-5 h-5 opacity-60 ml-1" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Search collection...</span>
                    </button>
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className={`p-3.5 border rounded-2xl transition-all tap-action ${activeFolder || activeTag ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'bg-[#1e3840]/40 border-[#233e46] text-[#8fa6a8]'}`}
                    >
                        {activeFolder || activeTag ? <Filter className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Active Filter Pill — Sub-header */}
            {(activeFolder !== null || activeTag !== null) && (
                <div className="px-1 mb-8">
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-claude-accent/5 border border-claude-accent/20 rounded-full">
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent/60 font-bold">Scope:</span>
                        <span className="text-[11px] font-serif italic text-botanical-parchment">
                            {activeFolder ? (activeFolder === 'unfiled' ? 'Unfiled Decks' : folders.find(f => f.id === activeFolder)?.name) : tags.find(t => t.id === activeTag)?.name}
                        </span>
                        <button onClick={() => { setActiveFolder(null); setActiveTag(null); }} className="text-claude-accent hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Decks Collection — THE PRIMARY FOCUS */}
            <div className="space-y-6 px-1">
                <div className="flex items-baseline justify-between mb-2">
                    <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/60 flex items-center gap-2">
                        <div className="w-4 h-px bg-current opacity-30" /> Your Decks
                    </h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] hover:text-claude-accent transition-colors flex items-center gap-1.5 tap-action"
                        >
                            {SORT_OPTIONS.find(o => o.id === sortBy)?.label} <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {showSortMenu && (
                            <div className="relative">
                                <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" onClick={() => setShowSortMenu(false)} />
                                <div className="fixed bottom-0 left-0 right-0 bg-[#162a31] border-t border-[#233e46] rounded-t-3xl z-[80] p-4 pb-safe animate-in slide-in-from-bottom duration-300">
                                    <div className="w-12 h-1 bg-[#233e46] rounded-full mx-auto mb-6" />
                                    <div className="space-y-2">
                                        {SORT_OPTIONS.map(option => (
                                            <button
                                                key={option.id}
                                                onClick={() => { setSortBy(option.id); setShowSortMenu(false); }}
                                                className={`w-full p-4 rounded-xl flex items-center gap-4 font-mono text-xs font-bold uppercase tracking-widest transition-all ${sortBy === option.id ? 'bg-claude-accent/20 text-claude-accent' : 'bg-[#1e3840]/40 text-[#8fa6a8]'}`}
                                            >
                                                <option.icon className="w-4 h-4" />
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {filteredDecks.length === 0 ? (
                    <div className="text-center py-16 bg-[#1e3840]/10 border-2 border-dashed border-[#233e46]/20 rounded-3xl">
                        {decks.length === 0 ? (
                            <>
                                <Sparkles className="w-12 h-12 text-claude-accent opacity-20 mx-auto mb-4" />
                                <h3 className="font-serif italic text-xl text-botanical-parchment opacity-40">No Decks</h3>
                                <p className="text-[#8fa6a8]/60 text-[10px] font-mono uppercase tracking-widest mt-2 px-8">Your deck collection is empty. Create your first deck below.</p>
                            </>
                        ) : (
                            <div className="py-12">
                                <Search className="w-12 h-12 text-[#8fa6a8] opacity-10 mx-auto mb-4" />
                                <p className="text-[#8fa6a8]/40 italic font-serif">No matches for current scope</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pb-20 px-1">
                        {filteredDecks.map((deck, i) => (
                            <DeckCard key={deck.id} deck={deck} folders={folders} index={i} />
                        ))}
                    </div>
                )}
            </div>


            {/* Onboarding modal — Kept but positioned normally */}
            {showOnboarding && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200] flex items-center justify-center p-6">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#162a31] border border-[#233e46] w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl">
                        <div className="w-20 h-20 bg-claude-accent/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-claude-accent/30">
                            <Sparkles className="w-10 h-10 text-claude-accent" />
                        </div>
                        <h2 className="text-3xl font-serif italic font-bold text-botanical-parchment mb-4 leading-tight">Welcome</h2>
                        <p className="text-[#8fa6a8] mb-8 font-serif italic text-lg leading-relaxed">
                            Create your first deck to get started.
                        </p>
                        <div className="space-y-4">
                            <Link to="/create" onClick={dismissOnboarding} className="claude-button-primary w-full py-4 block text-lg">
                                Create My First Deck
                            </Link>
                            <button onClick={dismissOnboarding} className="text-[#8fa6a8] font-mono text-[10px] uppercase tracking-widest font-bold">
                                Dismiss for now
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Modals for Folders/Tags — These remain as they are triggered from the Drawer */}
            <AnimatePresence>
                {showFolderModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFolderModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleCreateFolder}
                            className="relative bg-[#162a31] w-full p-8 rounded-t-[3rem] border-t border-[#233e46] pb-safe"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">{editingFolder ? 'Edit Folder' : 'New Folder'}</h3>
                                <button type="button" onClick={() => setShowFolderModal(false)} className="p-2 text-[#8fa6a8]"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Label Name</label>
                                    <input
                                        type="text"
                                        value={newFolder.name}
                                        onChange={e => setNewFolder({ ...newFolder, name: e.target.value })}
                                        className="w-full bg-[#1e3840]/40 border-2 border-[#233e46] rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none"
                                        placeholder="e.g. Science"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                                    {FOLDER_COLORS.map(color => (
                                        <button key={color} type="button" onClick={() => setNewFolder({ ...newFolder, color })} className={`w-10 h-10 rounded-xl flex-shrink-0 transition-all ${newFolder.color === color ? 'ring-2 ring-white ring-offset-4 ring-offset-[#162a31] scale-110' : 'opacity-40'}`} style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                                <button type="submit" className="claude-button-primary w-full py-5 text-lg">Save Folder</button>
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showTagModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTagModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleCreateTag}
                            className="relative bg-[#162a31] w-full p-8 rounded-t-[3rem] border-t border-[#233e46] pb-safe"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">Create Tag</h3>
                                <button type="button" onClick={() => setShowTagModal(false)} className="p-2 text-[#8fa6a8]"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Tag Label</label>
                                    <input
                                        type="text"
                                        value={newTag.name}
                                        onChange={e => setNewTag({ ...newTag, name: e.target.value })}
                                        className="w-full bg-[#1e3840]/40 border-2 border-[#233e46] rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none"
                                        placeholder="e.g. IMPORTANT"
                                    />
                                </div>
                                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                                    {FOLDER_COLORS.map(color => (
                                        <button key={color} type="button" onClick={() => setNewTag({ ...newTag, color })} className={`w-10 h-10 rounded-xl flex-shrink-0 transition-all ${newTag.color === color ? 'ring-2 ring-white ring-offset-4 ring-offset-[#162a31] scale-110' : 'opacity-40'}`} style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                                <button type="submit" className="claude-button-primary w-full py-5 text-lg">Save Tag</button>
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
