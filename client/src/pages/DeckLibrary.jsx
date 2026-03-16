import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import {
    Layers, ChevronLeft, ChevronRight, RefreshCw, Sparkles, Folder,
    X, Plus, Search, SlidersHorizontal, ArrowDownAZ, Calendar, Hash as HashIcon,
    Menu, Filter, Library
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import GlobalMessages from '../components/GlobalMessages';
import OnboardingArt from '../components/OnboardingArt';
import { folderNameSchema, tagNameSchema } from '../schemas/forms';



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
const DeckCard = memo(({ deck, folders, classes, index }) => {
    const folder = deck.folder_id ? folders.find(f => f.id === deck.folder_id) : null;
    const folderColor = folder?.color || 'var(--accent-color)';

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
            <div className="absolute -top-1 left-1/4 w-10 h-3 bg-claude-border/60 rotate-[-2deg] rounded-sm z-10 shadow-sm opacity-80 md:backdrop-blur-sm pointer-events-none" />
            <div className="absolute -top-1 right-1/4 w-4 h-4 bg-claude-border/40 rotate-[15deg] rounded-full z-10 shadow-sm flex items-center justify-center pointer-events-none">
                <div className="w-1 h-1 bg-claude-secondary/40 rounded-full" />
            </div>

            <Link
                to={`/deck/${deck.id}`}
                className="group relative block bg-claude-surface border border-claude-border p-5 sm:p-6 pt-7 sm:pt-8 rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] active:shadow-inner active:bg-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 overflow-hidden active:scale-[0.97] touch-target"
            >
                {/* Subtle paper grain and texture */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />
                <div className="absolute inset-0 bg-gradient-to-br from-claude-text/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 opacity-70">
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-claude-secondary hidden xs:inline">ID:{deck.id?.toString().slice(-6) || '000000'}</span>
                        <div className="h-px flex-1 bg-claude-border/40" />
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-claude-secondary italic">Created: {new Date(deck.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
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
                            <h3 className="font-serif text-lg sm:text-2xl font-bold text-claude-text leading-[1.1] group-hover:text-claude-accent transition-colors duration-300 italic mb-2 tracking-tight line-clamp-2">{deck.title}</h3>

                            <div className="flex items-center gap-2 flex-wrap mt-auto">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-claude-bg rounded-sm border border-claude-border shadow-sm">
                                    <span className="font-mono text-[8px] sm:text-[9px] font-bold text-claude-secondary uppercase tracking-wider">{deck.cardCount} Cards</span>
                                </div>

                                {classes?.find(c => c.id === deck.class_id) && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border shadow-sm" style={{
                                        borderColor: `${classes.find(c => c.id === deck.class_id).color}40`,
                                        backgroundColor: `${classes.find(c => c.id === deck.class_id).color}10`,
                                        color: classes.find(c => c.id === deck.class_id).color
                                    }}>
                                        <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                        <span className="font-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">{classes.find(c => c.id === deck.class_id).name}</span>
                                    </div>
                                )}

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



export default function DeckLibrary() {
    const toast = useToast();
    const [decks, setDecks] = useState([]);
    const [folders, setFolders] = useState([]);
    const [classes, setClasses] = useState([]);
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

        try {
            const [decksData, foldersData, tagsData, classesData] = await Promise.all([
                api.getDecks().catch(() => []),
                api.getFolders().catch(() => []),
                api.getTags().catch(() => []),
                api.getClasses().catch(() => [])
            ]);

            setDecks(decksData);
            setFolders(foldersData);
            setTags(tagsData);
            setClasses(classesData);
            setError(null);

            if (decksData.length === 0 && foldersData.length === 0 && !localStorage.getItem('riven_onboarded')) {
                setShowOnboarding(true);
            }
        } catch (err) {
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

    // Close search overlay with Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isSearchOpen) {
                setIsSearchOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isSearchOpen]);

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
        const result = folderNameSchema.safeParse(newFolder.name.trim());
        if (!result.success) {
            toast.error(result.error.errors[0]?.message || 'Invalid folder name');
            return;
        }
        try {
            if (editingFolder) {
                await api.updateFolder(editingFolder.id, result.data, newFolder.color);
                toast.success('Folder updated');
            } else {
                await api.createFolder(result.data, newFolder.color);
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
        const result = tagNameSchema.safeParse(newTag.name.trim());
        if (!result.success) {
            toast.error(result.error.errors[0]?.message || 'Invalid tag name');
            return;
        }
        try {
            await api.createTag(result.data, newTag.color);
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
                            className="fixed inset-0 bg-claude-bg/80 md:backdrop-blur-md z-[60]"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 h-[85dvh] bg-claude-bg border-t border-claude-border z-[70] shadow-md md:shadow-2xl overflow-y-auto rounded-t-[3rem]"
                        >
                            <div className="sticky top-0 right-0 left-0 glass-panel md:backdrop-blur-md z-10 px-8 py-4 flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border-color)_30%,transparent)]">
                                <div className="w-12 h-1.5 bg-claude-surface rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
                                <h2 className="font-serif text-2xl font-bold italic text-claude-text">Library Menu</h2>
                                <button onClick={() => setIsMenuOpen(false)} className="p-3 -mr-3 text-claude-secondary hover:text-claude-accent tap-action">
                                    <X className="w-7 h-7" />
                                </button>
                            </div>
                            <div className="p-8 pb-safe">

                                {/* Folders in Menu */}
                                <div className="mb-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]">Folders</h3>
                                        <button onClick={() => { setShowFolderModal(true); setNewFolder({ name: '', color: '#6366f1' }); }} className="text-claude-accent text-[10px] font-mono font-bold uppercase tracking-widest">+ New</button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        <button
                                            onClick={() => { setActiveFolder(null); setIsMenuOpen(false); }}
                                            className={`p-4 rounded-xl border flex items-center gap-3 transition-[transform,opacity,color,background-color,border-color,box-shadow] ${activeFolder === null ? 'bg-claude-accent/20 border-claude-accent/40 text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}
                                        >
                                            <Library className="w-4 h-4" />
                                            <span className="font-mono text-xs font-bold uppercase tracking-wider">All Decks</span>
                                        </button>
                                        {folders.map(folder => (
                                            <button
                                                key={folder.id}
                                                onClick={() => { setActiveFolder(activeFolder === folder.id ? null : folder.id); setIsMenuOpen(false); }}
                                                className={`p-4 rounded-xl border flex items-center gap-3 transition-[transform,opacity,color,background-color,border-color,box-shadow] ${activeFolder === folder.id ? 'bg-claude-surface/80 border-claude-border' : 'glass-panel border-claude-border text-claude-secondary'}`}
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
                                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]">Tags</h3>
                                        <button onClick={() => setShowTagModal(true)} className="text-claude-accent text-[10px] font-mono font-bold uppercase tracking-widest">+ New</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => { setActiveTag(activeTag === tag.id ? null : tag.id); setIsMenuOpen(false); }}
                                                className={`px-3 py-2 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-[transform,opacity,color,background-color,border-color,box-shadow] ${activeTag === tag.id ? 'bg-claude-surface/80 border-claude-border' : 'glass-panel border-claude-border text-claude-secondary'}`}
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
                        className="fixed inset-0 z-[100] bg-claude-bg/95 md:backdrop-blur-2xl p-6 pt-safe flex flex-col"
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
                                    className="w-full glass-panel border-2 border-claude-accent/30 rounded-2xl pl-12 pr-4 py-4 text-lg font-mono text-claude-parchment outline-none focus:border-claude-accent"
                                />
                            </div>
                            <button
                                onClick={() => setIsSearchOpen(false)}
                                className="p-3 bg-claude-bg/20 rounded-2xl text-claude-secondary hover:text-claude-accent transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {searchQuery && (
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_40%,transparent)] px-2">Results for "{searchQuery}"</h3>
                                    {filteredDecks.length === 0 ? (
                                        <div className="py-12 text-center text-[color-mix(in_srgb,var(--secondary-text-color)_40%,transparent)] italic font-serif">No matching decks found</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {filteredDecks.map((deck) => (
                                                <Link key={deck.id} to={`/deck/${deck.id}`} onClick={() => setIsSearchOpen(false)} className="block p-4 glass-panel rounded-xl">
                                                    <h4 className="font-serif text-lg font-bold text-claude-text mb-1">{deck.title}</h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-claude-accent uppercase">{deck.cardCount} Cards</span>
                                                        <span className="text-[10px] font-mono text-[color-mix(in_srgb,var(--secondary-text-color)_40%,transparent)]">•</span>
                                                        <span className="text-[10px] font-mono text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)] truncate">{deck.description || 'No description'}</span>
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
                    <Link to="/decks" className="inline-flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors mb-1.5 tap-action">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Study</span>
                    </Link>
                    <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                        <span className="px-1.5 py-0.5 bg-claude-accent text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Library</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-serif font-bold italic text-claude-text tracking-tighter leading-none">Flashcards</h1>
                </div>
                <div className="flex items-center gap-2">

                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action disabled:opacity-50 flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <Link
                        to="/create"
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-claude-accent border border-claude-border/20 shadow-botanical-glow text-white rounded-xl sm:rounded-2xl hover:brightness-110 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)] active:scale-95"
                    >
                        <Plus className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
                    </Link>
                </div>
            </div>

            {/* Quick Actions Bar — Thumb-reachable controls */}
            <div className="sticky top-safe z-30 mb-8 py-2 -mx-4 px-4 bg-claude-bg/80 md:backdrop-blur-md border-b border-claude-border/10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex-1 flex items-center gap-3 p-3 glass-panel rounded-2xl text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action"
                    >
                        <Search className="w-5 h-5 opacity-60 ml-1" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">Search collection...</span>
                    </button>
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className={`p-3.5 border rounded-2xl transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action ${activeFolder || activeTag ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}
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
                        <span className="text-[11px] font-serif italic text-claude-text">
                            {activeFolder ? (activeFolder === 'unfiled' ? 'Unfiled Decks' : folders.find(f => f.id === activeFolder)?.name) : tags.find(t => t.id === activeTag)?.name}
                        </span>
                        <button onClick={() => { setActiveFolder(null); setActiveTag(null); }} className="text-claude-accent hover:text-claude-text transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Decks Collection — THE PRIMARY FOCUS */}
            <div className="space-y-6 px-1">
                <div className="space-y-6">
                <div className="flex items-baseline justify-between mb-2">
                    <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)] flex items-center gap-2">
                        <div className="w-4 h-px bg-current opacity-30" /> Your Decks
                    </h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary hover:text-claude-accent transition-colors flex items-center gap-1.5 tap-action"
                        >
                            {SORT_OPTIONS.find(o => o.id === sortBy)?.label} <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {showSortMenu && (
                            <>
                                {/* Mobile: Full-screen bottom sheet */}
                                <div className="lg:hidden relative">
                                    <div className="fixed inset-0 z-[70] bg-claude-bg/60 md:backdrop-blur-sm" onClick={() => setShowSortMenu(false)} />
                                    <div className="fixed bottom-0 left-0 right-0 bg-claude-bg border-t border-claude-border rounded-t-3xl z-[80] p-4 pb-safe animate-in slide-in-from-bottom duration-300">
                                        <div className="w-12 h-1 bg-claude-surface rounded-full mx-auto mb-6" />
                                        <div className="space-y-2">
                                            {SORT_OPTIONS.map(option => (
                                                <button
                                                    key={option.id}
                                                    onClick={() => { setSortBy(option.id); setShowSortMenu(false); }}
                                                    className={`w-full p-4 rounded-xl flex items-center gap-4 font-mono text-xs font-bold uppercase tracking-widest transition-[transform,opacity,color,background-color,border-color,box-shadow] ${sortBy === option.id ? 'bg-claude-accent/20 text-claude-accent' : 'glass-panel text-claude-secondary'}`}
                                                >
                                                    <option.icon className="w-4 h-4" />
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {/* Desktop: Floating popover */}
                                <div className="hidden lg:block relative">
                                    <div className="fixed inset-0 z-[70]" onClick={() => setShowSortMenu(false)} />
                                    <div className="absolute right-0 top-full mt-3 w-56 lg:bg-claude-bg/10 lg:backdrop-blur-2xl border border-claude-border/40 rounded-2xl z-[80] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-200">
                                        {SORT_OPTIONS.map(option => (
                                            <button
                                                key={option.id}
                                                onClick={() => { setSortBy(option.id); setShowSortMenu(false); }}
                                                className={`w-full p-3 rounded-xl flex items-center gap-3 font-mono text-[11px] font-bold uppercase tracking-widest transition-all
                                                    ${sortBy === option.id
                                                        ? 'bg-claude-accent/10 border-claude-accent/20 text-claude-accent border lg:bg-claude-surface/60 lg:border-claude-border lg:text-claude-text'
                                                        : 'text-claude-secondary hover:bg-claude-surface/60 hover:text-claude-text border border-transparent'
                                                    }
                                                `}
                                            >
                                                <option.icon className={`w-4 h-4 ${sortBy === option.id ? 'lg:text-claude-text' : 'opacity-70'}`} />
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {filteredDecks.length === 0 ? (
                    <div className="text-center py-16 glass-panel border-dashed border-2 border-claude-border rounded-3xl">
                        {decks.length === 0 ? (
                            <>
                                <Sparkles className="w-12 h-12 text-claude-accent opacity-20 mx-auto mb-4" />
                                <h3 className="font-serif italic text-xl text-claude-text opacity-40">No Decks</h3>
                                <p className="text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)] text-[10px] font-mono uppercase tracking-widest mt-2 px-8">Your deck collection is empty. Create your first deck below.</p>
                            </>
                        ) : (
                            <div className="py-12">
                                <Search className="w-12 h-12 text-claude-secondary opacity-10 mx-auto mb-4" />
                                <p className="text-[color-mix(in_srgb,var(--secondary-text-color)_40%,transparent)] italic font-serif">No matches for current scope</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 pb-20 px-1">
                        {filteredDecks.map((deck, i) => (
                            <DeckCard
                                key={deck.id}
                                deck={deck}
                                folders={folders}
                                classes={classes}
                                index={i}
                            />
                        ))}
                    </div>
                )}
                </div>
            </div>


            {/* Onboarding modal — Kept but positioned normally */}
            {showOnboarding && (
                <div className="fixed inset-0 bg-claude-bg/80 md:backdrop-blur-xl z-[200] flex items-center justify-center p-6">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-claude-bg border border-claude-border w-full max-w-sm rounded-[2rem] p-8 text-center shadow-md md:shadow-2xl">
                        <div className="w-full max-w-[240px] mx-auto mb-8">
                            <OnboardingArt />
                        </div>
                        <h2 className="text-3xl font-serif italic font-bold text-claude-text mb-4 leading-tight">Welcome to Riven</h2>
                        <p className="text-claude-secondary mb-8 font-serif italic text-lg leading-relaxed">
                            A quiet place for your thoughts to grow. Create your first deck to get started.
                        </p>
                        <div className="space-y-4">
                            <Link to="/create" onClick={dismissOnboarding} className="claude-button-primary w-full py-4 block text-lg">
                                Create My First Deck
                            </Link>
                            <button onClick={dismissOnboarding} className="text-claude-secondary font-mono text-[10px] uppercase tracking-widest font-bold">
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFolderModal(false)} className="absolute inset-0 bg-claude-bg/60 md:backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleCreateFolder}
                            className="relative bg-claude-bg w-full p-8 rounded-t-[3rem] border-t border-claude-border pb-safe"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-serif italic font-bold text-claude-text">{editingFolder ? 'Edit Folder' : 'New Folder'}</h3>
                                <button type="button" onClick={() => setShowFolderModal(false)} className="p-2 text-claude-secondary"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Label Name</label>
                                    <input
                                        type="text"
                                        value={newFolder.name}
                                        onChange={e => setNewFolder({ ...newFolder, name: e.target.value })}
                                        className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none"
                                        placeholder="e.g. Science"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                                    {FOLDER_COLORS.map(color => (
                                        <button key={color} type="button" onClick={() => setNewFolder({ ...newFolder, color })} className={`w-10 h-10 rounded-xl flex-shrink-0 transition-[transform,opacity,color,background-color,border-color,box-shadow] ${newFolder.color === color ? 'ring-2 ring-white ring-offset-4 ring-offset-claude-bg scale-110' : 'opacity-40'}`} style={{ backgroundColor: color }} />
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTagModal(false)} className="absolute inset-0 bg-claude-bg/60 md:backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleCreateTag}
                            className="relative bg-claude-bg w-full p-8 rounded-t-[3rem] border-t border-claude-border pb-safe"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-serif italic font-bold text-claude-text">Create Tag</h3>
                                <button type="button" onClick={() => setShowTagModal(false)} className="p-2 text-claude-secondary"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Tag Label</label>
                                    <input
                                        type="text"
                                        value={newTag.name}
                                        onChange={e => setNewTag({ ...newTag, name: e.target.value })}
                                        className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none"
                                        placeholder="e.g. IMPORTANT"
                                    />
                                </div>
                                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                                    {FOLDER_COLORS.map(color => (
                                        <button key={color} type="button" onClick={() => setNewTag({ ...newTag, color })} className={`w-10 h-10 rounded-xl flex-shrink-0 transition-[transform,opacity,color,background-color,border-color,box-shadow] ${newTag.color === color ? 'ring-2 ring-white ring-offset-4 ring-offset-claude-bg scale-110' : 'opacity-40'}`} style={{ backgroundColor: color }} />
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
