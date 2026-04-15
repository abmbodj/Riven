import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    FileText, ChevronLeft, Plus, Search, X, Calendar, Sparkles, Mic, Upload, CheckSquare
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import { useSelection } from '../hooks/useSelection';
import BulkActionBar from '../components/BulkActionBar';

const NoteCard = memo(({ note, classes, index, isSelectMode = false, isSelected = false, onToggle }) => {
    const cls = note.class_id ? classes.find(c => c.id === note.class_id) : null;
    const sourceIcon = note.source_type === 'audio' ? Mic : note.source_type === 'import' ? Upload : FileText;
    const SourceIcon = sourceIcon;

    const CardWrapper = isSelectMode ? 'div' : Link;
    const wrapperProps = isSelectMode
        ? {
            onClick: () => onToggle?.(note.id),
            role: 'button',
            'aria-pressed': isSelected,
            tabIndex: 0,
            onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(note.id); } },
          }
        : { to: `/note/${note.id}` };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.8 : 0.8 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, scale: 1.01, transition: { duration: 0.3, ease: [0.33, 1, 0.68, 0.9] } }}
            transition={{ delay: (index % 10) * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative tap-action"
        >
            {/* Specimen tape */}
            <div className="absolute -top-1 left-1/4 w-10 h-3 bg-claude-border/60 rotate-[-2deg] rounded-sm z-10 shadow-sm opacity-80 pointer-events-none" />

            <CardWrapper
                {...wrapperProps}
                className={`group relative block bg-claude-surface border p-5 sm:p-6 pt-7 sm:pt-8 rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] active:shadow-inner active:bg-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 overflow-hidden active:scale-[0.97] touch-target ${isSelected ? 'border-claude-accent ring-2 ring-claude-accent/60 bg-claude-accent/5' : 'border-claude-border'}`}
            >
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />
                <div className="absolute inset-0 bg-gradient-to-br from-claude-text/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 opacity-70">
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-claude-secondary italic">
                            {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <div className="h-px flex-1 bg-claude-border/40" />
                        <SourceIcon className="w-3 h-3 text-claude-secondary/50" />
                    </div>

                    <h3 className="font-serif text-lg sm:text-xl font-bold text-claude-text leading-[1.15] group-hover:text-claude-accent transition-colors duration-300 italic mb-3 tracking-tight line-clamp-2">
                        {note.title || 'Untitled'}
                    </h3>

                    <div className="flex items-center gap-2 flex-wrap">
                        {cls && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border shadow-sm" style={{
                                borderColor: `${cls.color}40`,
                                backgroundColor: `${cls.color}10`,
                                color: cls.color,
                            }}>
                                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span className="font-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">{cls.name}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="absolute -bottom-4 -right-4 opacity-[0.03] transition-opacity duration-700 pointer-events-none group-active:opacity-[0.08] transform origin-center scale-[1.2] sm:scale-150">
                    <FileText className="w-24 h-24 sm:w-32 sm:h-32" />
                </div>

                {/* Checkbox overlay — visible in select mode */}
                {isSelectMode && (
                    <div className={`absolute top-3 right-3 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 pointer-events-none ${isSelected ? 'bg-claude-accent border-claude-accent' : 'border-claude-border bg-claude-bg/80 backdrop-blur-sm'}`}>
                        {isSelected && (
                            <svg className="w-3.5 h-3.5 text-[#162a31]" viewBox="0 0 14 14" fill="none">
                                <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        )}
                    </div>
                )}
            </CardWrapper>
        </motion.div>
    );
});
NoteCard.displayName = 'NoteCard';

export default function NotesLibrary() {
    const navigate = useNavigate();
    const toast = useToast();
    const [notes, setNotes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeClass, setActiveClass] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [notesData, classesData] = await Promise.all([
                api.getNotes().catch(() => []),
                api.getClasses().catch(() => []),
            ]);
            setNotes(notesData);
            setClasses(classesData);
            setError(null);
        } catch (err) {
            setError(err?.message || 'Failed to load notes');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

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

    const filteredNotes = useMemo(() => notes
        .filter(note => {
            if (activeClass && note.class_id !== activeClass) return false;
            if (searchQuery) {
                return note.title?.toLowerCase().includes(searchQuery.toLowerCase());
            }
            return true;
        }), [notes, activeClass, searchQuery]);

    const {
        isSelectMode, selectedIds, selectedCount, isAllSelected,
        enterSelectMode, exitSelectMode, toggleSelect, toggleSelectAll,
    } = useSelection(filteredNotes);

    const handleBulkDelete = async () => {
        const ids = [...selectedIds];
        const idSet = new Set(ids);
        setNotes(prev => prev.filter(n => !idSet.has(n.id)));
        exitSelectMode();
        try {
            await api.bulkDeleteNotes(ids);
            toast.success(`${ids.length} note${ids.length === 1 ? '' : 's'} deleted`);
            loadData();
        } catch (err) {
            toast.error(err?.message || 'Failed to delete some notes');
            loadData();
        }
    };

    const handleCreateNote = async () => {
        try {
            const newNote = await api.createNote('Untitled', {}, null);
            navigate(`/note/${newNote.id}`);
        } catch (err) {
            toast.error(err?.message || 'Failed to create note');
        }
    };

    const handleDeleteNote = async () => {
        try {
            await api.deleteNote(deleteConfirm.item.id);
            toast.success('Note deleted');
            loadData();
        } catch (err) {
            toast.error(err?.message || 'Failed to delete note');
        }
    };

    if (loading) return (
        <div className="space-y-4 pt-4">
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
                <p className="font-medium mb-4">Couldn't load notes</p>
                <button onClick={loadData} className="claude-button-primary bg-red-500 text-white">Try Again</button>
            </div>
        </div>
    );

    return (
        <div className="relative min-h-screen pb-24">
            <ConfirmModal
                isOpen={deleteConfirm.show}
                title="Delete note?"
                message="This note will be permanently deleted."
                onConfirm={() => { handleDeleteNote(); setDeleteConfirm({ show: false, item: null }); }}
                onCancel={() => setDeleteConfirm({ show: false, item: null })}
            />

            {/* Search Overlay */}
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
                                    placeholder="Search notes..."
                                    className="w-full glass-panel border-2 border-claude-accent/30 rounded-2xl pl-12 pr-4 py-4 text-lg font-mono text-claude-parchment outline-none focus:border-claude-accent"
                                />
                            </div>
                            <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="p-3 bg-claude-bg/20 rounded-2xl text-claude-secondary hover:text-claude-accent transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {searchQuery && (
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_40%,transparent)] px-2">Results for "{searchQuery}"</h3>
                                    {filteredNotes.length === 0 ? (
                                        <div className="py-12 text-center text-[color-mix(in_srgb,var(--secondary-text-color)_40%,transparent)] italic font-serif">No matching notes found</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {filteredNotes.map(note => (
                                                <Link key={note.id} to={`/note/${note.id}`} onClick={() => setIsSearchOpen(false)} className="block p-4 glass-panel rounded-xl">
                                                    <h4 className="font-serif text-lg font-bold text-claude-text mb-1">{note.title || 'Untitled'}</h4>
                                                    <span className="text-[10px] font-mono text-claude-secondary uppercase">
                                                        {new Date(note.updated_at).toLocaleDateString()}
                                                    </span>
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

            {/* Header */}
            <div className="mb-6 pt-4 px-1 flex items-end justify-between">
                <div>
                    <Link to="/decks" className="inline-flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors mb-1.5 tap-action">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Study</span>
                    </Link>
                    <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                        <span className="px-1.5 py-0.5 bg-[#22c55e] text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Vault</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-serif font-bold italic text-claude-text tracking-tighter leading-none">Notes</h1>
                </div>
                <div className="flex items-center gap-2">
                    {!isSelectMode ? (
                        <button
                            onClick={enterSelectMode}
                            className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center hover:-translate-y-1 active:scale-95"
                            aria-label="Enter selection mode"
                        >
                            <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    ) : (
                        <button
                            onClick={exitSelectMode}
                            className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-accent border border-claude-accent/40 tap-action flex items-center justify-center active:scale-95"
                            aria-label="Exit selection mode"
                        >
                            <X className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    )}
                    <button
                        onClick={() => { if (!isSelectMode) setIsSearchOpen(true); }}
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <Search className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <button
                        onClick={handleCreateNote}
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-claude-accent border border-claude-border/20 shadow-botanical-glow text-white rounded-xl sm:rounded-2xl hover:brightness-110 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <Plus className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
                    </button>
                </div>
            </div>

            {/* Class Filter Pills */}
            {classes.length > 0 && (
                <div className="mb-6 px-1 flex items-center gap-2 overflow-x-auto pb-2 -mx-1 scrollbar-hide">
                    <button
                        onClick={() => setActiveClass(null)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 transition-all ${!activeClass ? 'bg-claude-accent/20 text-claude-accent border border-claude-accent/40' : 'glass-panel border border-claude-border text-claude-secondary'}`}
                    >
                        All
                    </button>
                    {classes.map(cls => (
                        <button
                            key={cls.id}
                            onClick={() => setActiveClass(activeClass === cls.id ? null : cls.id)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 transition-all ${activeClass === cls.id ? 'border' : 'glass-panel border border-claude-border text-claude-secondary'}`}
                            style={activeClass === cls.id ? { backgroundColor: cls.color + '20', color: cls.color, borderColor: cls.color + '40' } : {}}
                        >
                            {cls.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Notes Grid */}
            <div className="px-1">
                {filteredNotes.length === 0 ? (
                    <div className="text-center py-16 glass-panel border-dashed border-2 border-claude-border rounded-3xl">
                        <FileText className="w-12 h-12 text-claude-accent opacity-20 mx-auto mb-4" />
                        <h3 className="font-serif italic text-xl text-claude-text opacity-40">No Notes</h3>
                        <p className="text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)] text-[10px] font-mono uppercase tracking-widest mt-2 px-8">
                            {notes.length === 0 ? 'Start writing your first note.' : 'No notes match your filters.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 pb-20">
                        {filteredNotes.map((note, i) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                classes={classes}
                                index={i}
                                isSelectMode={isSelectMode}
                                isSelected={selectedIds.has(note.id)}
                                onToggle={toggleSelect}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Bulk delete confirmation */}
            <ConfirmModal
                isOpen={bulkDeleteConfirm}
                title={`Delete ${selectedCount} note${selectedCount === 1 ? '' : 's'}?`}
                message={`This will permanently delete ${selectedCount} selected note${selectedCount === 1 ? '' : 's'}. This cannot be undone.`}
                confirmText="Delete All"
                onConfirm={() => { setBulkDeleteConfirm(false); handleBulkDelete(); }}
                onCancel={() => setBulkDeleteConfirm(false)}
                destructive
            />

            {/* Bulk action bar */}
            <BulkActionBar
                isVisible={isSelectMode && selectedCount > 0}
                selectedCount={selectedCount}
                isAllSelected={isAllSelected}
                onSelectAll={toggleSelectAll}
                onDelete={() => setBulkDeleteConfirm(true)}
                onExit={exitSelectMode}
            />
        </div>
    );
}
