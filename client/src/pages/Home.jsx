import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Layers, ChevronRight, RefreshCw, Sparkles, Folder,
    X, Plus, Search, FolderOpen, Hash, SlidersHorizontal, ArrowDownAZ, Calendar, Hash as HashIcon, Dog, Settings
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import PugPet from '../components/PugPet';
import PugGallery from '../components/PugGallery';
import PugCustomizer from '../components/PugCustomizer';
import { useStreakContext } from '../hooks/useStreakContext';

export default function Home() {
    const toast = useToast();
    const [decks, setDecks] = useState([]);
    const [folders, setFolders] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [showOnboarding, setShowOnboarding] = useState(false);

    // Pug pet state
    const streak = useStreakContext();
    const [showPugGallery, setShowPugGallery] = useState(false);
    const [showPugCustomizer, setShowPugCustomizer] = useState(false);

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

    const folderColors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
        '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6'
    ];

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const [decksData, foldersData, tagsData] = await Promise.all([
                api.getDecks(),
                api.getFolders(),
                api.getTags()
            ]);
            setDecks(decksData);
            setFolders(foldersData);
            setTags(tagsData);
            setError(null);

            if (decksData.length === 0 && foldersData.length === 0 && !localStorage.getItem('riven_onboarded')) {
                setShowOnboarding(true);
            }
        } catch (err) {
            setError(err.message);
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
    const filteredDecks = decks
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
        });

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
            toast.error(err.message);
        }
    };

    const handleDeleteFolder = async () => {
        try {
            await api.deleteFolder(deleteConfirm.item.id);
            toast.success('Folder deleted');
            if (activeFolder === deleteConfirm.item.id) setActiveFolder(null);
            loadData();
        } catch (err) {
            toast.error(err.message);
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
            toast.error(err.message);
        }
    };

    const handleDeleteTag = async () => {
        try {
            await api.deleteTag(deleteConfirm.item.id);
            toast.success('Tag deleted');
            if (activeTag === deleteConfirm.item.id) setActiveTag(null);
            loadData();
        } catch (err) {
            toast.error(err.message);
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
        <div className="animate-in fade-in duration-500 -mx-4">
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-claude-surface w-full max-w-sm rounded-3xl p-8 text-center animate-in zoom-in-95 duration-300">
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
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowFolderModal(false);
                            setEditingFolder(null);
                        }
                    }}
                >
                    <form 
                        onSubmit={handleCreateFolder} 
                        className="bg-claude-surface w-full p-6 pb-8 rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
                        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
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
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowTagModal(false);
                    }}
                >
                    <form 
                        onSubmit={handleCreateTag} 
                        className="bg-claude-surface w-full p-6 pb-8 rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
                        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
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

            {/* Header */}
            <div className="px-4 mb-4">
                {/* Pug Pet Section */}
                <div
                    className="mb-6 p-4 rounded-2xl flex items-center gap-4"
                    style={{ backgroundColor: 'var(--card)' }}
                >
                    <div onClick={() => setShowPugCustomizer(true)} className="cursor-pointer">
                        <PugPet
                            stage={streak.pugStage}
                            status={streak.status}
                            streak={streak.currentStreak}
                            size="sm"
                            showInfo={false}
                        />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold" style={{ color: 'var(--card-foreground)' }}>
                                {streak.currentStreak} day{streak.currentStreak !== 1 ? 's' : ''}
                            </span>
                            {streak.status === 'active' && <span>🦴</span>}
                            {streak.status === 'at-risk' && <span>🍖</span>}
                            {streak.status === 'broken' && <span>😴</span>}
                        </div>
                        <p className="text-xs opacity-70" style={{ color: 'var(--muted-foreground)' }}>
                            {streak.status === 'broken'
                                ? 'Study to wake up Gmail!'
                                : streak.status === 'at-risk'
                                    ? `${Math.round(streak.hoursRemaining)}h left to feed Gmail`
                                    : streak.studiedToday
                                        ? 'Gmail is happy!'
                                        : 'Study to grow Gmail'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowPugGallery(true)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--muted)' }}
                            title="View Gallery"
                        >
                            <Dog className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                        </button>
                        <button
                            onClick={() => setShowPugCustomizer(true)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--muted)' }}
                            title="Customize Gmail"
                        >
                            <Settings className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                        </button>
                    </div>
                </div>

                {/* Pug Gallery Modal */}
                {showPugGallery && (
                    <PugGallery
                        pastStreaks={streak.pastStreaks}
                        longestStreak={streak.longestStreak}
                        currentStreak={streak.currentStreak}
                        onClose={() => setShowPugGallery(false)}
                    />
                )}

                {/* Pug Customizer Modal */}
                {showPugCustomizer && (
                    <PugCustomizer
                        longestStreak={streak.longestStreak}
                        currentStreak={streak.currentStreak}
                        pugStage={streak.pugStage}
                        status={streak.status}
                        onClose={() => setShowPugCustomizer(false)}
                    />
                )}

                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-display font-bold">Library</h1>
                    <button onClick={() => loadData(true)} disabled={refreshing} className="p-2 text-claude-secondary active:text-claude-text disabled:opacity-50">
                        <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Search bar */}
                <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-claude-secondary" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search decks..."
                        className="w-full pl-12 pr-4 py-3 bg-claude-surface border border-claude-border rounded-xl focus:border-claude-accent outline-none"
                    />
                </div>
            </div>

            {/* Folders Section */}
            <div className="px-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-claude-secondary">Folders</h2>
                        <span className="text-[10px] text-claude-secondary hidden sm:inline">(hold to edit)</span>
                    </div>
                    <button
                        onClick={() => { setShowFolderModal(true); setNewFolder({ name: '', color: '#6366f1' }); }}
                        className="text-claude-accent text-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    <button
                        onClick={() => setActiveFolder(null)}
                        className={`shrink-0 px-4 py-2.5 rounded-full flex items-center gap-2 transition-colors ${activeFolder === null ? 'bg-claude-accent text-white' : 'bg-claude-surface border border-claude-border'}`}
                    >
                        <Layers className="w-4 h-4" />
                        <span className="font-medium text-sm">All</span>
                        <span className="text-xs opacity-70">{decks.length}</span>
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
                            className={`shrink-0 px-4 py-2.5 rounded-full flex items-center gap-2 transition-all active:scale-95 ${activeFolder === folder.id ? 'text-white shadow-md' : 'bg-claude-surface border border-claude-border'}`}
                            style={activeFolder === folder.id ? { backgroundColor: folder.color } : {}}
                        >
                            <Folder className="w-4 h-4" style={activeFolder !== folder.id ? { color: folder.color } : {}} />
                            <span className="font-medium text-sm">{folder.name}</span>
                            <span className="text-xs opacity-70">{folder.deckCount}</span>
                        </button>
                    ))}

                    <button
                        onClick={() => setActiveFolder(activeFolder === 'unfiled' ? null : 'unfiled')}
                        className={`shrink-0 px-4 py-2.5 rounded-full flex items-center gap-2 transition-colors ${activeFolder === 'unfiled' ? 'bg-claude-secondary text-white' : 'bg-claude-surface border border-claude-border text-claude-secondary'}`}
                    >
                        <FolderOpen className="w-4 h-4" />
                        <span className="font-medium text-sm">Unfiled</span>
                    </button>
                </div>
            </div>

            {/* Tags Section */}
            <div className="px-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-claude-secondary">Tags</h2>
                    <button
                        onClick={() => setShowTagModal(true)}
                        className="text-claude-accent text-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {tags.map(tag => (
                        <button
                            key={tag.id}
                            onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
                            className={`shrink-0 px-3 py-2 rounded-full flex items-center gap-1.5 transition-all active:scale-95 text-sm ${activeTag === tag.id ? 'text-white shadow-sm' : 'bg-claude-surface border border-claude-border'}`}
                            style={activeTag === tag.id ? { backgroundColor: tag.color } : {}}
                        >
                            <Hash className="w-3.5 h-3.5" style={activeTag !== tag.id ? { color: tag.color } : {}} />
                            <span className="font-medium">{tag.name}</span>
                        </button>
                    ))}
                    {tags.length === 0 && <span className="text-claude-secondary text-sm">No tags yet</span>}
                </div>
            </div>

            {/* Active Filters */}
            {(activeFolder !== null || activeTag !== null || searchQuery) && (
                <div className="px-4 mb-4 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-claude-secondary">Filters:</span>
                    {activeFolder !== null && (
                        <span className="px-2 py-1 bg-claude-surface border border-claude-border rounded-full text-xs flex items-center gap-1">
                            <Folder className="w-3 h-3" />
                            {activeFolder === 'unfiled' ? 'Unfiled' : folders.find(f => f.id === activeFolder)?.name}
                            <button onClick={() => setActiveFolder(null)} className="ml-1"><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {activeTag !== null && (
                        <span className="px-2 py-1 bg-claude-surface border border-claude-border rounded-full text-xs flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {tags.find(t => t.id === activeTag)?.name}
                            <button onClick={() => setActiveTag(null)} className="ml-1"><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {searchQuery && (
                        <span className="px-2 py-1 bg-claude-surface border border-claude-border rounded-full text-xs flex items-center gap-1">
                            <Search className="w-3 h-3" />"{searchQuery}"
                            <button onClick={() => setSearchQuery('')} className="ml-1"><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    <button onClick={() => { setActiveFolder(null); setActiveTag(null); setSearchQuery(''); }} className="text-xs text-claude-accent font-medium">
                        Clear all
                    </button>
                </div>
            )}

            {/* Decks List */}
            <div className="px-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-claude-secondary">
                        Decks {filteredDecks.length !== decks.length && `(${filteredDecks.length})`}
                    </h2>
                    <div className="relative">
                        <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="flex items-center gap-1.5 text-claude-secondary text-sm"
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            <span className="hidden sm:inline">Sort</span>
                        </button>
                        {showSortMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                                <div className="absolute right-0 top-full mt-2 bg-claude-surface border border-claude-border rounded-xl shadow-lg overflow-hidden z-20 min-w-[140px]">
                                    {[
                                        { id: 'newest', label: 'Newest', icon: Calendar },
                                        { id: 'oldest', label: 'Oldest', icon: Calendar },
                                        { id: 'alphabetical', label: 'A-Z', icon: ArrowDownAZ },
                                        { id: 'cards', label: 'Most Cards', icon: HashIcon },
                                    ].map(option => (
                                        <button
                                            key={option.id}
                                            onClick={() => { setSortBy(option.id); setShowSortMenu(false); }}
                                            className={`w-full px-4 py-2.5 flex items-center gap-2 text-sm text-left ${sortBy === option.id ? 'bg-claude-accent/10 text-claude-accent' : ''}`}
                                        >
                                            <option.icon className="w-4 h-4" />
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
                        {filteredDecks.map(deck => (
                            <Link key={deck.id} to={`/deck/${deck.id}`} className="claude-card p-4 flex items-center gap-4 active:scale-[0.98] transition-transform">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: deck.folder_id ? (folders.find(f => f.id === deck.folder_id)?.color || '#6366f1') + '20' : 'var(--color-surface)' }}
                                >
                                    <Layers className="w-6 h-6" style={{ color: deck.folder_id ? folders.find(f => f.id === deck.folder_id)?.color : 'var(--color-accent)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold truncate">{deck.title}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-claude-secondary text-sm">{deck.cardCount} cards</span>
                                        {deck.tags?.length > 0 && (
                                            <div className="flex items-center gap-1">
                                                {deck.tags.slice(0, 2).map(tag => (
                                                    <span key={tag.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                                                        {tag.name}
                                                    </span>
                                                ))}
                                                {deck.tags.length > 2 && <span className="text-xs text-claude-secondary">+{deck.tags.length - 2}</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-claude-secondary shrink-0" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <div className="h-8" />
        </div>
    );
}
