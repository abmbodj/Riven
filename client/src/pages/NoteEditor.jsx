import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ChevronLeft, Check, Loader2, Layers, BookOpen, ClipboardCheck, Trash2, X, ChevronDown
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import TiptapEditor from '../components/editor/TiptapEditor';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';

export default function NoteEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const toast = useToast();
    const isNew = id === 'new';

    const [noteId, setNoteId] = useState(isNew ? null : id);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState(null);
    const [classId, setClassId] = useState(searchParams.get('classId') || null);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(true);
    const [showClassPicker, setShowClassPicker] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);

    // AI generation states
    const [generating, setGenerating] = useState(null); // 'flashcards' | 'guide' | 'exam' | null

    const saveTimerRef = useRef(null);
    const contentRef = useRef(content);
    const titleRef = useRef(title);

    // Load note data
    useEffect(() => {
        const load = async () => {
            try {
                const classesData = await api.getClasses().catch(() => []);
                setClasses(classesData);

                if (!isNew) {
                    const note = await api.getNote(id);
                    setTitle(note.title || '');
                    setContent(note.content || {});
                    setClassId(note.class_id || null);
                    titleRef.current = note.title || '';
                    contentRef.current = note.content || {};
                }
            } catch (err) {
                toast.error('Failed to load note');
                navigate('/notes');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isNew, navigate, toast]);

    // Auto-save with debounce
    const saveNote = useCallback(async () => {
        if (!noteId && !isNew) return;

        setSaving(true);
        try {
            if (!noteId) {
                // Create new note
                const newNote = await api.createNote(
                    titleRef.current || 'Untitled',
                    contentRef.current || {},
                    classId
                );
                setNoteId(newNote.id);
                window.history.replaceState(null, '', `/note/${newNote.id}`);
            } else {
                await api.updateNote(noteId, {
                    title: titleRef.current || 'Untitled',
                    content: contentRef.current,
                    class_id: classId,
                });
            }
            setSaved(true);
        } catch (err) {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    }, [noteId, isNew, classId, toast]);

    const debounceSave = useCallback(() => {
        setSaved(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(saveNote, 800);
    }, [saveNote]);

    const handleTitleChange = (e) => {
        const val = e.target.value;
        setTitle(val);
        titleRef.current = val;
        debounceSave();
    };

    const handleContentUpdate = useCallback((json) => {
        contentRef.current = json;
        debounceSave();
    }, [debounceSave]);

    const handleClassChange = async (newClassId) => {
        setClassId(newClassId);
        setShowClassPicker(false);
        if (noteId) {
            try {
                await api.updateNote(noteId, { class_id: newClassId });
            } catch {
                // Silent fail for class change
            }
        }
    };

    // Extract plain text from Tiptap JSON for AI generation
    const extractText = (doc) => {
        if (!doc || !doc.content) return '';
        const texts = [];
        const walk = (nodes) => {
            for (const node of nodes) {
                if (node.text) texts.push(node.text);
                if (node.content) walk(node.content);
            }
        };
        walk(doc.content);
        return texts.join('\n');
    };

    const handleGenerateFlashcards = async () => {
        const text = extractText(contentRef.current);
        if (!text.trim()) { toast.error('Note is empty'); return; }

        setGenerating('flashcards');
        try {
            const result = await api.generateAiDeck(text, null, `${titleRef.current || 'Note'} - AI`, classId);
            toast.success(`Generated ${result.card_count} flashcards!`);
            navigate(`/deck/${result.deck_id}`);
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate flashcards');
        } finally {
            setGenerating(null);
        }
    };

    const handleGenerateGuide = async () => {
        const text = extractText(contentRef.current);
        if (!text.trim()) { toast.error('Note is empty'); return; }

        setGenerating('guide');
        try {
            const result = await api.generateAiGuide(text, null, `${titleRef.current || 'Note'} Guide`, noteId, classId);
            toast.success('Study guide generated!');
            navigate(`/guide/${result.guide_id}`);
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate guide');
        } finally {
            setGenerating(null);
        }
    };

    const handleGenerateExam = async () => {
        const text = extractText(contentRef.current);
        if (!text.trim()) { toast.error('Note is empty'); return; }

        setGenerating('exam');
        try {
            const result = await api.generateAiExam(text, null, `${titleRef.current || 'Note'} Exam`, 'notes', noteId, classId);
            toast.success(`Generated ${result.question_count} questions!`);
            navigate(`/exam/${result.exam_id}`);
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate exam');
        } finally {
            setGenerating(null);
        }
    };

    const handleDelete = async () => {
        if (!noteId) { navigate('/notes'); return; }
        try {
            await api.deleteNote(noteId);
            toast.success('Note deleted');
            navigate('/notes');
        } catch (err) {
            toast.error(err?.message || 'Failed to delete');
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-claude-accent animate-spin" />
        </div>
    );

    const selectedClass = classes.find(c => c.id === classId);

    return (
        <div className="relative min-h-screen pb-32">
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm}
                title="Delete this note?"
                message="This note will be permanently deleted."
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm(false)}
            />

            {/* Header */}
            <div className="sticky top-0 z-30 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/10 px-4 py-3">
                <div className="flex items-center justify-between max-w-3xl mx-auto">
                    <button onClick={() => navigate('/notes')} className="flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors tap-action">
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">Notes</span>
                    </button>

                    <div className="flex items-center gap-3">
                        {/* Save indicator */}
                        <div className="flex items-center gap-1.5">
                            {saving ? (
                                <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                            ) : saved ? (
                                <Check className="w-3.5 h-3.5 text-claude-accent" />
                            ) : null}
                            <span className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary">
                                {saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}
                            </span>
                        </div>

                        <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Editor Area */}
            <div className="max-w-3xl mx-auto px-4 pt-6">
                {/* Class picker */}
                <div className="mb-4 relative">
                    <button
                        onClick={() => setShowClassPicker(!showClassPicker)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent transition-colors tap-action"
                        style={selectedClass ? { borderColor: selectedClass.color + '40', color: selectedClass.color, backgroundColor: selectedClass.color + '10' } : {}}
                    >
                        {selectedClass ? selectedClass.name : 'No class'}
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    <AnimatePresence>
                        {showClassPicker && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowClassPicker(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    className="absolute left-0 top-full mt-2 w-56 glass-panel border border-claude-border rounded-xl z-20 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                                >
                                    <button
                                        onClick={() => handleClassChange(null)}
                                        className={`w-full p-2.5 rounded-lg text-left text-[11px] font-mono uppercase tracking-wider transition-colors ${!classId ? 'bg-claude-accent/10 text-claude-accent' : 'text-claude-secondary hover:bg-claude-surface'}`}
                                    >
                                        No class
                                    </button>
                                    {classes.map(cls => (
                                        <button
                                            key={cls.id}
                                            onClick={() => handleClassChange(cls.id)}
                                            className={`w-full p-2.5 rounded-lg text-left text-[11px] font-mono uppercase tracking-wider transition-colors flex items-center gap-2 ${classId === cls.id ? 'bg-claude-accent/10 text-claude-accent' : 'text-claude-secondary hover:bg-claude-surface'}`}
                                        >
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                                            {cls.name}
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Title */}
                <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder="Untitled"
                    className="w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none mb-2 tracking-tight leading-tight"
                />

                {/* Tiptap Editor */}
                <TiptapEditor
                    content={content}
                    onUpdate={handleContentUpdate}
                    editable={true}
                    placeholder="Start writing, or type / for commands..."
                />
            </div>

            {/* AI Actions — Fixed bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 z-20 bg-claude-bg/90 backdrop-blur-md border-t border-claude-border/20 pb-safe">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-claude-secondary/50 shrink-0 mr-1">AI</span>

                    <button
                        onClick={handleGenerateFlashcards}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        Flashcards
                    </button>

                    <button
                        onClick={handleGenerateGuide}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'guide' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                        Study Guide
                    </button>

                    <button
                        onClick={handleGenerateExam}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                        Mock Exam
                    </button>
                </div>
            </div>
        </div>
    );
}
