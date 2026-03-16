import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    BookOpen, ChevronLeft, Sparkles, Calendar, Loader2, X, Upload
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';

const ACCEPTED_FILES = '.pdf,.docx,.doc,.txt,image/*';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const GuideCard = memo(({ guide, classes, index }) => {
    const cls = guide.class_id ? classes.find(c => c.id === guide.class_id) : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.8 : 0.8 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, scale: 1.01, transition: { duration: 0.3, ease: [0.33, 1, 0.68, 0.9] } }}
            transition={{ delay: (index % 10) * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative tap-action"
        >
            <div className="absolute -top-1 left-1/4 w-10 h-3 bg-claude-border/60 rotate-[-2deg] rounded-sm z-10 shadow-sm opacity-80 pointer-events-none" />

            <Link
                to={`/guide/${guide.id}`}
                className="group relative block bg-claude-surface border border-claude-border p-5 sm:p-6 pt-7 sm:pt-8 rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] active:shadow-inner active:bg-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 overflow-hidden active:scale-[0.97] touch-target"
            >
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />
                <div className="absolute inset-0 bg-gradient-to-br from-claude-text/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 opacity-70">
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-claude-secondary italic">
                            {new Date(guide.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <div className="h-px flex-1 bg-claude-border/40" />
                        <BookOpen className="w-3 h-3 text-claude-secondary/50" />
                    </div>

                    <h3 className="font-serif text-lg sm:text-xl font-bold text-claude-text leading-[1.15] group-hover:text-claude-accent transition-colors duration-300 italic mb-3 tracking-tight line-clamp-2">
                        {guide.title}
                    </h3>

                    {cls && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border shadow-sm w-fit" style={{
                            borderColor: `${cls.color}40`,
                            backgroundColor: `${cls.color}10`,
                            color: cls.color,
                        }}>
                            <Calendar className="w-2.5 h-2.5" />
                            <span className="font-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">{cls.name}</span>
                        </div>
                    )}
                </div>

                <div className="absolute -bottom-4 -right-4 opacity-[0.03] transition-opacity duration-700 pointer-events-none group-active:opacity-[0.08] scale-[1.2] sm:scale-150">
                    <BookOpen className="w-24 h-24 sm:w-32 sm:h-32" />
                </div>
            </Link>
        </motion.div>
    );
});
GuideCard.displayName = 'GuideCard';

export default function GuidesLibrary() {
    const navigate = useNavigate();
    const toast = useToast();
    const [guides, setGuides] = useState([]);
    const [notes, setNotes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });

    // Generate form
    const [genSource, setGenSource] = useState('note'); // 'note' | 'file'
    const [selectedNote, setSelectedNote] = useState(null);
    const [genFile, setGenFile] = useState(null);
    const [genTitle, setGenTitle] = useState('');

    const loadData = useCallback(async () => {
        try {
            const [guidesData, notesData, classesData] = await Promise.all([
                api.getStudyGuides().catch(() => []),
                api.getNotes().catch(() => []),
                api.getClasses().catch(() => []),
            ]);
            setGuides(guidesData);
            setNotes(notesData);
            setClasses(classesData);
            setError(null);
        } catch (err) {
            setError(err?.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) { toast.error('File must be under 5MB'); return; }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            setGenFile({ data: base64, mimeType: file.type, name: file.name });
        };
        reader.readAsDataURL(file);
    };

    const extractTextFromNote = (note) => {
        if (!note?.content?.content) return '';
        const texts = [];
        const walk = (nodes) => {
            for (const node of nodes) {
                if (node.text) texts.push(node.text);
                if (node.content) walk(node.content);
            }
        };
        walk(note.content.content);
        return texts.join('\n');
    };

    const handleGenerate = async () => {
        let noteText = '';
        let file = null;
        let noteId = null;
        let classId = null;

        if (genSource === 'note' && selectedNote) {
            const note = notes.find(n => n.id === selectedNote);
            if (!note) { toast.error('Select a note'); return; }
            noteText = extractTextFromNote(note);
            noteId = note.id;
            classId = note.class_id;
            if (!noteText.trim()) { toast.error('Selected note is empty'); return; }
        } else if (genSource === 'file' && genFile) {
            file = genFile;
        } else {
            toast.error(genSource === 'note' ? 'Select a note' : 'Upload a file');
            return;
        }

        setGenerating(true);
        try {
            const result = await api.generateAiGuide(
                noteText || null,
                file,
                genTitle || 'AI Study Guide',
                noteId,
                classId
            );
            toast.success('Study guide generated!');
            setShowGenerateModal(false);
            navigate(`/guide/${result.guide_id}`);
        } catch (err) {
            if (err.status === 429) { setShowGenerateModal(false); setShowPricingModal(true); }
            else toast.error(err.message || 'Failed to generate guide');
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async () => {
        try {
            await api.deleteStudyGuide(deleteConfirm.item.id);
            toast.success('Guide deleted');
            loadData();
        } catch (err) {
            toast.error(err?.message || 'Failed to delete');
        }
    };

    if (loading) return (
        <div className="space-y-4 pt-4">
            {[1, 2, 3].map((_, idx) => (
                <div key={idx} className="claude-card p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 bg-claude-border rounded-xl" />
                    <div className="flex-1"><div className="h-4 bg-claude-border rounded w-3/4 mb-2" /><div className="h-3 bg-claude-border rounded w-1/2" /></div>
                </div>
            ))}
        </div>
    );

    if (error) return (
        <div className="text-center py-10">
            <div className="bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 p-6">
                <p className="font-medium mb-4">Couldn't load study guides</p>
                <button onClick={loadData} className="claude-button-primary bg-red-500 text-white">Try Again</button>
            </div>
        </div>
    );

    return (
        <div className="relative min-h-screen pb-24">
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm.show}
                title="Delete guide?"
                message="This study guide will be permanently deleted."
                onConfirm={() => { handleDelete(); setDeleteConfirm({ show: false, item: null }); }}
                onCancel={() => setDeleteConfirm({ show: false, item: null })}
            />

            {/* Generate Guide Modal */}
            <AnimatePresence>
                {showGenerateModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGenerateModal(false)} className="absolute inset-0 bg-claude-bg/60 md:backdrop-blur-md" />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="relative bg-claude-bg w-full p-8 rounded-t-[3rem] border-t border-claude-border pb-safe max-h-[80dvh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-serif italic font-bold text-claude-text">Generate Study Guide</h3>
                                <button onClick={() => setShowGenerateModal(false)} className="p-2 text-claude-secondary"><X className="w-6 h-6" /></button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Title</label>
                                    <input
                                        type="text"
                                        value={genTitle}
                                        onChange={e => setGenTitle(e.target.value)}
                                        placeholder="AI Study Guide"
                                        className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Source</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setGenSource('note')} className={`flex-1 p-3 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all ${genSource === 'note' ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}>
                                            From Note
                                        </button>
                                        <button onClick={() => setGenSource('file')} className={`flex-1 p-3 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all ${genSource === 'file' ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}>
                                            Upload File
                                        </button>
                                    </div>
                                </div>

                                {genSource === 'note' ? (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {notes.length === 0 ? (
                                            <p className="text-claude-secondary italic font-serif text-sm text-center py-4">No notes yet</p>
                                        ) : notes.map(note => (
                                            <button
                                                key={note.id}
                                                onClick={() => setSelectedNote(note.id)}
                                                className={`w-full p-3 rounded-xl text-left border transition-all ${selectedNote === note.id ? 'bg-claude-accent/10 border-claude-accent/40 text-claude-accent' : 'glass-panel border-claude-border text-claude-text'}`}
                                            >
                                                <span className="font-serif italic text-sm">{note.title || 'Untitled'}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div>
                                        {genFile ? (
                                            <div className="flex items-center gap-3 p-3 glass-panel rounded-xl border border-claude-border">
                                                <Upload className="w-4 h-4 text-claude-accent" />
                                                <span className="font-mono text-xs text-claude-text truncate flex-1">{genFile.name}</span>
                                                <button onClick={() => setGenFile(null)} className="text-claude-secondary hover:text-red-400"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <label className="block p-8 border-2 border-dashed border-claude-border rounded-2xl text-center cursor-pointer hover:border-claude-accent/30 transition-colors">
                                                <Upload className="w-8 h-8 text-claude-secondary mx-auto mb-2" />
                                                <p className="text-[10px] font-mono uppercase tracking-widest text-claude-secondary">Tap to upload (PDF, DOCX, TXT, Image)</p>
                                                <input type="file" accept={ACCEPTED_FILES} onChange={handleFileChange} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="claude-button-primary w-full py-5 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                    {generating ? 'Generating...' : 'Generate Guide'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
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
                        <span className="px-1.5 py-0.5 bg-[#f59e0b] text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">AI</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-serif font-bold italic text-claude-text tracking-tighter leading-none">Study Guides</h1>
                </div>
                <button
                    onClick={() => { setShowGenerateModal(true); setGenSource('note'); setSelectedNote(null); setGenFile(null); setGenTitle(''); }}
                    className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-claude-accent border border-claude-border/20 shadow-botanical-glow text-white rounded-xl sm:rounded-2xl hover:brightness-110 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center hover:-translate-y-1 hover:shadow-lg active:scale-95"
                >
                    <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
                </button>
            </div>

            {/* Guides Grid */}
            <div className="px-1">
                {guides.length === 0 ? (
                    <div className="text-center py-16 glass-panel border-dashed border-2 border-claude-border rounded-3xl">
                        <BookOpen className="w-12 h-12 text-claude-accent opacity-20 mx-auto mb-4" />
                        <h3 className="font-serif italic text-xl text-claude-text opacity-40">No Study Guides</h3>
                        <p className="text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)] text-[10px] font-mono uppercase tracking-widest mt-2 px-8">Generate your first study guide from notes or a file.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 pb-20">
                        {guides.map((guide, i) => (
                            <GuideCard key={guide.id} guide={guide} classes={classes} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
